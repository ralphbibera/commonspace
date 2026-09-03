import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	buildRoutingPrompt,
	parseRoutingResponse,
	routeWithOpenAICompatible,
} from "../server/src/ai-router.ts";

const input = {
	text: "Fix the login screen CSS.",
	context: ["Ralph: The API is already working."],
	routingMemory: "",
	candidates: [
		{
			id: "frontend",
			displayName: "Frontend",
			description: "Owns React UI and CSS.",
			routingScore: 1,
			matchedTerms: ["css"],
		},
		{
			id: "backend",
			displayName: "Backend",
			description: "Owns APIs and persistence.",
			routingScore: 0,
			matchedTerms: [],
		},
	],
	projects: [{ id: "web", name: "Web App" }],
	inferProjects: false,
	maxAgents: 2,
};
const requestBodySchema = z.object({
	model: z.string(),
	response_format: z.object({ type: z.string() }),
});

function expectTerseFollowupContinuity(): void {
	const prompt = buildRoutingPrompt({
		...input,
		text: "nice push",
		context: [
			"Ralph: @frontend fix the login screen CSS.",
			"Frontend: Fixed the login screen CSS.",
		],
		candidates: input.candidates.slice(0, 1),
		maxAgents: 1,
	});

	expect(prompt).toContain("Return at least one assignment");
	expect(prompt).toContain("terse follow-up");
	expect(prompt).toContain("existing thread participant");
}

function expectEmptyRoutingDecisionRejected(): void {
	expect(() =>
		parseRoutingResponse(
			'{"assignments":[],"confidence":1,"reason":"Acknowledgment only; no agent work requested."}',
		),
	).toThrow("routing response must contain at least one assignment");
}

describe("Commonspace AI router", () => {
	it("builds a bounded classifier prompt with candidate responsibilities", () => {
		const prompt = buildRoutingPrompt(input);
		expect(prompt).toContain("Select one owner by default");
		expect(prompt).toContain('"id":"frontend"');
		expect(prompt).toContain('"routingScore":1');
		expect(prompt).toContain('"matchedTerms":["css"]');
		expect(prompt).toContain('"id":"web"');
		expect(prompt).toContain("one bounded sub-request per selected agent");
		expect(prompt).toContain("useful evidence");
		expect(prompt).toContain("Fix the login screen CSS.");
	});

	it("includes compacted explicit correction knowledge in later routing prompts", () => {
		const prompt = buildRoutingPrompt({
			...input,
			routingMemory: "Route review-only requests to Reviewer.",
		});

		expect(prompt).toContain(
			"Routing knowledge from explicit user corrections: Route review-only requests to Reviewer.",
		);
	});

	it(
		"requires terse thread follow-ups to keep an existing participant",
		expectTerseFollowupContinuity,
	);

	it("parses strict or fenced JSON routing results", () => {
		expect(
			parseRoutingResponse(
				'```json\n{"assignments":[{"agentId":"frontend","subRequest":"Fix the login CSS only.","projectIds":["web"]}],"confidence":0.96,"reason":"UI work"}\n```',
			),
		).toEqual({
			assignments: [
				{
					agentId: "frontend",
					subRequest: "Fix the login CSS only.",
					projectIds: ["web"],
				},
			],
			confidence: 0.96,
			reason: "UI work",
		});
	});

	it(
		"rejects an empty routing decision at the router boundary",
		expectEmptyRoutingDecisionRejected,
	);
});

describe("Commonspace AI router provider boundary", () => {
	it("calls an OpenAI-compatible chat completions endpoint without requiring an SDK", async () => {
		const request = vi.fn<typeof fetch>(
			async (resource: string | URL | Request, init?: RequestInit) => {
				void resource;
				void init;
				return new Response(
					JSON.stringify({
						choices: [
							{
								message: {
									content:
										'{"assignments":[{"agentId":"frontend","subRequest":"Fix CSS.","projectIds":["web"]}],"confidence":0.91,"reason":"CSS is frontend work"}',
								},
							},
						],
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			},
		);

		await expect(
			routeWithOpenAICompatible(
				{
					baseUrl: "https://example.test/v1",
					model: "gpt-router",
					apiKey: "secret-key",
					fetch: request,
				},
				input,
			),
		).resolves.toEqual({
			assignments: [
				{ agentId: "frontend", subRequest: "Fix CSS.", projectIds: ["web"] },
			],
			confidence: 0.91,
			reason: "CSS is frontend work",
		});

		expect(request).toHaveBeenCalledWith(
			"https://example.test/v1/chat/completions",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					authorization: "Bearer secret-key",
				}),
			}),
		);
		const body = requestBodySchema.parse(
			JSON.parse(String(request.mock.calls[0]?.[1]?.body)),
		);
		expect(body).toMatchObject({
			model: "gpt-router",
			response_format: { type: "json_object" },
		});
	});

	it("aborts an oversized provider response without buffering the remaining body", async () => {
		let pulls = 0;
		let cancelled = false;
		const stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				pulls += 1;
				controller.enqueue(new Uint8Array(40_000));
				if (pulls === 10) controller.close();
			},
			cancel() {
				cancelled = true;
			},
		});
		const request = vi.fn<typeof fetch>(
			async () => new Response(stream, { status: 200 }),
		);

		await expect(
			routeWithOpenAICompatible(
				{
					baseUrl: "https://example.test/v1",
					model: "gpt-router",
					fetch: request,
				},
				input,
			),
		).rejects.toThrow("routing provider response was too large");
		expect(cancelled).toBe(true);
		expect(pulls).toBeLessThanOrEqual(3);
	});
});
