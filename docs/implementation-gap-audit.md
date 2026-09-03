# Implementation gap audit

Snapshot: 2026-09-03, audited against the current state-v25 implementation on `main`.

This audit compares the intended behavior in [Product specification](product-spec.md), [Product direction](product-direction.md), and [Product model](product.md) with executable contracts, server behavior, persistence, API routes, UI use, and tests. It deliberately separates product behavior from later UI/UX work.

## Status key

| Status | Meaning |
| --- | --- |
| Working | Implemented end to end in the current application. |
| Backend-ready | Contracts, persistence, service behavior, API, and tests exist; the current UI exposes only compatibility behavior or no control yet. |
| Partial | A useful subset exists, but an important product promise is absent. |
| Direction conflict | Current behavior contradicts the canonical product boundary and must be removed or replaced. |
| Missing | No durable implementation was found. |
| Deferred | Explicitly outside the current product direction or dependent on demonstrated scale. |

## Capability audit

| Product capability | Status | Current evidence and remaining gap |
| --- | --- | --- |
| Local-first standalone workspace | Working | Loopback Express API, separate Vite UI, atomic local state, origin guards, and live browser verification exist. |
| Desktop visual direction | Partial | Desktop shell and major collection/conversation/Project surfaces are being aligned to the supplied Apple workspace reference. Geometry and borders are in scope; reference colors are not. The maintained rules are in [UI direction](ui-direction.md). |
| Durable conversation history | Working | Message acceptance, reply append, and startup sanitization preserve the complete conversation transcript. Regression coverage crosses the former 500-message boundary through both restart and new request/reply append. |
| BYOA Agent identity | Working | Every new Agent represents one explicitly selected supported harness installation—currently Codex or Hermes. Commonspace does not enumerate custom profiles or create personas. Legacy persisted identities remain loadable so existing conversation history is not destroyed. |
| ACP capability/configuration authority | Working | Runtime-specific configuration endpoints, Hermes CLI/profile mutation, shared native-configuration DTOs, and the native-configuration dashboard are removed. Commonspace limits customization to workspace-local appearance; future capability-dependent controls must originate in ACP. |
| Projects with multiple local roots | Working | Projects persist canonical filesystem roots server-side and expose files, Git changes, diffs, and agent working directories by Project/root index. Browser state receives only stable working/reference folder labels, never the absolute roots. |
| Zero/one/many Project references | Working | Messages, Threads, search, MCP context, run attribution, and multi-root launches support every reference. New Channel roots infer Project scope unless visible `@@project` tags provide it. No root, DM, Thread, branch, or reroute Project picker exists, and the client no longer injects a hidden singular Project fallback. |
| Prospective Thread Project-reference changes | Working | Replies inherit the latest inferred Thread scope; visible `@@project` tags can provide explicit context for a new turn without rewriting earlier messages, runs, or MCP scopes. Dedicated Channel/Thread Project controls do not exist. |
| Projectless filesystem isolation | Working | A projectless turn receives an explicit empty Project scope and runs from Commonspace's canonical owner-only neutral workspace rather than the service repository/process directory. Explicit configured working directories remain supported and canonicalized. |
| Channels, DMs, and threads | Working | Durable conversations, `/new` DM boundaries, per-thread sessions, concurrent agents, and same-session serialization are implemented. |
| Explicit mentions and peer handoffs | Working | Mentions are authoritative, can seat an agent, and create bounded non-blocking handoffs in the same visible thread. |
| Unaddressed agent selection | Working | A configured harness or OpenAI-compatible provider selects the smallest useful Agent set and records the routing decision, start/resolution timestamps, and routing-only duration separately from harness execution. Invalid inference marks the accepted source failed and creates retryable Inbox attention. |
| Unaddressed routing fan-out | Working | Inference may select up to the visible max-agents setting; the hidden two-Agent cap is removed while unrelated native sessions remain concurrent. |
| Agent-specific request decomposition | Working | Routing persists one bounded sub-request and Project subset per selected harness, then delivers only that sub-request to its native session. Resolved assignment details stay out of the conversation UI; legacy decisions migrate deterministically. |
| Reroute, correction, and routing memory | Working | Service/API correction records can change one current assignment's Agent and bounded sub-request without restarting unrelated Agents. Targets are restricted to existing Channel members and preserve inferred Project scope. Linked attempts and assignment-bound replies persist without a history cap; explicit corrections compact into bounded per-Channel routing knowledge. No inline reroute control is exposed. |
| Project-reference inference | Working | New roots without `@@project` tags offer all Projects to inference, persist the inferred union on the message/Thread, and scope each assignment independently. Valid `@@project` tags remain authoritative; there is no parallel Project mode or checkbox UI. |
| Shared Channel context projection | Working | Commonspace derives summary, decisions, questions, thread references, source counts, and estimated tokens independently of native sessions. |
| Editable and compactable Channel context | Working | Read/update/manual-compact APIs, preserved user edits, automatic token-pressure compaction, durable empty/current/stale/compacting/failed states, a Channel editor, manual compaction control, and Channel note-pin management are implemented. |
| Thread-specific context snapshots | Working | Each new Thread stores an immutable snapshot of Channel context at creation plus independent projected context. Thread context supports human editing, manual/pressure compaction, stale/failure state, scoped MCP inspection, and an inline UI inspector. Legacy Threads derive current memory from their transcripts without inventing a historical Channel snapshot. |
| Native session continuity | Working | ACP sessions resume by opaque host-private reference, with stale-session recovery and hard `/new` boundaries. |
| Image attachments | Working | Pasted/uploaded images are persisted with bounded private metadata and delivered to supported agents. |
| General human and agent files | Working | Bounded human files persist against exact message versions, render as safe downloads, are searchable/pinnable, and reach ACP sessions as baseline resource links. Known credential-bearing names are rejected before acceptance. Capability-dependent Agent resource links are copied only from granted working roots into Commonspace storage without exposing source URIs/paths. |
| Message editing and branches | Working | Editing a delivered human message creates a linked version with a new Channel Thread/native session or DM generation. Prior messages, replies, routing, attachments, and sessions remain visible; reply edits expose only pre-branch transcript plus the corrected branch through scoped context. Agent replies cannot be edited. |
| Message deletion markers | Working | Deletion retains author/delivery/version/routing identity while removing the body, attachment bytes, traces, attribution, and derived automatic context. Markers survive restart and cannot be edited back into content. |
| Pins for messages/files/notes | Working | Channel/Thread-scoped message, exact attachment, and human-note pins persist with source and removal tombstones. Active Channel pins inherit into Thread MCP reads; Thread and Channel UI surfaces manage notes/messages/files without exposing bytes or host paths. |
| Activity traces and work/result binding | Working | Replies preserve bounded harness-emitted plans, tools, results, usage, validation evidence, and Project/root attribution. |
| Native permission requests | Working | ACP permission requests persist with only harness-advertised choices, block only the affected native session, appear in the conversation and durable Inbox/session attention, return the exact selected option, and become interrupted on shutdown/restart rather than hanging or pretending completion. |
| Inbox, unread state, search, and navigation | Working | Reply-focused Inbox, exact thread navigation, read cursors, and unified transcript search exist. Search filtering now recognizes every referenced Project. |
| Runtime and authentication diagnostics | Working | On-demand diagnostics report service storage/projectless readiness, installed versus rostered supported harnesses, observed run readiness, recovery guidance, and local/remote inference data categories without returning credentials, host paths, or native IDs. |
| Notifications | Working | Opt-in native OS notifications cover replies/input requests, owner mentions, exact ACP permission requests, failures, and timeouts. Independent persisted category/sound controls never mute or remove the durable Inbox. New-item baselining prevents restart/import replay, session mutes suppress native delivery, and every alert opens a validated loopback deep link to the exact conversation, Thread, and message. |
| Installed background service | Working | The macOS service manager provides one-command SSH installation from `main`, an owner LaunchAgent, same-origin built UI/API delivery, start/stop/restart/status controls, staged updates, activation health checks, automatic failed-update restoration, and explicit one-release rollback without repository knowledge. |
| Export, import, and retention | Working | Version-1 JSON archives contain sanitized workspace data and exact attachment bytes while omitting managed paths, native sessions, capabilities, and credentials. Import is clean-workspace-only, validates all attachment data, and requires explicit local root mappings. Revision-bound retention previews scope destructive cleanup to one Channel or DM; apply rejects live/queued runs and Channel/Thread/routing compaction. The format and semantics are documented in [Workspace archive format](workspace-archive-format.md). |
| Extensible Project resources | Deferred | PRJ-08 explicitly targets non-folder resource kinds for later. v0.1 intentionally implements one or more canonical local folders without inventing a premature resource abstraction. |
| Relational transcript store | Deferred | Storage technology remains scale-dependent, but removing silent transcript truncation and honoring explicit retention semantics cannot wait for a relational migration. |
| Plugin lifecycle | Deferred | It was intentionally removed from the local-first core and is not required for the current product model. |

