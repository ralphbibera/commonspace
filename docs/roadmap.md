# Roadmap

Commonspace is a private preview focused on durable human-agent conversation and visible context continuity.

## Working now

- Standalone local server and browser application.
- Filesystem Projects with multiple canonical paths.
- Zero-to-many Project references on messages and threads, including multi-root agent execution and Project-aware search/attribution.
- Inference-first Project context without root, DM, Thread, branch, or reroute Project pickers; `@@project` remains the explicit context path.
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
- Persisted routing-stage latency reported independently from Agent execution, with failed inference promoted to retryable Inbox attention.
- Persisted per-harness routing assignments with bounded sub-requests, scoped Projects, and visible user-controlled fan-out; resolved assignment details stay out of conversation messages.
- Visible Project-reference inference for new Channel roots, with `@@project` tags remaining authoritative.
- Durable single-assignment corrections among existing Channel members, assignment-bound replies, preserved Project scope, and compacted per-Channel routing knowledge used by later inference; no inline reroute control.
- Immutable Channel-context snapshots per Thread, independent editable/pressure-compacted Thread context, and visible manual compaction controls.
- Prospective Thread references inherited from inference or supplied through `@@project`, preserving earlier delivery and active-session scope.
- Channel/Thread pins for messages, attachments, and notes with scoped MCP visibility and removal tombstones.
- Human message edit branches with new native continuity, previous-version navigation, and pre-branch context; durable deletion markers remove content without rewriting delivery history.
- Channel context editing, status inspection, manual compaction, and note-pin controls.
- Dedicated owner-only projectless workspace isolation.
- General human files, permitted-root ACP Agent artifacts, safe download/search/pinning, and credential-file refusal.
- Exact native ACP permission choices with durable conversation/Inbox attention and per-session blocking.
- Runtime readiness diagnostics, recovery guidance, and local/remote inference data-flow disclosure.
- Versioned non-secret workspace export, clean-workspace import with explicit Project-root mapping, and exact attachment restoration.
- Explicit revision-guarded Channel/DM retention with impact preview and attachment-byte cleanup; no automatic expiry.
- One-command macOS installation, owner LaunchAgent startup, same-origin built UI/API service, staged updates, health control, and one-release rollback.
- Opt-in native notifications for replies, mentions, permission requests, failures, and timeouts, with independent category/sound controls and exact message deep links.
- Project Files, Git Changes/diffs, and image attachments.
- Desktop-first Apple-reference visual parity for shell geometry, borders, collections, conversations, Inbox, Threads, and Project panes; existing semantic color settings remain authoritative.
- Light-default appearance with Light/Dark/System selection and neutral message focus cards without orange accent rails.
- Theme swaps remain one-command: a new Tweakcn/shadcn theme updates `ui/src/index.css` without React or layout edits.
- Work/result binding through per-reply run attribution, changed-file surfaces, activity traces, and validation evidence emitted by the harness.
- Hard-boundary cancellation, stale-session recovery that distinguishes missing from transient failures, and graceful bridge shutdown.
- Slash commands and agent/project/channel references.
- Versioned atomic state, loopback API guards, bounded execution, and live browser verification.
- Browser-private canonical Project roots and retention guards for live/queued/compaction work.

## Scale-dependent work

- A durable relational message store once transcript scale justifies migration from the current versioned state file.
- Storage technology may remain JSON while appropriate, but the current store must preserve every accepted message until explicit retention exists.

See [Product specification](product-spec.md) for the complete behavior and acceptance contract and [Implementation gap audit](implementation-gap-audit.md) for evidence-based implementation status.

## Release readiness

- Exercise Hermes and Codex ACP login/start/resume paths on a clean machine.
- Keep automated keyboard search/navigation and Light/Dark/System desktop palette checks green in `pnpm verify:live`.
- Defer narrow/mobile layout validation until the desktop visual direction is accepted.
- Keep state migration, automatic backup recovery, and rollback fixtures green in `pnpm check`.
- Repeat the green isolated `pnpm verify:service` lifecycle on a clean supported macOS user account with real launchctl health.
- Complete keyboard-only and destructive-action reviews.
