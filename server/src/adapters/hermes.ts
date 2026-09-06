import {
	parseHermesProfileDescription,
	parseHermesProfileList,
} from "../relay.js";
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
