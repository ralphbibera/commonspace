import { readHarnessCommand } from "./discovery.js";
import type { AgentAdapterConfig, NativeAgentAdapter } from "./types.js";

/** Later releases regress ACP history reload; expand only after native fixture verification. */
export function assertGeminiAcpVersion(output: string): void {
	const version = output.trim().replace(/^v/u, "");
	if (/^0\.(39|4[0-3])\.\d+$/u.test(version) && version !== "0.39.0") return;
	throw new Error(
		"Gemini CLI requires >=0.39.1 and <0.44.0 for verified ACP session continuity. Use 0.43.0; newer versions need revalidation after observed resume regressions.",
	);
}

export function createGeminiAdapter(
	config: AgentAdapterConfig,
): NativeAgentAdapter {
	const cliPath = config.geminiPath ?? "gemini";
	const command = config.geminiAcpCommand ?? cliPath;
	const args = [...(config.geminiAcpArgs ?? ["--acp"])];
	return {
		privatePaths: [
			cliPath,
			command,
			...args,
			...[
				process.env.GEMINI_CLI_HOME,
				process.env.GEMINI_CLI_SYSTEM_SETTINGS_PATH,
				process.env.GEMINI_CLI_SYSTEM_DEFAULTS_PATH,
			].filter((path): path is string => path !== undefined),
		],
		async discover() {
			assertGeminiAcpVersion(await readHarnessCommand(cliPath, ["--version"]));
			return [
				{
					id: "gemini",
					displayName: "Gemini CLI",
					adapter: "gemini",
					model: null,
					status: "stopped",
					description: "Installed Gemini CLI harness.",
				},
			];
		},
		async launch(_agent, _fullAccess, signal) {
			// Recheck at launch in case an installed CLI was upgraded after discovery.
			assertGeminiAcpVersion(
				await readHarnessCommand(cliPath, ["--version"], signal),
			);
			return { command, args, env: { ...process.env, NO_BROWSER: "1" } };
		},
		sessionSettings({ fullAccess, model }) {
			const settings: ReturnType<NativeAgentAdapter["sessionSettings"]> = {
				modeId: fullAccess ? "yolo" : "default",
			};
			if (model !== undefined) settings.modelId = model;
			return settings;
		},
	};
}
