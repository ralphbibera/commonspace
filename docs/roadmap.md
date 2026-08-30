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
- Live semantic activity with per-run and `/stop` cancellation controls.
- Live run supervision with steering, queued follow-ups, reorder/remove controls, and stop-and-send.
- Explicit completed, needs-input, failed, silent, cancelled, and timeout outcomes with needs-attention surfacing.
- Inference-only unaddressed Channel routing through a harness or OpenAI-compatible model.
- Project Files, Git Changes/diffs, image attachments, reply speech playback, and native agent configuration inspection.
- Hard-boundary cancellation, stale-session recovery that distinguishes missing from transient failures, and graceful bridge shutdown.
- Slash commands and agent/project/channel references.
- Versioned atomic state, loopback API guards, bounded execution, and live browser verification.

## Next

- Work/result binding between a request, changed files, validation evidence, and the resulting reply.
- Better transcript search, filtering, and context-handoff inspection.
- Runtime availability and authentication diagnostics.
- Import/export and retention controls for non-secret Commonspace data.
- A durable relational message store once transcript scale justifies migration from the current versioned state file.
- Keyboard and narrow-screen acceptance coverage across every flow.

## Release readiness

- Exercise Hermes and Codex ACP login/start/resume paths on a clean machine.
- Verify light, dark, desktop, and narrow layouts.
- Exercise state migration, automatic backup recovery, and rollback guarantees on release fixtures.
- Package a one-command local installation and update path.
- Complete keyboard-only and destructive-action reviews.
