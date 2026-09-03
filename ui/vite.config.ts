import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { apiProxy } from "./vite-api-proxy.ts";

const initialChunkTag: ["$initial"] = ["$initial"];

export const initialChunkGroups = [
	{
		name: "react-runtime",
		test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
		tags: initialChunkTag,
		priority: 30,
	},
	{
		name: "ui-primitives",
		test: /node_modules[\\/]@(?:base-ui|floating-ui)[\\/]/,
		tags: initialChunkTag,
		priority: 20,
	},
	{
		name: "vendor",
		test: /node_modules[\\/]/,
		tags: initialChunkTag,
		priority: 10,
	},
];

export default defineConfig({
	plugins: [react(), tailwindcss()],
	build: {
		rolldownOptions: {
			output: {
				codeSplitting: { groups: initialChunkGroups },
			},
		},
	},
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
			"@commonspace/shared": fileURLToPath(
				new URL("../packages/shared/src/index.ts", import.meta.url),
			),
		},
	},
	server: {
		host: "127.0.0.1",
		port: 5173,
		proxy: {
			"/api": apiProxy(),
		},
	},
	preview: {
		host: "127.0.0.1",
		port: 4173,
		proxy: {
			"/api": apiProxy(),
		},
	},
});
