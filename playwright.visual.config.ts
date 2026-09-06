import { defineConfig } from "@playwright/test";

const USE_SYSTEM_CHROME = process.env.COMMONSPACE_USE_SYSTEM_CHROME === "1";

export default defineConfig({
	testDir: "./tests",
	testMatch: ["storybook-visual.spec.ts", "storybook-interactions.spec.ts"],
	timeout: 30_000,
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	workers: 1,
	reporter: [
		["list"],
		[
			"html",
			{
				outputFolder: "artifacts/playwright-visual-report",
				open: "never",
			},
		],
	],
	outputDir: "artifacts/playwright-visual-results",
	expect: {
		toHaveScreenshot: {
			animations: "disabled",
			caret: "hide",
			scale: "css",
			threshold: 0.01,
		},
	},
	use: {
		baseURL: "http://127.0.0.1:6006",
		channel: USE_SYSTEM_CHROME ? "chrome" : undefined,
		colorScheme: "light",
		trace: "retain-on-failure",
		deviceScaleFactor: 1,
		locale: "en-US",
		timezoneId: "Asia/Manila",
		viewport: { width: 1180, height: 820 },
	},
	webServer: {
		command:
			"pnpm --filter @commonspace/ui exec storybook dev --ci --no-open --port 6006",
		url: "http://127.0.0.1:6006/index.json",
		reuseExistingServer: true,
		timeout: 120_000,
	},
});
