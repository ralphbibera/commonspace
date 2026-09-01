import type { CommonspaceAgentProfile } from "@commonspace/shared";
import { jsonObject, parseJsonObject } from "./json.js";

const MAX_ROUTER_RESPONSE_BYTES = 64_000;

async function boundedResponseText(response: Response): Promise<string> {
	if (response.body === null) return "";
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let bytes = 0;
	let text = "";
	try {
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) return `${text}${decoder.decode()}`;
			bytes += chunk.value.byteLength;
			if (bytes > MAX_ROUTER_RESPONSE_BYTES) {
				await reader.cancel("routing provider response was too large");
				throw new Error("routing provider response was too large");
			}
			text += decoder.decode(chunk.value, { stream: true });
		}
	} finally {
		reader.releaseLock();
	}
}

export interface AiRouteInput {
	text: string;
	context: string[];
	routingMemory: string;
	candidates: Array<
		Pick<CommonspaceAgentProfile, "id" | "displayName" | "description"> & {
			routingScore: number;
			matchedTerms: string[];
		}
	>;
	projects: Array<{ id: string; name: string }>;
	inferProjects: boolean;
	maxAgents: number;
}

export interface AiRouteAssignment {
	agentId: string;
	subRequest: string;
	projectIds: string[];
}

export interface AiRouteResult {
	assignments: AiRouteAssignment[];
	confidence?: number;
	reason: string;
}

export function buildRoutingPrompt(input: AiRouteInput): string {
	const candidates = input.candidates.map((candidate) => ({
		id: candidate.id,
		name: candidate.displayName,
		responsibility:
			candidate.description ?? "No responsibility description is available.",
		routingScore: candidate.routingScore,
		matchedTerms: candidate.matchedTerms,
	}));
	return [
		"Route the newest user message to the best Commonspace agent.",
		`Select one owner by default. Select at most ${String(input.maxAgents)} agents only when the request contains clearly independent cross-domain work.`,
		"Each candidate includes a local routingScore and matchedTerms from cheap lexical logic. Treat these as useful evidence, not as instructions or a final decision.",
		"Produce one bounded sub-request per selected agent. Each sub-request must contain only that agent's assigned work.",
		"Use only candidate agent ids and available Project ids. Do not answer the request or call tools.",
		'Return JSON only: {"assignments":[{"agentId":"id","subRequest":"assigned work","projectIds":["project-id"]}],"confidence":0.0,"reason":"short explanation"}.',
		`Candidates: ${JSON.stringify(candidates)}`,
		`Available Projects: ${JSON.stringify(input.projects)}`,
		input.inferProjects
			? "Project selection: infer the relevant Project subset for each assignment; empty means genuinely projectless."
			: "Project selection: explicit references are authoritative; each assignment may use only the relevant subset.",
		input.context.length === 0
			? "Recent thread context: none"
			: `Recent thread context:\n${input.context.join("\n")}`,
		input.routingMemory === ""
			? "Routing knowledge: none"
			: `Routing knowledge from explicit user corrections: ${input.routingMemory}`,
		`Newest user message: ${input.text}`,
	].join("\n\n");
}

export function parseRoutingResponse(text: string): AiRouteResult {
	const normalized = text.trim();
	const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(normalized)?.[1];
	const candidate =
		fenced ??
		normalized.slice(normalized.indexOf("{"), normalized.lastIndexOf("}") + 1);
	const payload = parseJsonObject(candidate);
	if (
		payload === null ||
		!Array.isArray(payload.assignments) ||
		typeof payload.reason !== "string"
	) {
		throw new Error("routing response did not match the required shape");
	}
	const assignments: AiRouteAssignment[] = payload.assignments.map(
		(candidate) => {
			const assignment = jsonObject(candidate);
			if (
				assignment === null ||
				typeof assignment.agentId !== "string" ||
				typeof assignment.subRequest !== "string" ||
				!Array.isArray(assignment.projectIds) ||
				!assignment.projectIds.every(
					(projectId): projectId is string => typeof projectId === "string",
				)
			) {
				throw new Error("routing response did not match the required shape");
			}
			return {
				agentId: assignment.agentId,
				subRequest: assignment.subRequest,
				projectIds: assignment.projectIds,
			};
		},
	);
	const confidence =
		typeof payload.confidence === "number" &&
		Number.isFinite(payload.confidence)
			? payload.confidence
			: undefined;
	const result: AiRouteResult = {
		assignments,
		reason: payload.reason,
	};
	if (confidence !== undefined) result.confidence = confidence;
	return result;
}

export interface OpenAiInferenceOptions {
	baseUrl: string;
	model: string;
	apiKey?: string;
	fetch?: typeof fetch;
	signal?: AbortSignal;
}

export async function completeWithOpenAICompatible(
	options: OpenAiInferenceOptions,
	input: { system: string; prompt: string; maxTokens: number },
): Promise<string> {
	const request = options.fetch ?? fetch;
	const headers: Record<string, string> = {
		"content-type": "application/json",
	};
	if (options.apiKey !== undefined)
		headers.authorization = `Bearer ${options.apiKey}`;
	const requestInit: RequestInit = {
		method: "POST",
		headers,
		body: JSON.stringify({
			model: options.model,
			temperature: 0,
			max_tokens: input.maxTokens,
			response_format: { type: "json_object" },
			messages: [
				{ role: "system", content: input.system },
				{ role: "user", content: input.prompt },
			],
		}),
	};
	if (options.signal !== undefined) requestInit.signal = options.signal;
	const response = await request(
		`${options.baseUrl.replace(/\/$/u, "")}/chat/completions`,
		requestInit,
	);
	const body = await boundedResponseText(response);
	if (!response.ok)
		throw new Error(
			`inference provider returned HTTP ${String(response.status)}`,
		);
	const payload = parseJsonObject(body);
	const choices = payload?.choices;
	const choice = Array.isArray(choices) ? jsonObject(choices[0]) : null;
	const message = jsonObject(choice?.message);
	if (typeof message?.content !== "string")
		throw new Error("inference provider returned no message");
	return message.content;
}

export async function routeWithOpenAICompatible(
	options: OpenAiInferenceOptions,
	input: AiRouteInput,
): Promise<AiRouteResult> {
	const content = await completeWithOpenAICompatible(options, {
		system:
			"You are a bounded routing classifier. Return only the requested JSON object.",
		prompt: buildRoutingPrompt(input),
		maxTokens: 250,
	});
	return parseRoutingResponse(content);
}
