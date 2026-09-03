// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format

import js from "@eslint/js";
import storybook from "eslint-plugin-storybook";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: [
			"**/artifacts/**",
			"**/coverage/**",
			"**/dist/**",
			"**/lib/**",
			"**/node_modules/**",
			"**/playwright-report/**",
			"**/storybook-static/**",
			"**/test-results/**",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.{ts,tsx}"],
		rules: {
			"@typescript-eslint/consistent-type-imports": [
				"error",
				{ prefer: "type-imports" },
			],
		},
	},
	{
		files: ["**/*.{js,mjs,cjs}"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			globals: {
				clearTimeout: "readonly",
				console: "readonly",
				fetch: "readonly",
				process: "readonly",
				setTimeout: "readonly",
			},
		},
	},
	storybook.configs["flat/recommended"],
);
