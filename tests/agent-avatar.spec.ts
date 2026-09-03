import { describe, expect, it } from "vitest";
import {
	agentAvatarStyle,
	agentAvatarText,
} from "../ui/src/design-system/AgentAvatar.tsx";

describe("agent avatar identity", () => {
	it("prefers the configured emoji and falls back to the display name", () => {
		expect(agentAvatarText({ displayName: "Atlas", avatarEmoji: "🧭" })).toBe(
			"🧭",
		);
		expect(agentAvatarText({ displayName: "Atlas", avatarEmoji: "" })).toBe(
			"A",
		);
		expect(agentAvatarText({ displayName: "" })).toBe("?");
	});

	it("turns the configured accent into the avatar appearance", () => {
		expect(agentAvatarStyle("#7c3aed")).toEqual({
			backgroundColor: "#7c3aed",
			color: "#fff",
		});
		expect(agentAvatarStyle(undefined)).toBeUndefined();
	});
});