## Recommended feature order

1. Repeat the now-green real-harness, isolated service-lifecycle, and browser acceptance gates on a clean supported release machine.

## Documentation corrections made with this audit

- State documentation now identifies v25 and migrations from versions 1–24.
- Work/result binding moved from `Next` to `Working now` because run attribution, changes, traces, and validation evidence already implement it.
- Multi-Project references and Channel-context controls are marked backend-ready instead of being implied as either wholly absent or fully surfaced.
- The roadmap now separates feature behavior, later UI/UX, and scale-dependent storage work.
- Transcript truncation, runtime-specific configuration management, synthetic Codex discovery, and managed Agent creation are fixed.
- Export/import and retention now have documented, tested service, API, and UI paths.
- The macOS background-service lifecycle now has packaged install/update/control/recovery paths and same-origin installed UI delivery.
- Configurable native notifications now derive from durable Inbox events and deep-link to exact conversation state without changing Inbox retention/read semantics.
- New-root and DM composition omit hidden first-Project fallback and dedicated Project pickers; inference owns default scope while `@@project` remains the explicit path.
- Routing latency, routing-failure Inbox attention, public Project-root privacy, and retention busy-state races are now covered by executable contracts.
- The desktop visual reference, Light-default/System appearance behavior, neutral message focus treatment, and no-mobile-validation boundary are documented in [UI direction](ui-direction.md).
