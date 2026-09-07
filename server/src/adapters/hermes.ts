import {
	parseHermesProfileDescription,
	parseHermesProfileList,
} from "../relay.js";
import {
	inspectCommandCapabilities,
	parseTerminalInventory,
	unavailableGroup,
} from "./capability-inventory.js";
import { readHarnessCommand } from "./discovery.js";
import type { AgentAdapterConfig, NativeAgentAdapter } from "./types.js";

export function createHermesAdapter(
	config: AgentAdapterConfig,
): NativeAgentAdapter {
	const cliPath = config.hermesPath ?? "hermes";
	const command = config.hermesAcpCommand ?? cliPath;
	const args = [...(config.hermesAcpArgs ?? [])];
	return {
		privatePaths: [cliPath, command, ...args],
		inspectCapabilities(agent) {
			const profileArgs = agent.id === "hermes" ? [] : ["-p", agent.id];
			const probe = (
				id: "mcp" | "skills" | "plugins" | "memory",
				args: readonly string[],
				notice: string,
			) => ({
				id,
				args: [...profileArgs, ...args],
				source: `hermes ${args.join(" ")}`,
				notice,
				parse: parseTerminalInventory,
			});
			return inspectCommandCapabilities(
				cliPath,
				[
					probe(
						"mcp",
						["mcp", "list"],
						"MCP server names and native enabled state for this Hermes profile.",
					),
					probe(
						"skills",
						["skills", "list"],
						"Installed skill names and native state for this Hermes profile.",
					),
					probe(
						"memory",
						["memory", "status"],
						"Memory provider status only; memory contents and host paths remain private.",
					),
					probe(
						"plugins",
						["plugins", "capabilities"],
						"Plugin capability names reported by Hermes for this profile.",
					),
				],
				[
					unavailableGroup(
						"tools",
						"Hermes profile configuration",
						"Tool listing can execute native plugin hooks; unavailable during read-only inspection.",
					),
					unavailableGroup(
						"agents",
						"Hermes profile configuration",
						"Hermes profiles do not expose a nested agent inventory.",
					),
				],
			);
		},
		async discover() {
			const profiles = parseHermesProfileList(
				await readHarnessCommand(cliPath, ["profile", "list"]),
			);
			return Promise.all(
				profiles.map(async (profile) => {
					try {
						const description = parseHermesProfileDescription(
							await readHarnessCommand(cliPath, [
								"profile",
								"describe",
								profile.id,
							]),
						);
						return description === undefined
							? profile
							: { ...profile, description };
					} catch {
						// Optional descriptions do not invalidate a discovered native profile.
						return profile;
					}
				}),
			);
		},
		launch(agent, fullAccess) {
			return {
				command,
				args: [
					...args,
					...(agent.id === "hermes" ? [] : ["-p", agent.id]),
					"acp",
					...(fullAccess ? ["--accept-hooks"] : []),
				],
				env: { ...process.env, NO_BROWSER: "1" },
			};
		},
		sessionSettings({ fullAccess, model }) {
			const settings: ReturnType<NativeAgentAdapter["sessionSettings"]> = {
				modeId: fullAccess ? "dont_ask" : "accept_edits",
			};
			if (model !== undefined) settings.modelId = model;
			return settings;
		},
	};
}
