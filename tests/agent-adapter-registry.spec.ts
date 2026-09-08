import { AGENT_ADAPTER_KINDS } from "@commonspace/shared";
import { expect, it } from "vitest";

it("keeps Hermes near the top of the built-in harness picker", () => {
	expect(AGENT_ADAPTER_KINDS.slice(0, 2)).toEqual(["codex", "hermes"]);
});
