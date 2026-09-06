/** Supported, built-in harnesses. Never populate this from user-supplied commands. */
export const AGENT_ADAPTER_KINDS = [
	"codex",
	"claude-code",
	"gemini",
	"opencode",
	"hermes",
] as const;

export type AgentAdapterKind = (typeof AGENT_ADAPTER_KINDS)[number];

export const AGENT_ADAPTERS = {
	codex: {
		label: "Codex",
		monogram: "C",
		recovery:
			"Run codex --version, then authenticate with the installed Codex CLI and retry from Commonspace.",
	},
	hermes: {
		label: "Hermes",
		monogram: "H",
		recovery:
			"Run hermes --version, authenticate with Hermes, verify hermes acp starts, then retry from Commonspace.",
	},
	"claude-code": {
		label: "Claude Code",
		monogram: "CC",
		recovery:
			"Run claude --version and claude auth status, authenticate with Claude Code, then retry from Commonspace. Use COMMONSPACE_CLAUDE_CODE_PATH for a custom CLI installation.",
	},
	gemini: {
		label: "Gemini CLI",
		monogram: "G",
		recovery:
			"Use Gemini CLI 0.43.0 (verified ACP range: >=0.39.1, <0.44.0), configure native authentication, then retry. Newer releases are withheld after session-resume regressions. COMMONSPACE_GEMINI_PATH selects the CLI.",
	},
	opencode: {
		label: "OpenCode",
		monogram: "OC",
		recovery:
			"Run opencode --version, configure its provider and model, then retry from Commonspace. Use COMMONSPACE_OPENCODE_PATH for a custom CLI installation.",
	},
} as const satisfies Record<
	AgentAdapterKind,
	{
		label: string;
		monogram: string;
		recovery: string;
	}
>;

export function isAgentAdapterKind<T>(value: T): value is T & AgentAdapterKind {
	return AGENT_ADAPTER_KINDS.some((kind) => kind === value);
}
