import type { AgentAdapterKind } from "@commonspace/shared";
import { createClaudeCodeAdapter } from "./claude-code.js";
import { createCodexAdapter } from "./codex.js";
import { createGeminiAdapter } from "./gemini.js";
import { createHermesAdapter } from "./hermes.js";
import { createOpenCodeAdapter } from "./opencode.js";
import type { AgentAdapterConfig, NativeAgentAdapter } from "./types.js";

export type { AgentAdapterConfig, NativeAgentAdapter } from "./types.js";

/** Exhaustive registration keeps new harnesses from falling through to another runtime. */
export function createAgentAdapters(
	config: AgentAdapterConfig,
): Record<AgentAdapterKind, NativeAgentAdapter> {
	return {
		codex: createCodexAdapter(config),
		hermes: createHermesAdapter(config),
		"claude-code": createClaudeCodeAdapter(config),
		gemini: createGeminiAdapter(config),
		opencode: createOpenCodeAdapter(config),
	};
}
