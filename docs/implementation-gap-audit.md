# Implementation gap audit

The 2026-09-03 audit found the core v0.1 conversation and local-service capabilities implemented. Desktop visual polish remained partial; additional Project resource types, relational storage, and plugins were deferred.

This is a historical snapshot of the state-v25 implementation audited on `main`, not a fresh verification of the current checkout. It compares the [Product specification](product-spec.md), [Product direction](product-direction.md), and [Product model](product.md) with the contracts, service, persistence, API, interface, and tests available at that time. Later state versions and release results must be checked separately.

## Status key

The 2026-09-05 runtime review corrected the identity claim in this historical snapshot: the implementation discovers existing Hermes profiles and the installed Codex harness. Each selected native identity is reused across conversations. The historical claim that discovery never enumerated profiles was inaccurate; the current specification describes the implemented behavior.

| Status | Meaning in this snapshot |
| --- | --- |
| Working | The audited implementation included the complete behavior described in the row. This does not claim that every control was exposed in the UI. |
| Backend-ready | Contracts, persistence, service behavior, API, and tests existed, but the UI exposed only a subset or no control. |
| Partial | A useful subset existed, but an important product promise remained incomplete. |
| Direction conflict | Behavior contradicted the documented product boundary. |
| Missing | No durable implementation was found. |
| Deferred | Outside v0.1 scope or dependent on demonstrated scale. |

## Capability audit

The tables group findings by the user experience they support. “Working” rows retain limitations such as capability-dependent runtime behavior and service-only correction controls.

### Workspace and local operation

| Product capability | Status | Evidence and limits recorded at the audit |
| --- | --- | --- |
| Local-first standalone workspace | Working | A loopback Express API, separate Vite UI, atomic local state, origin guards, and live browser verification were present. |
| Desktop visual direction | Partial | The desktop shell, collections, conversations, and Project views were being refined for consistent geometry and borders. Existing semantic color settings remained authoritative. [UI direction](ui-direction.md) defines the desktop layout and appearance rules. |
| Installed background service | Working | One-command SSH installation from `main`, a user LaunchAgent, and same-origin delivery of the built UI and API were implemented. Service controls included start, stop, restart, status, staged updates, activation health checks, automatic failed-update restoration, and explicit one-release rollback. |
| Runtime and authentication diagnostics | Working | On-demand diagnostics reported storage and projectless-workspace readiness, installed versus added runtimes, observed run readiness, recovery guidance, and local/remote inference data categories. Responses excluded credentials, host paths, and native session IDs. |

### Agents and routing

| Product capability | Status | Evidence and limits recorded at the audit |
| --- | --- | --- |
| Explicit Agent identity | Working | Each new Agent represented one explicitly selected supported installation: Codex or Hermes. Discovery did not enumerate custom profiles or create personas. Legacy identities remained loadable to preserve existing conversation history. |
| ACP capability/configuration authority | Working | Commonspace limited customization to workspace appearance. Runtime-specific configuration endpoints, CLI/profile mutation, native-configuration data contracts, and the configuration dashboard had been removed. Runtime controls had to originate in capabilities advertised through ACP. |
| Explicit mentions and peer handoffs | Working | Mentions chose the addressed agent, added it to the Channel when needed, and created bounded, non-blocking handoffs in the same visible thread. |
| Unaddressed agent selection | Working | A configured runtime or OpenAI-compatible provider chose the smallest useful agent set. The service stored the decision, start and resolution times, and routing duration separately from execution time. Invalid inference left the accepted message visible with a retryable failure and Inbox attention. |
| Unaddressed routing fan-out | Working | Inference could select agents up to the visible maximum-agents setting. The former hidden two-agent cap was removed, and unrelated native sessions remained concurrent. |
| Agent-specific request decomposition | Working | Each selected runtime received only its stored sub-request and relevant Project subset. Completed assignment details stayed out of the conversation UI. Legacy decisions migrated deterministically. |
| Reroute, correction, and routing memory | Working | Service/API corrections could change one assignment's agent and wording without restarting unrelated agents. Targets were existing Channel members; inferred Project scope was preserved. Earlier attempts and assignment-bound replies remained stored without a history cap. Explicit corrections were summarized into bounded per-Channel routing knowledge. No inline reroute control was exposed. |

### Projects and shared context

| Product capability | Status | Evidence and limits recorded at the audit |
| --- | --- | --- |
| Projects with multiple local roots | Working | Projects stored validated filesystem roots on the server. Files, Git changes, diffs, and working directories used Project/root indexes. Browser state contained stable working/reference folder labels rather than absolute roots. |
| Zero/one/many Project references | Working | Messages, threads, search, MCP context, run attribution, and multi-root launches recognized every reference. New Channel roots inferred scope unless visible `@@project` tags supplied it. No separate Project picker existed for roots, DMs, threads, branches, or reroutes, and the client did not inject a hidden first-Project fallback. |
| Prospective Thread Project-reference changes | Working | Replies inherited the latest inferred thread scope or supplied `@@project` tags for a new turn. Earlier messages, runs, and MCP scopes were unchanged. There were no dedicated Channel/Thread Project controls. |
| Projectless filesystem isolation | Working | Projectless turns received an empty Project scope and used an owner-only neutral workspace instead of the service repository or process directory. Explicit configured working directories remained supported and were validated locally. |
| Project-reference inference | Working | New roots without tags offered all Projects to inference. The inferred union was stored on the message and thread, while each assignment had its own relevant subset. Valid `@@project` tags remained authoritative; no parallel Project mode or checkbox UI existed. |
| Shared Channel context projection | Working | Commonspace derived a summary, decisions, questions, thread references, source counts, and token estimates separately from native sessions. |
| Editable and compactable Channel context | Working | The API and Channel editor supported reading, editing, and manual compaction. Automatic compaction responded to token pressure and preserved human edits. Context persisted empty, current, stale, compacting, and failed states. The UI also managed Channel note pins. |
| Thread-specific context snapshots | Working | New threads stored an immutable snapshot of the Channel's starting context and then maintained independent context. Editing, manual and pressure-triggered compaction, stale/failure states, scoped MCP reads, and an inline inspector were available. Legacy threads derived context from their transcripts without inventing a historical Channel snapshot. |

