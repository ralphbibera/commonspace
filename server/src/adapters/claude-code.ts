import { createRequire } from "node:module";
import { readHarnessCommand } from "./discovery.js";
import type { AgentAdapterConfig, NativeAgentAdapter } from "./types.js";

const moduleRequire = createRequire(import.meta.url);

export function createClaudeCodeAdapter(
	config: AgentAdapterConfig,
): NativeAgentAdapter {
	const cliPath = config.claudeCodePath ?? "claude";
	const command = config.claudeCodeAcpCommand ?? process.execPath;
	const args =
		config.claudeCodeAcpArgs === undefined
			? config.claudeCodeAcpCommand === undefined
				? [
						moduleRequire.resolve(
							"@agentclientprotocol/claude-agent-acp/dist/index.js",
						),
					]
				: []
			: [...config.claudeCodeAcpArgs];
	return {
		privatePaths: [cliPath, command, ...args],
		async discover() {
			await readHarnessCommand(cliPath, ["--version"]);
			return [
				{
					id: "claude-code",
					displayName: "Claude Code",
					adapter: "claude-code",
					model: null,
					status: "stopped",
					description: "Installed Claude Code harness.",
				},
			];
		},
		launch() {
			return {
				command,
				args,
				env: {
					...process.env,
					CLAUDE_CODE_EXECUTABLE: cliPath,
					NO_BROWSER: "1",
				},
			};
		},
		sessionSettings({ fullAccess, model, reasoning }) {
			const configOptions: Record<string, string> = {};
			if (model !== undefined) configOptions.model = model;
			// Only map native effort levels; unsupported workspace choices leave Claude's default intact.
			if (
				reasoning === "low" ||
				reasoning === "medium" ||
				reasoning === "high" ||
				reasoning === "max"
			)
				configOptions.effort = reasoning;
			return {
				modeId: fullAccess ? "bypassPermissions" : "default",
				configOptions,
			};
		},
	};
}
