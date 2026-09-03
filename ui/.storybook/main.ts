import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
	stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
	addons: [
		"@chromatic-com/storybook",
		"@storybook/addon-vitest",
		"@storybook/addon-a11y",
		"@storybook/addon-docs",
		"@storybook/addon-mcp",
	],
	features: {
		componentsManifest: true,
	},
	framework: {
		name: "@storybook/react-vite",
		options: {},
	},
	viteFinal: async (viteConfig) =>
		mergeConfig(viteConfig, {
			resolve: {
				alias: {
					"@": path.join(dirname, "../src"),
					"@commonspace/shared": path.join(
						dirname,
						"../../packages/shared/src/index.ts",
					),
				},
			},
		}),
};

export default config;
