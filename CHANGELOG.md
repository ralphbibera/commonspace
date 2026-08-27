# Changelog

All notable changes to Commonspace are recorded here.

## [Unreleased]

### Added

- Reply-focused Inbox with unread filtering, exact thread navigation, and a durable single-owner read cursor.
- Commonspace-local agent names, emoji avatars, and accent colors without mutating native harness profiles.
- Non-blocking agent-to-agent Channel delivery with bounded `@mention` handoffs.
- Native Hermes and Codex ACP relay with delta-only prompts, exact opaque-session resume, hard-boundary cancellation, and session-scoped MCP context/actions.
- Durable, expandable Hermes and Codex activity traces with harness-emitted reasoning summaries, plans, tool calls, tool results, and context usage.
- Session-scoped Commonspace MCP tools for bounded context reads, transcript pagination, and visible progress over authenticated loopback HTTP.
- Standalone Express server with loopback and same-origin API guards.
- Vite and React application served independently in development and by the production server after build.
- pnpm workspace boundaries for shared contracts, server behavior, and UI behavior.
- Real standalone health, API, browser-mount, build, and live smoke verification.

### Changed

- Hermes profiles are auto-discovered as candidates but join the Commonspace roster only after an explicit user choice; new Channels also start with no agents preselected.
- Local state migrates from versions 1–11 to version 12 with sanitized agent activity traces, Inbox read state, managed image attachment metadata, and local agent appearance.
- Independent agents can run concurrently; only the same native agent session is serialized.
- Hermes and Codex use ACP for every agent turn.
- Missing native sessions recover once without treating authentication or transport failures as a reason to discard continuity.
- Hermes and Codex replies preserve bounded ACP activity while redacting host paths, native session identifiers, and MCP capabilities before persistence.
- Reframed Commonspace as a conversation-first context workspace centered on Projects, Channels, Direct Messages, Agents, Messages, and native session continuity.

### Removed

- Synthesized room/DM delivery envelopes, replayed Channel memory, duplicated recent transcripts, and execution-contract boilerplate from agent messages.
- Plugin lifecycle, slot mounting, bundle manifests, and framework-specific build dependencies.
