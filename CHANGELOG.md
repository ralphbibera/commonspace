# Changelog

All notable changes to Commonspace are recorded here.

## [Unreleased]

- Add live run supervision: queue or steer follow-ups, reorder/remove queued work, stop-and-send, and explicit completion/attention outcomes.

### Added

- Implementation-ready product specification with functional requirements, invariants, release slices, and end-to-end acceptance scenarios.
- Reply-focused Inbox with unread filtering, exact thread navigation, and a durable single-owner read cursor.
- Commonspace-local agent names, emoji avatars, and accent colors without mutating native harness profiles.
- Non-blocking agent-to-agent Channel delivery with bounded `@mention` handoffs.
- Native Hermes and Codex ACP relay with delta-only prompts, exact opaque-session resume, hard-boundary cancellation, and session-scoped MCP context/actions.
- Durable, expandable Hermes and Codex activity traces with harness-emitted reasoning summaries, plans, tool calls, tool results, and context usage.
- Session-scoped Commonspace MCP tools for bounded context reads, transcript pagination, and visible progress over authenticated loopback HTTP.
- Standalone Express server with loopback and same-origin API guards.
- Vite and React application served independently from the Express API in development and production preview.
- pnpm workspace boundaries for shared contracts, server behavior, and UI behavior.
- Real standalone health, API, browser-mount, build, and live smoke verification.
- Inference-only Channel routing through either an agent harness or an OpenAI-compatible model, with inspectable routing decisions.
- Persisted, inspectable per-harness routing assignments with bounded sub-requests and scoped Project references.
- Project Files, Git Changes/diffs, speech playback, live activity, and stop controls.
- Zero-to-many Project references on messages and threads, with multi-root agent execution, Project-aware search, correct run attribution, and backward-compatible singular fields for the current UI.
- Editable Channel context APIs with user-owned context preservation, manual inference compaction, automatic token-pressure compaction, and visible current/stale metadata.
- ANSI-safe live-preview URL detection so CI can verify Vite startup reliably.

### Changed

- Accepted conversation messages are retained across append and restart instead of silently keeping only the newest 500 messages.
- Multi-Project thread replies now inherit only when Project fields are omitted, conflicting compatibility fields are rejected, and Project removal or startup path loss cleans stale run-attribution roots.
- New Channel threads include structurally selected Projects in inference routing context.
- Queued and in-flight replies cannot execute or persist against stale Project authority after Project configuration changes.
- Channel context refresh/compaction is race-safe and preserves human-authored context, while concurrent harness inference runs use isolated native sessions.
- Installed Hermes and Codex harnesses are discovered only during an explicit Add Agent flow; new Channels start with no agents preselected.
- Local state migrates from versions 1–16 to version 17 for routing assignments, including deterministic conversion of legacy routing decisions, and automatically recovers an invalid primary from the previous valid rollback backup.
- Inferred routing uses the visible max-agents setting instead of a hidden two-Agent cap.
- Independent agents can run concurrently; only the same native agent session is serialized.
- Hermes and Codex use ACP for every agent turn.
- Missing native sessions recover once without treating authentication or transport failures as a reason to discard continuity.
- Hermes and Codex replies preserve bounded ACP activity while redacting host paths, native session identifiers, and MCP capabilities before persistence.
- Reframed Commonspace as a conversation-first context workspace centered on Projects, Channels, Direct Messages, Agents, Messages, and native session continuity.
- Vite serves built browser assets separately from the loopback-only Express API in production.

### Removed

- Managed/custom Agent creation and profile import; every new Agent now represents one explicitly selected supported harness installation.
- Commonspace-defined Codex `default`, `worker`, and `explorer` personas.
- Runtime-specific Hermes configuration inspection/mutation and the native-configuration dashboard; Commonspace now limits Agent customization to workspace-local appearance until capabilities are advertised through ACP.
- Synthesized room/DM delivery envelopes, replayed Channel memory, duplicated recent transcripts, and execution-contract boilerplate from agent messages.
- Plugin lifecycle, slot mounting, bundle manifests, and framework-specific build dependencies.
