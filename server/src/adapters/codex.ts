import { createRequire } from "node:module";
import { readHarnessCommand } from "./discovery.js";
import type { AgentAdapterConfig, NativeAgentAdapter } from "./types.js";

const moduleRequire = createRequire(import.meta.url);

export function createCodexAdapter(
	config: AgentAdapterConfig,
): NativeAgentAdapter {
	const cliPath = config.codexPath ?? "codex";
	const command = config.codexAcpCommand ?? process.execPath;
	const args =
		config.codexAcpArgs === undefined
			? config.codexAcpCommand === undefined
				? [moduleRequire.resolve("@agentclientprotocol/codex-acp")]
				: []
			: [...config.codexAcpArgs];
	return {
		privatePaths: [cliPath, command, ...args],
		async discover() {
			await readHarnessCommand(cliPath, ["--version"]);
			return [
				{
					id: "codex",
					displayName: "Codex",
					adapter: "codex",
					model: null,
					status: "stopped",
					description: "Installed Codex harness.",
				},
			];
		},
		launch(_agent, fullAccess) {
			return {
				command,
				args,
				env: {
					...process.env,
					CODEX_PATH: cliPath,
					INITIAL_AGENT_MODE: fullAccess ? "agent-full-access" : "agent",
					NO_BROWSER: "1",
				},
			};
		},
		sessionSettings({ fullAccess, model, reasoning }) {
			const configOptions: Record<string, string> = {};
			if (model !== undefined) configOptions.model = model;
			if (reasoning !== undefined)
				configOptions.reasoning_effort =
					reasoning === "none" || reasoning === "minimal" ? "low" : reasoning;
			return {
				modeId: fullAccess ? "agent-full-access" : "agent",
				configOptions,
			};
		},
	};
}
