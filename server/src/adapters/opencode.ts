import { readHarnessCommand } from "./discovery.js";
import type { AgentAdapterConfig, NativeAgentAdapter } from "./types.js";

export function createOpenCodeAdapter(
	config: AgentAdapterConfig,
): NativeAgentAdapter {
	const cliPath = config.opencodePath ?? "opencode";
	const command = config.opencodeAcpCommand ?? cliPath;
	const args = [...(config.opencodeAcpArgs ?? ["acp"])];
	return {
		privatePaths: [
			cliPath,
			command,
			...args,
			...[
				process.env.XDG_CONFIG_HOME,
				process.env.XDG_DATA_HOME,
				process.env.XDG_CACHE_HOME,
				process.env.XDG_STATE_HOME,
				process.env.OPENCODE_CONFIG,
				process.env.OPENCODE_CONFIG_DIR,
			].filter((path): path is string => path !== undefined),
		],
		async discover() {
			await readHarnessCommand(cliPath, ["--version"]);
			return [
				{
					id: "opencode",
					displayName: "OpenCode",
					adapter: "opencode",
					model: null,
					status: "stopped",
					description: "Installed OpenCode harness.",
				},
			];
		},
		launch(_agent, fullAccess) {
			const env: NodeJS.ProcessEnv = { ...process.env, NO_BROWSER: "1" };
			if (fullAccess)
				env.OPENCODE_PERMISSION = JSON.stringify({ "*": "allow" });
			return { command, args, env };
		},
		sessionSettings({ model, reasoning }) {
			const configOptions: Record<string, string> = {};
			if (model !== undefined) configOptions.model = model;
			if (reasoning !== undefined) configOptions.effort = reasoning;
			return { configOptions };
		},
	};
}
