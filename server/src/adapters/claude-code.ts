import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	inspectCommandCapabilities,
	parseNamedJsonInventory,
	parseTerminalInventory,
	unavailableGroup,
} from "./capability-inventory.js";
import {
	inspectMcpMetadata,
	inspectUserSkills,
} from "./capability-metadata.js";
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
		async inspectCapabilities() {
			const source = "Claude Code user configuration";
			const configRoot =
				process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
			const legacyConfig = join(configRoot, ".config.json");
			const mcp = await inspectMcpMetadata(
				[
					existsSync(legacyConfig)
						? legacyConfig
						: join(process.env.CLAUDE_CONFIG_DIR ?? homedir(), ".claude.json"),
				],
				"mcpServers",
				"Claude Code user MCP metadata",
			);
			const skills = await inspectUserSkills(
				[
					join(
						process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"),
						"skills",
					),
				],
				"Claude Code user skill directory metadata",
			);
			return inspectCommandCapabilities(
				cliPath,
				[
					{
						id: "plugins",
						args: ["plugin", "list", "--json"],
						source: "claude plugin list --json",
						notice: "Installed plugin names and native state from Claude Code.",
						parse: parseNamedJsonInventory,
					},
					{
						id: "agents",
						args: ["agents", "--setting-sources", "user"],
						source: "claude agents --setting-sources user",
						notice:
							"Configured user agent names; prompts and configuration remain private.",
						parse: parseTerminalInventory,
					},
				],
				[
					unavailableGroup(
						"tools",
						source,
						"Claude Code does not expose the effective tool inventory without starting a session.",
					),
					mcp,
					skills,
					unavailableGroup(
						"memory",
						source,
						"Memory contents and host paths remain private.",
					),
				],
			);
		},
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
