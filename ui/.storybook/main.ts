import process from "node:process";
import type { StorybookConfig } from "@storybook/react-vite";

const testing = process.env.COMMONSPACE_STORYBOOK_TEST === "1";

const config: StorybookConfig = {
	stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
	addons: [
		...(testing ? [] : ["@chromatic-com/storybook"]),
		"@storybook/addon-vitest",
		"@storybook/addon-a11y",
		"@storybook/addon-docs",
	],
	framework: "@storybook/react-vite",
};
export default config;