### Conversations, attachments, and attention

| Product capability | Status | Evidence and limits recorded at the audit |
| --- | --- | --- |
| Durable conversation history | Working | Message acceptance, reply append, and startup sanitization preserved the complete transcript. Regression coverage crossed the former 500-message boundary during restart and new request/reply append. |
| Channels, DMs, and threads | Working | Durable conversations included hard `/new` DM boundaries, per-thread native sessions, concurrent agents, and serialization of calls to the same session. |
| Native session continuity | Working | ACP sessions resumed by a private stored reference. Stale-session recovery and hard `/new` boundaries were implemented. |
| Image attachments | Working | Pasted and uploaded images persisted with bounded private metadata and were delivered to supported agents. |
| General human and agent files | Working | Human files persisted against exact message versions, downloaded safely, could be searched or pinned, and reached ACP sessions as baseline resource links. Known credential filenames were rejected. Capability-dependent agent resource links were copied only from permitted working roots into Commonspace storage; managed attachment metadata omitted source URIs and paths. File contents were preserved without arbitrary-content redaction. |
| Message editing and branches | Working | Editing a delivered human message created a linked version with a new Channel thread/native session or DM generation. Original messages, replies, routing, attachments, and sessions remained visible. Scoped context for a reply edit included the pre-branch transcript and corrected branch. Agent replies could not be edited. |
| Message deletion markers | Working | Deletion kept author, delivery, version, and routing identity while removing the body, attachment bytes, traces, attribution, and derived automatic context. Markers survived restart and could not be edited back into content. |
| Pins for messages/files/notes | Working | Channel and Thread pins retained their source and removal records. Pins could identify a message, exact attachment, or human note. Active Channel pins were included in Thread MCP reads, and both scopes had UI controls without exposing attachment bytes or host paths. |
| Activity traces and work/result binding | Working | Replies preserved bounded runtime-emitted plans, tools, results, usage, validation evidence, and Project/root attribution. |
| Native permission requests | Working | Requests retained only runtime-advertised choices, blocked only the affected native session, and appeared in the conversation and durable Inbox/session attention. A selection returned the exact option to the runtime. Pending requests became interrupted on shutdown or restart. |
| Inbox, unread state, search, and navigation | Working | A reply-focused Inbox, exact thread navigation, read cursors, and unified transcript search were present. Project filters recognized every referenced Project. |
| Notifications | Working | Opt-in OS notifications covered replies/input requests, owner mentions, exact ACP permission requests, failures, and timeouts. Persisted category/sound controls did not mute the Inbox. Restart and import did not replay old items; session mutes suppressed native delivery. Every alert opened a validated loopback link to the exact conversation, thread, and message. |

### Portability and deferred work

| Product capability | Status | Evidence and limits recorded at the audit |
| --- | --- | --- |
| Export, import, and retention | Working | Version-1 JSON archives preserved conversation text and exact attachment bytes while omitting Commonspace-managed path, native-session, capability, and credential fields. This was metadata sanitization, not removal of sensitive content from arbitrary text or files. Archives were unencrypted private user data. Import required a clean workspace, attachment validation, and explicit local root mappings. Revision-bound retention covered one Channel or DM and rejected live/queued runs and context or routing compaction. See [Workspace archive format](workspace-archive-format.md). |
| Extensible Project resources | Deferred | PRJ-08 reserved non-folder resources for later. v0.1 supported one or more local folders. |
| Relational transcript store | Deferred | Storage technology depended on measured scale. Complete transcript preservation and explicit retention were required regardless of a future relational migration. |
| Plugin lifecycle | Deferred | A generic plugin lifecycle was outside the local-first core and was not required by the product model. |

## Recommended feature order

The next release step recorded by this audit was to repeat the real-runtime, isolated service-lifecycle, and browser acceptance gates on a clean supported release machine. The [Roadmap](roadmap.md#release-readiness) and [v0.1 acceptance ledger](v0.1-acceptance.md#current-release-gates) describe the gates to run for a candidate now.

## Documentation corrections made with this audit

The snapshot used state version 25 and migration coverage from versions 1–24. Later implementation changes require later state-version documentation and fresh evidence; this historical record does not establish their status.

The audit also corrected earlier descriptions that understated multi-Project context, context controls, work/result attribution, export/import, retention, notifications, and the installed service lifecycle. The capability tables above record those findings together with their UI and runtime limits. Desktop polish remained separate from the implemented service behavior.
