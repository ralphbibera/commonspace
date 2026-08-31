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
- Known installed Hermes and Codex harness discovery with explicit roster selection and one workspace identity per harness.
- Native Hermes/Codex ACP relay with delta-only delivery, exact opaque-session resumption, and scoped Commonspace MCP context/actions.
- Expandable, durable per-reply traces for harness-emitted reasoning, plans, tools, results, and context usage.
- Live semantic activity with per-run and `/stop` cancellation controls.
- Live run supervision with steering, queued follow-ups, reorder/remove controls, and stop-and-send.
- Explicit completed, needs-input, failed, silent, cancelled, and timeout outcomes with needs-attention surfacing.
- Inference-only unaddressed Channel routing through a harness or OpenAI-compatible model.
- Inspectable per-harness routing assignments with bounded sub-requests, scoped Projects, and visible user-controlled fan-out.
- Visible Project-reference inference for unreferenced new Channel roots, with explicit and projectless selections remaining authoritative.
- Single-assignment rerouting with visible retained attempts, assignment-bound replies, corrected Agent/Project scope, and compacted per-Channel routing knowledge used by later inference.
- Immutable Channel-context snapshots per Thread, independent editable/pressure-compacted Thread context, and visible manual compaction controls.
- Prospective multi-Project/projectless Thread references that preserve earlier delivery and active-session scope.
- Channel/Thread pins for messages, attachments, and notes with scoped MCP visibility and removal tombstones.
- Human message edit branches with new native continuity, previous-version navigation, and pre-branch context; durable deletion markers remove content without rewriting delivery history.
- Channel context editing, status inspection, manual compaction, and note-pin controls.
- Dedicated owner-only projectless workspace isolation.
- General human files, permitted-root ACP Agent artifacts, safe download/search/pinning, and credential-file refusal.
- Exact native ACP permission choices with durable conversation/Inbox attention and per-session blocking.
- Runtime readiness diagnostics, recovery guidance, and local/remote inference data-flow disclosure.
- Project Files, Git Changes/diffs, image attachments, and reply speech playback.
- Work/result binding through per-reply run attribution, changed-file surfaces, activity traces, and validation evidence emitted by the harness.
- Hard-boundary cancellation, stale-session recovery that distinguishes missing from transient failures, and graceful bridge shutdown.
- Slash commands and agent/project/channel references.
- Versioned atomic state, loopback API guards, bounded execution, and live browser verification.

## Next: product behavior

- Add export/import and retention controls for non-secret Commonspace data.
- Package an installed background service and optional OS notifications.

## Later UI/UX work

- Multi-Project controls for new roots and inferred-reference correction.
- Notification and data-management surfaces.
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
