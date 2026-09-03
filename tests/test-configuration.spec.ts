// @vitest-environment node

import { describe, expect, it } from "vitest";
import config from "../vitest.config.ts";

describe("test configuration", () => {
	it("uses the lightweight Node environment by default and opts browser tests into jsdom", () => {
		expect(config).toMatchObject({
			test: {
				environment: "node",
				setupFiles: ["./tests/test-setup.ts"],
			},
		});
	});

	it("blocks accidental calls to external services", async () => {
		await expect(fetch("https://example.test/path")).rejects.toThrow(
			"External network access is disabled in tests (https://example.test)",
		);
	});
});
