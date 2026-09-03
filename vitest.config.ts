import { fileURLToPath } from "node:url";
import process from "node:process";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./ui/src", import.meta.url)),
			"@commonspace/shared": fileURLToPath(
				new URL("./packages/shared/src/index.ts", import.meta.url),
			),
		},
	},
	test: {
		environment: "node",
		testTimeout: 30_000,
		hookTimeout: 30_000,
		clearMocks: true,
		restoreMocks: true,
	},
});
