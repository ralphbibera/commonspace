# Implementation gap audit

Snapshot: 2026-08-30, audited against `main` at `22eade0a1a6eff315fb086b6783ec1ed1f6f070a` plus the feature work on this branch.

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
| Zero/one/many Project references | Backend-ready | Messages, threads, search, MCP context, run attribution, and multi-root launches now support multiple references. The UI still uses the first reference as its compatibility selection, and a Thread's set cannot yet evolve prospectively. |
| Prospective Thread Project-reference changes | Missing | A Thread currently rejects a Project-set change instead of applying it only to the new turn and future defaults. |
| Projectless filesystem isolation | Partial | A projectless turn receives no Project roots, but its working directory still defaults to the service process directory rather than a dedicated neutral workspace. |
| Channels, DMs, and threads | Working | Durable conversations, `/new` DM boundaries, per-thread sessions, concurrent agents, and same-session serialization are implemented. |
| Explicit mentions and peer handoffs | Working | Mentions are authoritative, can seat an agent, and create bounded non-blocking handoffs in the same visible thread. |
| Unaddressed agent selection | Working | A configured harness or OpenAI-compatible provider selects the smallest useful agent set and records the routing decision. |
| Unaddressed routing fan-out | Working | Inference may select up to the visible max-agents setting; the hidden two-Agent cap is removed while unrelated native sessions remain concurrent. |
| Agent-specific request decomposition | Working | Routing persists one bounded sub-request and Project subset per selected harness, displays each assignment, and delivers only that sub-request to its native session. Legacy decisions migrate deterministically. |
| Reroute, correction, and routing memory | Missing | There is no reroute operation, correction record, or compacted feedback used by later routing. |
| Project-reference inference | Working | New unreferenced Channel roots offer all Projects to inference, persist the inferred union on the message/Thread, scope each assignment independently, and visibly mark inferred Projects. Explicit references and explicit projectless scope remain authoritative. Reroute-based correction remains the next capability. |
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
| Relational transcript store | Deferred | Storage technology remains scale-dependent, but removing silent transcript truncation and honoring explicit retention semantics cannot wait for a relational migration. |
| Plugin lifecycle | Deferred | It was intentionally removed from the local-first core and is not required for the current product model. |

## Recommended feature order

1. Complete the remaining inference layer: reroute/correction and compacted routing feedback.
2. Complete durable conversation semantics: thread context snapshots, prospective Thread Project-reference changes, message edit branches, deletion markers, and pins.
3. Generalize collaboration artifacts: human/agent files and normalized native permission requests.
4. Complete operability: runtime/auth diagnostics, export/import/retention, installed background service, and OS notifications.
5. Add UI/UX for the backend-ready capabilities and the features above after their behavior and contracts are stable.

## Documentation corrections made with this audit

- State documentation now identifies v17 and migrations from versions 1–16.
- Work/result binding moved from `Next` to `Working now` because run attribution, changes, traces, and validation evidence already implement it.
- Multi-Project references and Channel-context controls are marked backend-ready instead of being implied as either wholly absent or fully surfaced.
- The roadmap now separates feature behavior, later UI/UX, and scale-dependent storage work.
- Transcript truncation, runtime-specific configuration management, synthetic Codex discovery, and managed Agent creation are fixed.
