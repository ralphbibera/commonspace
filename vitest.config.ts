import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@": path.join(dirname, "ui/src"),
			"@commonspace/shared": path.join(
				dirname,
				"packages/shared/src/index.ts",
			),
		},
	},
	test: {
		environment: "node",
		setupFiles: ["./tests/test-setup.ts"],
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"**/.git/**",
			"**/.cache/**",
			"**/coverage/**",
			"**/storybook-static/**",
			"tests/e2e/**",
			"tests/storybook-visual.spec.ts",
		],
		...(process.env.CI === "true" ? { maxWorkers: 2 } : {}),
		testTimeout: 30_000,
		hookTimeout: 30_000,
		clearMocks: true,
		restoreMocks: true,
	},
});
