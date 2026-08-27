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

Hermes launches one profile-scoped ACP process with `hermes -p <profile> acp`; Codex uses its bundled ACP bridge. Native sessions receive exactly one new Commonspace message per turn. Shared room context stays available through native MCP tools. Commonspace projects ACP reasoning, plan, tool-call, and usage updates into one bounded provider-neutral activity contract; it does not reinterpret or synthesize harness reasoning.

## UI

`ui/src/main.tsx` mounts a normal React root and shared styles. `CommonspaceApp` composes the responsive navigation and conversation surface. `CommonspaceClientStore` owns bootstrap state, selection, sends, mutations, and revision-event refreshes.

## Persistence

State v12 persists the Hermes/Codex roster, Commonspace-local agent appearance, opaque provider-native session references, sanitized per-reply activity traces, the single-owner Inbox read cursor, and managed image attachment metadata. Versions 1–11 migrate on load through structural sanitization. Writes use a `0600` temporary file followed by atomic rename. Trace payloads are bounded and host details are redacted before persistence; MCP capabilities stay in memory and native session references are removed from browser snapshots.
