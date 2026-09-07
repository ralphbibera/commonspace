import { access, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { HarnessCapabilityGroup } from "@commonspace/shared";
import { unavailableGroup } from "./capability-inventory.js";
import { inspectMcpMetadata } from "./capability-metadata.js";
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
		inspectCapabilities() {
			const source = "Gemini CLI user configuration";
			const root = join(process.env.GEMINI_CLI_HOME ?? homedir(), ".gemini");
			return Promise.all([
				unavailableGroup(
					"tools",
					source,
					"This verified Gemini CLI version has no bounded read-only tool listing.",
				),
				inspectMcpMetadata(
					[join(root, "settings.json")],
					"mcpServers",
					"Gemini CLI user settings metadata",
				),
				inspectGeminiDirectory("skills", join(root, "skills")),
				inspectGeminiDirectory("plugins", join(root, "extensions")),
				unavailableGroup(
					"memory",
					source,
					"Memory contents and host paths remain private.",
				),
				unavailableGroup(
					"agents",
					source,
					"Gemini CLI does not expose a configured-agent inventory.",
				),
			]);
		},
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

async function inspectGeminiDirectory(
	id: "skills" | "plugins",
	path: string,
): Promise<HarnessCapabilityGroup> {
	try {
		const entries = await readdir(path, { withFileTypes: true });
		const marker = id === "skills" ? "SKILL.md" : "gemini-extension.json";
		const names = await Promise.all(
			entries
				.filter(
					(entry) => entry.isDirectory() && isSafeMetadataName(entry.name),
				)
				.map(async (entry) => {
					try {
						await access(join(path, entry.name, marker));
						return entry.name;
					} catch {
						return undefined;
					}
				}),
		);
		return {
			id,
			status: "available",
			source: `Gemini CLI user ${id} metadata`,
			notice: `Configured user ${id} names only; contents and host paths remain private.`,
			items: names
				.filter((name): name is string => name !== undefined)
				.map((name) => ({ name, status: "configured" })),
		};
	} catch (error) {
		if (error instanceof Error && isMissing(error))
			return {
				id,
				status: "available",
				source: `Gemini CLI user ${id} metadata`,
				notice: `No user ${id} directory is present.`,
				items: [],
			};
		return {
			id,
			status: "error",
			source: `Gemini CLI user ${id} metadata`,
			notice: `Native ${id} metadata could not be inspected.`,
			items: [],
		};
	}
}

function isSafeMetadataName(name: string): boolean {
	return /^[\p{L}\p{N}][\p{L}\p{N} ._:@()+-]{0,119}$/u.test(name);
}

function isMissing(error: Error): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}
