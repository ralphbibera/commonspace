import { describe, expect, it } from "vitest";
import {
	type AiRouteInput,
	routeWithOpenAICompatible,
} from "../server/src/ai-router.ts";

interface ExpectedAssignment {
	agentId: string;
	projectIds: string[];
	requiredConstraint: string;
}

interface RoutingEvaluationCase {
	name: string;
	input: AiRouteInput;
	expectedMode: "parallel" | "relay";
	expected: ExpectedAssignment[];
}

const cases: RoutingEvaluationCase[] = [
	{
		name: "separates API compatibility from documentation",
		input: {
			text: "Backend: validate the import envelope without changing the public archive shape. Constraint API_COMPAT must survive. Docs: document the exact supported limits and keep the privacy warning. Constraint DOC_PRIVACY must survive.",
			context: [],
			routingMemory: "",
			candidates: [
				{
					id: "backend",
					displayName: "Backend",
					description: "Owns server APIs, validation, and persistence.",
					routingScore: 1,
					matchedTerms: ["import", "envelope"],
				},
				{
					id: "docs",
					displayName: "Docs",
					description: "Owns user and release documentation.",
					routingScore: 1,
					matchedTerms: ["document", "privacy"],
				},
			],
			projects: [
				{ id: "server-project", name: "Server" },
				{ id: "docs-project", name: "Documentation" },
			],
			inferProjects: true,
			maxAgents: 2,
		},
		expectedMode: "parallel",
		expected: [
			{
				agentId: "backend",
				projectIds: ["server-project"],
				requiredConstraint: "API_COMPAT",
			},
			{
				agentId: "docs",
				projectIds: ["docs-project"],
				requiredConstraint: "DOC_PRIVACY",
			},
		],
	},
	{
		name: "keeps independent UI and security constraints scoped",
		input: {
			text: "UI: show uncertain reply attention without changing permission controls. Preserve token UI_UNCERTAIN. Security: review file-handle race protection only; do not rewrite attachment contents. Preserve token SECURITY_BYTES.",
			context: ["Ralph: Native permissions remain authoritative."],
			routingMemory: "",
			candidates: [
				{
					id: "frontend",
					displayName: "Frontend",
					description: "Owns React presentation and interaction semantics.",
					routingScore: 1,
					matchedTerms: ["UI", "show"],
				},
				{
					id: "security",
					displayName: "Security",
					description: "Owns filesystem boundary review and data protection.",
					routingScore: 1,
					matchedTerms: ["Security", "file-handle"],
				},
			],
			projects: [
				{ id: "ui-project", name: "UI" },
				{ id: "server-project", name: "Server" },
			],
			inferProjects: true,
			maxAgents: 2,
		},
		expectedMode: "parallel",
		expected: [
			{
				agentId: "frontend",
				projectIds: ["ui-project"],
				requiredConstraint: "UI_UNCERTAIN",
			},
			{
				agentId: "security",
				projectIds: ["server-project"],
				requiredConstraint: "SECURITY_BYTES",
			},
		],
	},
	{
		name: "orders an explicit peer discussion as a relay",
		input: {
			text: "Talk to each other in this order and agree on ownership. Backend starts with BACKEND_SCOPE. Frontend responds with FRONTEND_SCOPE. Infrastructure synthesizes with INFRA_SCOPE.",
			context: [],
			routingMemory: "",
			candidates: [
				{
					id: "backend",
					displayName: "Backend",
					description: "Owns APIs, services, and persistence.",
					routingScore: 1,
					matchedTerms: ["Backend"],
				},
				{
					id: "frontend",
					displayName: "Frontend",
					description: "Owns client UI, state, and navigation.",
					routingScore: 1,
					matchedTerms: ["Frontend"],
				},
				{
					id: "infrastructure",
					displayName: "Infrastructure",
					description: "Owns runtime, deployment, and reliability.",
					routingScore: 1,
					matchedTerms: ["Infrastructure"],
				},
			],
			projects: [],
			inferProjects: false,
			maxAgents: 3,
		},
		expectedMode: "relay",
		expected: [
			{
				agentId: "backend",
				projectIds: [],
				requiredConstraint: "BACKEND_SCOPE",
			},
			{
				agentId: "frontend",
				projectIds: [],
				requiredConstraint: "FRONTEND_SCOPE",
			},
			{
				agentId: "infrastructure",
				projectIds: [],
				requiredConstraint: "INFRA_SCOPE",
			},
		],
	},
];

const runEvaluation = process.env.COMMONSPACE_ROUTING_EVAL === "1";

describe.runIf(runEvaluation)("routing provider quality evaluation", () => {
	for (const evaluation of cases) {
		it(evaluation.name, async () => {
			const baseUrl = process.env.COMMONSPACE_ROUTING_BASE_URL;
			const model = process.env.COMMONSPACE_ROUTING_MODEL;
			if (baseUrl === undefined || model === undefined)
				throw new Error(
					"routing evaluation requires COMMONSPACE_ROUTING_BASE_URL and COMMONSPACE_ROUTING_MODEL",
				);
			const result = await routeWithOpenAICompatible(
				{
					baseUrl,
					model,
					apiKey: process.env.COMMONSPACE_ROUTING_API_KEY,
				},
				evaluation.input,
			);
			expect(result.mode).toBe(evaluation.expectedMode);
			expect(result.assignments).toHaveLength(evaluation.expected.length);
			for (const expected of evaluation.expected) {
				const assignment = result.assignments.find(
					(candidate) => candidate.agentId === expected.agentId,
				);
				expect(
					assignment,
					`missing ${expected.agentId} assignment`,
				).toBeDefined();
				expect(assignment?.projectIds).toEqual(expected.projectIds);
				expect(assignment?.subRequest).toContain(expected.requiredConstraint);
			}
		});
	}
});
