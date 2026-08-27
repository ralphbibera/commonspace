# Roadmap

Commonspace is a private preview focused on durable human-agent conversation and visible context continuity.

## Working now

- Standalone local server and browser application.
- Filesystem Projects with multiple canonical paths.
- Channels with explicit agent rosters, instructions, settings, memory, and threaded native sessions.
- Persistent Direct Messages with generation-safe `/new` boundaries.
- Hermes discovery with explicit roster selection, plus managed Codex agents.
- Native Hermes/Codex ACP relay with delta-only delivery, exact opaque-session resumption, and scoped Commonspace MCP context/actions.
- Expandable, durable per-reply traces for harness-emitted reasoning, plans, tools, results, and context usage.
- Hard-boundary cancellation, stale-session recovery that distinguishes missing from transient failures, and graceful bridge shutdown.
- Slash commands and agent/project/channel references.
- Versioned atomic state, loopback API guards, bounded execution, and live browser verification.

## Next

- Explicit user-facing stop controls on top of the native cancellation path.
- Live trace streaming on top of the existing provider-neutral ACP event contract.
- Better transcript search, filtering, and context-handoff inspection.
- Runtime availability and authentication diagnostics.
- Import/export and retention controls for non-secret Commonspace data.
- A durable relational message store once transcript scale justifies migration from the current versioned state file.
- Keyboard and narrow-screen acceptance coverage across every flow.

## Release readiness

- Exercise Hermes and Codex ACP login/start/resume paths on a clean machine.
- Verify light, dark, desktop, and narrow layouts.
- Define state migration and rollback guarantees.
- Package a one-command local installation and update path.
- Complete keyboard-only and destructive-action reviews.
