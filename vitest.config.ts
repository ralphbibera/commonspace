import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
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
		projects: [
			{
				extends: true,
				test: {
					environment: "node",
					testTimeout: 30_000,
					hookTimeout: 30_000,
					clearMocks: true,
					restoreMocks: true,
				},
			},
			{
				extends: true,
				plugins: [
					// The plugin will run tests for the stories defined in your Storybook config
					// See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
					storybookTest({
						configDir: path.join(dirname, "ui/.storybook"),
					}),
				],
				test: {
					name: "storybook",
					fileParallelism: false,
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({}),
						instances: [
							{
								browser: "chromium",
							},
						],
					},
				},
			},
		],
	},
});
