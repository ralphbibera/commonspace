import { describe, expect, it, vi } from "vitest";
import { forwardBrowserHost } from "../ui/vite-api-proxy.ts";
import { initialChunkGroups } from "../ui/vite.config.ts";

describe("Vite API proxy", () => {
	it("forwards actual browser host when Vite selects an alternate port", () => {
		const setHeader = vi.fn();
		forwardBrowserHost({ setHeader }, { headers: { host: "127.0.0.1:5174" } });

		expect(setHeader).toHaveBeenCalledWith(
			"x-forwarded-host",
			"127.0.0.1:5174",
		);
	});

	it("keeps initial framework dependencies in stable cacheable chunks", () => {
		expect(
			initialChunkGroups.map(({ name, tags }) => ({ name, tags })),
		).toEqual([
			{ name: "react-runtime", tags: ["$initial"] },
			{ name: "ui-primitives", tags: ["$initial"] },
			{ name: "vendor", tags: ["$initial"] },
		]);
	});
});
