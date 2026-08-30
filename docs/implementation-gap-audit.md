# Implementation gap audit

Snapshot: 2026-08-30, audited against `main` at `22eade0a1a6eff315fb086b6783ec1ed1f6f070a` plus the feature work on this branch.

This audit compares the intended behavior in [Product specification](product-spec.md), [Product direction](product-direction.md), and [Product model](product.md) with executable contracts, server behavior, persistence, API routes, UI use, and tests. It deliberately separates product behavior from later UI/UX work.

## Status key

| Status | Meaning |
| --- | --- |
| Working | Implemented end to end in the current application. |
| Backend-ready | Contracts, persistence, service behavior, API, and tests exist; the current UI exposes only compatibility behavior or no control yet. |
| Partial | A useful subset exists, but an important product promise is absent. |
| Missing | No durable implementation was found. |
| Deferred | Explicitly outside the current product direction or dependent on demonstrated scale. |

## Capability audit

| Product capability | Status | Current evidence and remaining gap |
| --- | --- | --- |
| Local-first standalone workspace | Working | Loopback Express API, separate Vite UI, atomic local state, origin guards, and live browser verification exist. |
| Projects with multiple local roots | Working | Projects persist canonical filesystem roots and expose files, Git changes, diffs, and agent working directories. |
| Zero/one/many Project references | Backend-ready | Messages, threads, search, MCP context, run attribution, and multi-root launches now support multiple references. The UI still uses the first reference as its compatibility selection, and a Thread's set cannot yet evolve prospectively. |
| Prospective Thread Project-reference changes | Missing | A Thread currently rejects a Project-set change instead of applying it only to the new turn and future defaults. |
| Projectless filesystem isolation | Partial | A projectless turn receives no Project roots, but its working directory still defaults to the service process directory rather than a dedicated neutral workspace. |
| Channels, DMs, and threads | Working | Durable conversations, `/new` DM boundaries, per-thread sessions, concurrent agents, and same-session serialization are implemented. |
| Explicit mentions and peer handoffs | Working | Mentions are authoritative, can seat an agent, and create bounded non-blocking handoffs in the same visible thread. |
| Unaddressed agent selection | Working | A configured harness or OpenAI-compatible provider selects the smallest useful agent set and records the routing decision. |
| Unaddressed routing fan-out | Partial | Different Agent sessions can run concurrently, but inferred routing is currently capped at two Agents even when more distinct responsibilities exist. |
| Agent-specific request decomposition | Missing | Selected agents still receive the same original message. There is no persisted sub-request per agent. |
| Reroute, correction, and routing memory | Missing | There is no reroute operation, correction record, or compacted feedback used by later routing. |
| Project-reference inference | Missing | Explicit Project tags work, but the inference layer does not infer or expose correctable Project references. |
| Shared Channel context projection | Working | Commonspace derives summary, decisions, questions, thread references, source counts, and estimated tokens independently of native sessions. |
| Editable and compactable Channel context | Partial | Read/update/manual-compact APIs, preserved user edits, stale/current state, and automatic token-pressure compaction now exist. Durable compacting/failed states and the inspector/editor/compact controls remain missing. |
| Thread-specific context snapshots | Missing | Threads reference shared context but do not persist an inherited snapshot plus independently compacted thread context. |
| Native session continuity | Working | ACP sessions resume by opaque host-private reference, with stale-session recovery and hard `/new` boundaries. |
| Image attachments | Working | Pasted/uploaded images are persisted with bounded private metadata and delivered to supported agents. |
| General human and agent files | Missing | Arbitrary file attachment, agent-authored file attachment, download, and durable file-reference semantics are absent. |
| Message editing and branches | Missing | Delivered human messages cannot create a new visible conversation version/session branch. |
| Message deletion markers | Missing | There is no durable delivered-message deletion marker or associated branch semantics. |
| Pins for messages/files/notes | Missing | Shared context has no first-class pin model. |
| Activity traces and work/result binding | Working | Replies preserve bounded harness-emitted plans, tools, results, usage, validation evidence, and Project/root attribution. |
| Native permission requests | Partial | Generic activity can be preserved, but there is no normalized permission request/choice contract and response flow. |
| Inbox, unread state, search, and navigation | Working | Reply-focused Inbox, exact thread navigation, read cursors, and unified transcript search exist. Search filtering now recognizes every referenced Project. |
| Runtime and authentication diagnostics | Partial | Failures and outcomes surface, but clean-machine runtime/auth readiness and guided recovery are incomplete. |
| Notifications | Partial | In-app attention state exists; OS notifications and settings do not. |
| Installed background service | Partial | The server can run independently, but installation, startup registration, health control, and updating are not packaged. |
| Export, import, and retention | Missing | No non-secret archive format, import validation, or retention controls exist. |
| Extensible Project resources | Missing | The product model permits resource kinds beyond directories, but persistence and APIs are filesystem-specific. |
| Relational transcript store | Deferred | Versioned JSON state is still adequate; migration should follow measured transcript-scale pressure. |
| Plugin lifecycle | Deferred | It was intentionally removed from the local-first core and is not required for the current product model. |

## Recommended feature order

1. Complete the inference layer: agent-specific sub-requests, Project-reference inference, reroute/correction, compacted routing feedback, and removal of the hidden two-Agent cap.
2. Complete durable conversation semantics: thread context snapshots, prospective Thread Project-reference changes, message edit branches, deletion markers, and pins.
3. Generalize collaboration artifacts: human/agent files and normalized native permission requests.
4. Complete operability: runtime/auth diagnostics, export/import/retention, installed background service, and OS notifications.
5. Add UI/UX for the backend-ready capabilities and the features above after their behavior and contracts are stable.

## Documentation corrections made with this audit

- State documentation now identifies v16 and migrations from versions 1–15.
- Work/result binding moved from `Next` to `Working now` because run attribution, changes, traces, and validation evidence already implement it.
- Multi-Project references and Channel-context controls are marked backend-ready instead of being implied as either wholly absent or fully surfaced.
- The roadmap now separates feature behavior, later UI/UX, and scale-dependent storage work.
