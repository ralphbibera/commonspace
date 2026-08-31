# Roadmap

Commonspace is a private preview focused on durable human-agent conversation and visible context continuity.

## Working now

- Standalone local server and browser application.
- Filesystem Projects with multiple canonical paths.
- Zero-to-many Project references on messages and threads, including multi-root agent execution and Project-aware search/attribution.
- Channels with explicit agent rosters, instructions, settings, memory, and threaded native sessions.
- Editable Channel context with state metadata, manual compaction, and automatic token-pressure compaction through the configured inference layer.
- Persistent Direct Messages with generation-safe `/new` boundaries.
- Complete conversation transcripts preserved across append and restart without implicit message-count eviction.
- Hermes and Codex profile discovery with explicit roster selection.
- Native Hermes/Codex ACP relay with delta-only delivery, exact opaque-session resumption, and scoped Commonspace MCP context/actions.
- Expandable, durable per-reply traces for harness-emitted reasoning, plans, tools, results, and context usage.
- Live semantic activity with per-run and `/stop` cancellation controls.
- Live run supervision with steering, queued follow-ups, reorder/remove controls, and stop-and-send.
- Explicit completed, needs-input, failed, silent, cancelled, and timeout outcomes with needs-attention surfacing.
- Inference-only unaddressed Channel routing through a harness or OpenAI-compatible model.
- Project Files, Git Changes/diffs, image attachments, and reply speech playback.
- Work/result binding through per-reply run attribution, changed-file surfaces, activity traces, and validation evidence emitted by the harness.
- Hard-boundary cancellation, stale-session recovery that distinguishes missing from transient failures, and graceful bridge shutdown.
- Slash commands and agent/project/channel references.
- Versioned atomic state, loopback API guards, bounded execution, and live browser verification.

## Immediate direction-alignment work

- Remove Commonspace-defined Codex personas and managed identities that do not come from explicit harness discovery.
- Remove direct Hermes configuration/profile mutation and expose only capabilities and controls advertised through ACP.

## Next: product behavior

- Split routed messages into inspectable agent-specific sub-requests and remove the hidden two-Agent inference cap.
- Add Project-reference inference and visible correction when a message has no explicit reference.
- Add rerouting and compacted routing feedback so corrections improve later decisions.
- Add thread-specific context snapshots, prospective Thread Project-reference changes, pins, and general human/agent file attachments.
- Add message edit branches and visible deletion markers without rewriting delivered native-session history.
- Normalize native permission requests and add clearer runtime/authentication diagnostics.
- Add export/import and retention controls for non-secret Commonspace data.
- Package an installed background service and optional OS notifications.

## Later UI/UX work

- Multi-Project reference controls and inferred-reference correction.
- Channel/Thread context inspection, editing, pinning, and manual-compaction controls.
- Sub-request, reroute, message-version, file, permission, and notification surfaces.
- Keyboard and narrow-screen acceptance coverage across every flow.

## Scale-dependent work

- A durable relational message store once transcript scale justifies migration from the current versioned state file.
- Storage technology may remain JSON while appropriate, but the current store must preserve every accepted message until explicit retention exists.

See [Product specification](product-spec.md) for the complete behavior and acceptance contract and [Implementation gap audit](implementation-gap-audit.md) for evidence-based implementation status.

## Release readiness

- Exercise Hermes and Codex ACP login/start/resume paths on a clean machine.
- Verify light, dark, desktop, and narrow layouts.
- Exercise state migration, automatic backup recovery, and rollback guarantees on release fixtures.
- Package a one-command local installation and update path.
- Complete keyboard-only and destructive-action reviews.
