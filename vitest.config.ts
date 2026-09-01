import { fileURLToPath } from "node:url";
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
		environment: "jsdom",
		clearMocks: true,
		restoreMocks: true,
	},
});
