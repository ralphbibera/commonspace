# Add support for an agent harness

Use this guide to add a supported native harness to Commonspace. Start from the [adapter proposal template](agent-adapter-template.md), then use [Claude Code](../../server/src/adapters/claude-code.ts) as the smallest complete implementation.

An adapter connects an installed agent to the workspace. It discovers existing identities and translates Commonspace settings into that harness's ACP controls. Credentials, tools, models, native configuration, and transcripts remain owned by the harness. Adding an adapter does not create Commonspace personas or install a runtime for the user.

## Supported adapters

| Adapter ID | Discovery | ACP process | Native identity |
| --- | --- | --- | --- |
| `codex` | `codex --version` | Bundled `@agentclientprotocol/codex-acp` | Installed Codex harness |
| `hermes` | `hermes profile list`, optional `profile describe` | Installed `hermes [-p <profile>] acp` | Each existing Hermes profile |
| `claude-code` | `claude --version` | Bundled `@agentclientprotocol/claude-agent-acp` | Installed Claude Code harness |
| `gemini` | `gemini --version`, supported-version check | Installed `gemini --acp` | Installed Gemini CLI harness |
| `opencode` | `opencode --version` | Installed `opencode acp` | Installed OpenCode harness |

The initial general-purpose baseline is Codex, Claude Code, Gemini CLI, and OpenCode; Hermes remains supported. Pi coding agent is a follow-up: its adapter must pass the same scoped MCP and native-session checks before registration. See the [support matrix](../start/support.md#agent-runtimes) for version limits.

Discovery checks installation, not authentication or model access. Diagnostics report those separately as run readiness. Discovery is explicit: startup and bootstrap never launch a discovery command. The Add Agent flow sends both adapter and native ID, so matching IDs across harnesses cannot select a different runtime. Legacy ID-only requests are rejected when ambiguous. Existing roster IDs remain unique. The flow probes only the chosen harness; diagnostics and explicit addition without a cached candidate can probe the registered set.

## Ownership and format

```text
packages/shared/src/agent-adapters.ts   IDs, display metadata, runtime guard
server/src/adapters/
  types.ts                            NativeAgentAdapter contract
  index.ts                            Exhaustive built-in registry
  discovery.ts                        Bounded discovery subprocesses
  <adapter-id>.ts                      Harness discovery, launch, settings
docs/adapters/agent-adapter-template.md Proposal and verification record
```

The shared catalog contains browser-safe metadata only. The server registry is a `Record<AgentAdapterKind, NativeAgentAdapter>`: registering a shared ID without implementing its runtime fails type checking. The HTTP schema, Add Agent choices, diagnostics, runtime labels, and activity validator use that catalog. Arbitrary executable names from HTTP requests cannot register an adapter.

Every configured adapter implements these members:

| Member | Responsibility |
| --- | --- |
| `privatePaths` | List configured executable paths and argument paths for the host's redaction boundary. Never send them to the browser. |
| `discover()` | Return existing `CommonspaceAgentProfile` identities. Use bounded commands; do not authenticate, start a model turn, inspect credentials, or mutate native profiles. Throw installation failures; the host logs once and reports no candidates. |
| `launch(agent, fullAccess, signal)` | Return executable, argument array, and environment, synchronously or asynchronously. Honor cancellation during preflight checks and select the exact native identity. Never construct shell command strings. |
| `sessionSettings(input)` | Return native ACP mode, model, and config IDs. Leave unsupported settings absent. `AcpAgentProcess` applies controls only when the session advertises them. Model selection precedes model-dependent settings; finite choices are checked against refreshed options, while native model aliases remain available. |

The adapter does not implement its own message queue, subprocess pool, permission UI, transcript parser, or session persistence. `AcpAgentProcess` owns ACP framing, session setup, updates, cancellation, and process disposal. `CommonspaceHostService` owns durable acceptance, per-session serialization, independent concurrency, context scope, private session references, and recovery.

## Implementation checklist

1. **Establish the native contract.** Verify the maintained bridge package and pinned version, installation/auth commands, identity discovery, `session/new`, exact `session/load`, cancellation, and MCP support against primary documentation and the shipped package. Record gaps in the proposal. An arbitrary text CLI is insufficient.
2. **Register metadata.** Add the stable ID and metadata to `AGENT_ADAPTER_KINDS` and `AGENT_ADAPTERS`. IDs become persisted data; do not rename released IDs without migration.
3. **Implement the adapter.** Add one server module and register its factory in `createAgentAdapters`. Prefer the existing ACP transport and bounded discovery helper. Preserve native configuration and auth. A built-in bridge belongs in `server/package.json` with an exact version and lockfile entry.
4. **Define identity validation.** Update `addDiscoveredAgent` in `server/src/state.ts` and `sanitizeAgents` in `server/src/service.ts`. Allow only identities discovery actually returns. Keep legacy identities loadable where history requires them. New persisted shapes or enum members require a state version and migration review, including trace and archive round trips.
5. **Wire private configuration.** Add typed path overrides in `AgentAdapterConfig`, map environment variables in `server/src/index.ts`, and document defaults in [Operations](../guides/operations.md#runtime-configuration). Add every configured private path to the adapter's redaction list. Do not expose command configuration in browser contracts.
6. **Verify without an account.** Exercise the real bridge and native runtime against a local model API fixture where the runtime supports one. Keep credentials and user configuration isolated. Synthetic ACP fixtures cover Commonspace policy but cannot establish real bridge compatibility. Include this check in normal CI; keep remote provider checks opt-in.
7. **Verify the complete flow.** Exercise explicit discovery and addition, absent installation, renamed display identity, DM and Thread continuity, service restart, `/new`, permissions, stop, emitted activity, privacy, and scoped MCP. Use existing shared lifecycle coverage for transport behavior and add focused cases for new policy.
8. **Synchronize documentation.** Update only affected canonical docs. Record release notes with the release.

## Session and capability rules

- Preserve opaque native session IDs for the same conversation scope. Resume the saved ID after restart; never use a runtime's “most recent conversation” shortcut.
- Start a different native session for a new Thread or DM generation. `/new` cancels old work and prevents stale replies from entering the replacement generation.
- Recover with a new session only for explicit missing-session errors. Authentication and transport failures retain the saved reference. Hermes has a documented compatibility path for a silent persisted session; new adapters must not inherit that exception.
- Pass only the new message or assigned request as the native turn. Deliver shared context through the scoped Commonspace MCP endpoint; never prepend the whole room transcript.
- Expose only emitted activity, supported controls, and native permission options. Do not invent tools, models, reasoning levels, or approval choices.
- Full access must be an explicit workspace choice or documented operator setting. Ordinary operation uses the adapter's native permission configuration. Permission requests block only their session. Changing effective access replaces cached processes while retaining native session references; either access change cancels that agent's active work and pending permissions. Queued work reads the current access policy before launch.
- No shell interpolation, credential copies, global native configuration writes, or native-session paths in bootstrap, activity, errors, or portable archives.

## Claude Code setup

Install and authenticate [Claude Code](https://code.claude.com/docs/en/quickstart) separately. Confirm `claude --version` and `claude auth status`, then choose **Add Agent → Claude Code → Add discovered agent Claude Code**. A custom executable uses an absolute path in `COMMONSPACE_CLAUDE_CODE_PATH`. Commonspace passes that executable to the bridge through `CLAUDE_CODE_EXECUTABLE`; the bridge uses native Claude authentication and configuration.

The adapter pins [`@agentclientprotocol/claude-agent-acp`](https://github.com/agentclientprotocol/claude-agent-acp) and launches its executable entry point with Node. This is the maintained successor to `@zed-industries/claude-code-acp`. The normal ACP mode is `default`; explicit Full access requests `bypassPermissions`. Model selection uses ACP `model`. Native effort levels `low`, `medium`, `high`, and `max` map to `effort`; other Commonspace reasoning values leave the native default intact. Controls still depend on the bridge's advertised capabilities.

One Claude Code identity is added. Claude subagent definitions, plugins, memory files, and credentials remain managed by Claude. Commonspace does not turn `.claude/agents` entries into separate workspace identities.

## Gemini CLI and OpenCode setup

[Gemini CLI](https://geminicli.com/docs/cli/acp-mode/) supplies ACP directly through `gemini --acp`. Commonspace currently accepts stable versions `>=0.39.1` and `<0.44.0`; use tested version `0.43.0`. Discovery and each process launch recheck the version. Expand the range only after the real runtime fixture passes. The normal mode is `default`; Full access requests `yolo`. Model selection uses the advertised native model control. Reasoning settings remain native defaults.

[OpenCode](https://opencode.ai/docs/acp/) supplies ACP through `opencode acp`; version `1.18.29` is covered by the real runtime fixture. Its normal permissions come from native configuration. Explicit Full access sets `OPENCODE_PERMISSION` to `{"*":"allow"}` for the child process only. Native `build` and `plan` modes are agent choices, so Commonspace does not treat them as approval modes. Model and effort settings use advertised ACP config options.

Configure authentication and model access in each native runtime, then choose **Add Agent → Gemini CLI** or **Add Agent → OpenCode**. Each adds one native harness identity. Private executable overrides are `COMMONSPACE_GEMINI_PATH` and `COMMONSPACE_OPENCODE_PATH`; optional ACP executable overrides use `COMMONSPACE_GEMINI_ACP_PATH` and `COMMONSPACE_OPENCODE_ACP_PATH`. Commonspace does not copy credentials or rewrite native configuration.

## Verification commands

Use [Development](../guides/development.md) for general checks. Adapter-specific checks:

```bash
pnpm verify:adapters
pnpm verify:adapter:claude-code
pnpm verify:adapter:gemini
pnpm verify:adapter:opencode
```

Provider-backed harness checks are opt-in and may consume model usage. Run them only with the relevant installed, authenticated runtime. They use a temporary Commonspace workspace:

```bash
pnpm verify:acp:claude-code
pnpm verify:acp:mcp:claude-code
```

The first check starts Claude, restarts the service, and verifies native recall using the saved session. The second verifies scoped Channel context and visible progress through MCP. Record the exact CLI/bridge versions and results; a passing synthetic ACP test does not establish real bridge compatibility.

### Account-free runtime verification

`pnpm verify:adapters` runs the pinned real Claude Code, Gemini CLI, and OpenCode runtimes against loopback Anthropic Messages and Gemini API fixtures. Run one harness with `pnpm verify:adapter:claude-code`, `pnpm verify:adapter:gemini`, or `pnpm verify:adapter:opencode`. Each child receives an explicit environment, synthetic credentials, and temporary native configuration/session directories. No login, provider key, or separately installed CLI is needed. Gemini CLI and OpenCode are development-only test dependencies; production uses the user's installed executables. These tests also run in `pnpm test` and `pnpm check`.

The fixture replaces only model responses. The real runtime stores and reloads native history, calls the real Commonspace MCP endpoint, receives permission choices, and posts progress through the real HTTP service. Tests assert exact session continuity after service restart, `/new` context isolation, scoped context without unrelated Channel data, and persisted progress. A separate shutdown regression verifies that the bridge can flush its native child before forced termination.

Verified runtimes: `@agentclientprotocol/claude-agent-acp` 0.75.0 with bundled Claude Code 2.1.257, `@google/gemini-cli` 0.43.0, and `opencode-ai` 1.18.29. This establishes runtime integration without proving remote model quality, account access, or compatibility with every separately installed CLI.

For actual conversations, Claude Code can also use a configured [Anthropic-compatible gateway](https://code.claude.com/docs/en/gateways). A gateway credential can replace subscription login; a functioning model backend is still required. Commonspace leaves that routing and authentication in the native environment.
