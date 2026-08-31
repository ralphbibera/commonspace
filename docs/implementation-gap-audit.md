# Implementation gap audit

Snapshot: 2026-08-31, audited against the current state-v24 implementation on `main`.

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
| Durable conversation history | Working | Message acceptance, reply append, and startup sanitization preserve the complete conversation transcript. Regression coverage crosses the former 500-message boundary through both restart and new request/reply append. |
| BYOA Agent identity | Working | Every new Agent represents one explicitly selected supported harness installation—currently Codex or Hermes. Commonspace does not enumerate custom profiles or create personas. Legacy persisted identities remain loadable so existing conversation history is not destroyed. |
| ACP capability/configuration authority | Working | Runtime-specific configuration endpoints, Hermes CLI/profile mutation, shared native-configuration DTOs, and the native-configuration dashboard are removed. Commonspace limits customization to workspace-local appearance; future capability-dependent controls must originate in ACP. |
| Projects with multiple local roots | Working | Projects persist canonical filesystem roots and expose files, Git changes, diffs, and agent working directories. |
| Zero/one/many Project references | Backend-ready | Messages, threads, search, MCP context, run attribution, and multi-root launches support multiple references. Thread replies now expose multi-Project/projectless controls; new root and DM composition still use the first selected Project as their compatibility input. |
| Prospective Thread Project-reference changes | Working | An explicit reply Project set applies to that message and future Thread defaults while earlier messages, runs, and MCP scopes retain their delivered references. Omitted replies inherit the latest default; explicit empty sets stay projectless. |
| Projectless filesystem isolation | Working | A projectless turn receives an explicit empty Project scope and runs from Commonspace's canonical owner-only neutral workspace rather than the service repository/process directory. Explicit configured working directories remain supported and canonicalized. |
| Channels, DMs, and threads | Working | Durable conversations, `/new` DM boundaries, per-thread sessions, concurrent agents, and same-session serialization are implemented. |
| Explicit mentions and peer handoffs | Working | Mentions are authoritative, can seat an agent, and create bounded non-blocking handoffs in the same visible thread. |
| Unaddressed agent selection | Working | A configured harness or OpenAI-compatible provider selects the smallest useful agent set and records the routing decision. |
| Unaddressed routing fan-out | Working | Inference may select up to the visible max-agents setting; the hidden two-Agent cap is removed while unrelated native sessions remain concurrent. |
| Agent-specific request decomposition | Working | Routing persists one bounded sub-request and Project subset per selected harness, displays each assignment, and delivers only that sub-request to its native session. Legacy decisions migrate deterministically. |
| Reroute, correction, and routing memory | Working | A user can change one current assignment's Agent, bounded sub-request, and Project subset without restarting unrelated Agents. Linked attempts and assignment-bound replies persist without a history cap; the UI marks superseded/corrected attempts. Explicit corrections compact through the configured inference layer into bounded per-Channel routing knowledge used by later decisions. |
| Project-reference inference | Working | New unreferenced Channel roots offer all Projects to inference, persist the inferred union on the message/Thread, scope each assignment independently, and visibly mark inferred Projects. Explicit references and explicit projectless scope remain authoritative; reroute controls can correct one inferred assignment after dispatch. |
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
| Export, import, and retention | Working | Version-1 JSON archives contain sanitized workspace data and exact attachment bytes while omitting paths, native sessions, capabilities, and credentials. Import is clean-workspace-only, validates all attachment data, and requires explicit local root mappings. Revision-bound retention previews scope destructive cleanup to one inactive Channel or DM. The format and semantics are documented in [Workspace archive format](workspace-archive-format.md). |
| Extensible Project resources | Missing | The product model permits resource kinds beyond directories, but persistence and APIs are filesystem-specific. |
| Relational transcript store | Deferred | Storage technology remains scale-dependent, but removing silent transcript truncation and honoring explicit retention semantics cannot wait for a relational migration. |
| Plugin lifecycle | Deferred | It was intentionally removed from the local-first core and is not required for the current product model. |

## Recommended feature order

1. Finish user-facing controls and acceptance coverage for remaining backend-ready and release-readiness capabilities.

## Documentation corrections made with this audit

- State documentation now identifies v24 and migrations from versions 1–23.
- Work/result binding moved from `Next` to `Working now` because run attribution, changes, traces, and validation evidence already implement it.
- Multi-Project references and Channel-context controls are marked backend-ready instead of being implied as either wholly absent or fully surfaced.
- The roadmap now separates feature behavior, later UI/UX, and scale-dependent storage work.
- Transcript truncation, runtime-specific configuration management, synthetic Codex discovery, and managed Agent creation are fixed.
- Export/import and retention now have documented, tested service, API, and UI paths.
- The macOS background-service lifecycle now has packaged install/update/control/recovery paths and same-origin installed UI delivery.
- Configurable native notifications now derive from durable Inbox events and deep-link to exact conversation state without changing Inbox retention/read semantics.
