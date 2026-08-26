# Roadmap

Commonspace is a private preview focused on durable human-agent conversation and visible context continuity.

## Working now

- Standalone local server and browser application.
- Filesystem Projects with multiple canonical paths.
- Channels with explicit agent rosters, instructions, settings, memory, and threaded native sessions.
- Persistent Direct Messages with generation-safe `/new` boundaries.
- Hermes discovery plus managed Codex CLI and Claude Code agents.
- Exact native session resumption and stale-session recovery.
- Slash commands and agent/project/channel references.
- Versioned atomic state, loopback API guards, bounded execution, and live browser verification.

## Next

- Explicit stop and cancellation controls.
- Streaming where every adapter can expose a compatible cancellable stream.
- Better transcript search, filtering, and context-handoff inspection.
- Adapter availability and authentication diagnostics.
- Import/export and retention controls for non-secret Commonspace data.
- A durable relational message store once transcript scale justifies migration from the current versioned state file.
- Keyboard and narrow-screen acceptance coverage across every flow.

## Release readiness

- Exercise all supported adapter login/start/resume paths on a clean machine.
- Verify light, dark, desktop, and narrow layouts.
- Define state migration and rollback guarantees.
- Package a one-command local installation and update path.
- Complete keyboard-only and destructive-action reviews.
