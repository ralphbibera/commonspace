import { describe, expect, it } from "vitest";
import { finalHandoffAgent } from "../server/src/relay.ts";

const agents = [
	{ id: "backend", displayName: "Backend" },
	{ id: "frontend", displayName: "Frontend" },
];
const memberIds = agents.map((agent) => agent.id);

describe("Agent handoff directives", () => {
	it("routes only an explicit peer directive at the start of the final paragraph", () => {
		expect(
			finalHandoffAgent(
				memberIds,
				"API contract ready.\n\n@frontend Review the client boundary.",
				agents,
			),
		).toBe("frontend");
	});

	it.each([
		"I agree with @backend on the API boundary.",
		"From @backend:\n\nAPI contract ready.",
		"> @backend Review the client boundary.",
		"`@backend` is the documented handle.",
	])("does not route quoted or incidental peer text: %s", (text) => {
		expect(finalHandoffAgent(memberIds, text, agents)).toBeUndefined();
	});
});
