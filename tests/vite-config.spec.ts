import { describe, expect, it, vi } from "vitest";
import { forwardBrowserHost } from "../ui/vite-api-proxy.ts";

describe("Vite API proxy", () => {
	it("forwards actual browser host when Vite selects an alternate port", () => {
		const setHeader = vi.fn();
		forwardBrowserHost({ setHeader }, { headers: { host: "127.0.0.1:5174" } });

		expect(setHeader).toHaveBeenCalledWith(
			"x-forwarded-host",
			"127.0.0.1:5174",
		);
	});
});
