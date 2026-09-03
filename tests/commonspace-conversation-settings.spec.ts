import { describe, expect, it } from "vitest";
import { matchesContextSettingsRequest } from "../ui/src/CommonspaceConversation.tsx";

describe("agent profile settings routing", () => {
	it("keeps an agent settings request attached to the matching DM", () => {
		expect(
			matchesContextSettingsRequest(
				{ kind: "agent", id: "backend", token: 1 },
				{ kind: "dm", id: "backend" },
			),
		).toBe(true);
	});

	it("does not attach an agent settings request to another conversation", () => {
		expect(
			matchesContextSettingsRequest(
				{ kind: "agent", id: "backend", token: 1 },
				{ kind: "dm", id: "frontend" },
			),
		).toBe(false);
	});
});
