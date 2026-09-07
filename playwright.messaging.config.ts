import { defineConfig } from "@playwright/test";
import visualConfig from "./playwright.visual.config";

export default defineConfig(visualConfig, {
	testMatch: ["storybook-messaging.spec.ts"],
	reporter: [["list"]],
	outputDir: "artifacts/playwright-messaging-results",
});
