# Architecture

## Shape

Commonspace is a pnpm workspace with three explicit boundaries:

```text
packages/shared    Domain contracts and pure shared helpers
server             Express API, durable state, local relay, ACP/MCP, and execution
ui                 Vite/React browser application
```

The structure borrows mature separation patterns without importing another product's domain. Commonspace remains scoped to Projects, Channels, Direct Messages, Agents, Messages, threads, and context continuity.

## Request path

The Vite development and preview servers proxy `/api` to the Commonspace API at `127.0.0.1:3100`. A production build places browser assets in `ui/dist`; Vite serves those assets separately while Express serves the API only.

Endpoints:

- `GET /api/health`
- `GET /api/bootstrap`
- `GET /api/diagnostics`
- `GET|PUT /api/routing`
- `GET|PUT /api/channels/:channelId/context`
- `POST /api/channels/:channelId/context/compact`
- `GET|PUT /api/threads/:threadId/context`
- `POST /api/threads/:threadId/context/compact`
- `GET /api/projects/:projectId/files|file|changes|diff`
- `POST /api/discover-agents`
- `POST /api/reroute`
- `POST /api/messages/:messageId/edit|delete`
- `POST /api/pins`
- `POST /api/pins/:pinId/remove`
- `POST /api/permissions/:permissionId/respond`
- `POST /api/stop`
- `GET /api/attachments/:attachmentId`
- `GET /api/files/:fileId`
- `GET /api/events`
- `POST /api/mcp` (bearer-scoped ACP clients only)
- `POST /api/select-directory`
- `POST /api/mutate`
- `POST /api/send`

Server-sent revision events prompt the UI store to refresh persisted state. Separate activity events carry ephemeral provider-emitted entries for turns still running; state revisions prevent an older response from replacing newer browser state.

## Server

`server/src/service.ts` owns domain behavior:

- versioned state loading and structural sanitization;
- canonical Project paths;
- atomic persistence under `~/.commonspace`;
- message acceptance and thread creation;
- linked single-assignment rerouting that retains prior attempts and dispatches only the corrected assignment;
- message-version branches, deletion-marker redaction, and durable scoped pins;
- bounded general-file persistence, credential-name rejection, ACP resource links, and permitted-root Agent artifact imports;
- durable normalized ACP permission requests with exact option responses and per-session blocking;
- path-safe harness/service readiness diagnostics and inference data-flow disclosure;
- zero-to-many Project references on messages and threads, with a compatibility mirror for older clients;
- editable Channel context plus manual and token-pressure compaction through the configured inference provider;
- immutable Thread snapshots, independently editable/compactable Thread context, and prospective per-reply Project defaults;
- native session mapping and stale-session recovery;
- one long-lived provider-neutral ACP stdio process per Hermes or Codex agent;
- delta-only ACP delivery and exact opaque-session `session/load` resumption;
- ephemeral, session-scoped MCP capabilities for bounded context reads and visible progress;
- immediate message acceptance, concurrent cross-agent delivery, and same-native-session serialization;
- bounded agent-authored mention handoffs carrying only the newly delivered handoff message;
- bounded ACP frames and responses;
- generation-safe DM resets;
- native turn cancellation on reset, Channel removal, agent removal, timeout, and shutdown;
- revision subscriptions.

`server/src/app.ts` owns HTTP concerns: JSON limits, loopback and same-origin guards, SSE framing, API status codes, health checks, and security headers.

`server/src/acp-runtime.ts` owns the provider-neutral ACP client and subprocess lifecycle. `server/src/commonspace-mcp.ts` owns the stateless loopback MCP transport, ephemeral capabilities, and scoped tools. `server/src/index.ts` owns process startup, configuration, signal handling, and graceful shutdown.

In development, `server/src/dev-supervisor.ts` is the stable watcher process. It requests an idle-gated generation swap over child-process IPC instead of signaling the server directly. The serving generation keeps its ACP children and MCP endpoint alive until every accepted turn completes; edit bursts collapse into one replacement. Explicit process signals retain forced-shutdown semantics.

The relay is deliberately local: ACP runs over child-process stdio and Commonspace MCP runs over authenticated loopback HTTP. No Nostr or remote relay transport participates in the first local-only architecture.

## Shared contracts

`packages/shared` defines the state and API shapes consumed by both server and UI. Native session names and IDs remain in host-private state and are removed from browser snapshots.

## Agent runtimes

Hermes launches its installed harness through `hermes acp`; Codex uses its bundled ACP bridge against the installed Codex CLI. Commonspace exposes one workspace Agent identity per supported harness, while each Thread or DM generation retains its own native session. Native sessions receive exactly one new Commonspace message per turn plus baseline ACP resource links for attached files. Shared room context stays available through native MCP tools. Commonspace projects ACP reasoning, plan, tool-call, usage, resource-link artifacts, and permission requests into bounded provider-neutral contracts; it does not reinterpret or synthesize harness reasoning, files, or permission choices.

## UI

`ui/src/main.tsx` mounts a normal React root and shared styles. `CommonspaceApp` composes the responsive navigation and conversation surface. `CommonspaceClientStore` owns bootstrap state, selection, sends, mutations, and revision-event refreshes.

## Persistence

State v23 persists the roster, local appearance, opaque native-session references, sanitized activity traces, Inbox read state, image/general-file metadata, routing decisions/corrections, Channel routing memory, zero-to-many Project references, Channel/Thread context, scoped pin history, message-version branches, deletion markers, normalized permission requests, and current Channel/DM execution state. Versions 1–22 migrate on load through structural sanitization; legacy routing receives deterministic assignments, legacy Threads receive honest empty inherited snapshots plus transcript-derived current memory, and older workspaces receive empty pin/permission history. Loaded pending permissions become interrupted because no native request survives process restart. Accepted messages, branches, routing attempts, pin tombstones, and permission outcomes are retained without an implicit count window; bounds apply to derived context and activity rather than the canonical record. Deleting delivered content redacts its body, routing wording, attachment metadata/bytes, traces, and automatic projections while preserving delivery and branch metadata. Attachment bytes and the managed projectless workspace use owner-only local storage. Writes use a `0600` temporary file and atomic rename while retaining the previous valid state as `state.backup.json`. If the primary is invalid and the backup is valid, startup preserves the primary as `state.corrupt.json` and recovers the backup. Trace payloads are bounded and host details are redacted before persistence; MCP capabilities, source file URIs, and native session references are removed from browser snapshots.

## Routing inference

Every unaddressed Channel message is classified by inference after durable acceptance. The decision stores one bounded sub-request and Project subset per selected harness; delivery sends only that assignment while the original message remains canonical and available through scoped context. A new root with no Project selection offers all configured Projects to inference, persists the inferred union on its message/Thread, and visibly marks inferred assignment scope. Explicit Project references constrain the available set, while an explicit empty set remains projectless. A user can supersede one assignment by changing its Agent, wording, or Project subset; Commonspace retains both attempts, binds replies to their assignment IDs, and does not restart unrelated Agents. Each correction is compacted into bounded per-Channel routing knowledge and supplied to later decisions without rewriting history. The same Commonspace inference layer performs routing, routing-memory compaction, and Channel-context compaction. Commonspace supports either a configured agent harness or an OpenAI-compatible endpoint; there is no deterministic/no-inference provider mode. Explicit `@agent` addressing remains authoritative. Stored API keys are never returned to the browser, are cleared when the configured endpoint origin changes, and `OPENAI_API_KEY` is used only for the canonical OpenAI origin.
