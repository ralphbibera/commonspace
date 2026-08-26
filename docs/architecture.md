# Architecture

## Shape

Commonspace is a pnpm workspace with four explicit boundaries:

```text
packages/shared    Domain contracts and pure shared helpers
packages/adapters  CLI invocation builders and output/session parsers
server             Express API, durable state, routing, and agent execution
ui                 Vite/React browser application
```

The structure borrows mature separation patterns without importing another product's domain. Commonspace remains scoped to Projects, Channels, Direct Messages, Agents, Messages, threads, and context continuity.

## Request path

The Vite development server proxies `/api` to `127.0.0.1:3100`. A production build places browser assets in `ui/dist`; the Express server serves those assets and the same API from one origin.

Endpoints:

- `GET /api/health`
- `GET /api/bootstrap`
- `GET /api/events`
- `POST /api/mutate`
- `POST /api/send`

Server-sent revision events prompt the UI store to refresh. State revisions prevent an older response from replacing newer browser state.

## Server

`server/src/service.ts` owns domain behavior:

- versioned state loading and structural sanitization;
- canonical Project paths;
- atomic persistence under `~/.commonspace`;
- message acceptance and thread creation;
- native session mapping and stale-session recovery;
- immediate message acceptance, concurrent cross-agent delivery, and same-native-session serialization;
- bounded agent-authored mention handoffs carrying the root message and recent room context;
- bounded subprocess execution and output capture;
- generation-safe DM resets;
- revision subscriptions.

`server/src/app.ts` owns HTTP concerns: JSON limits, loopback and same-origin guards, SSE framing, API status codes, static assets, SPA fallback, and security headers.

`server/src/index.ts` owns process startup, configuration, signal handling, and server shutdown.

## Shared contracts

`packages/shared` defines the state and API shapes consumed by both server and UI. Native session names and IDs remain in host-private state and are removed from browser snapshots.

## Adapters

`packages/adapters` has no credential logic. It constructs argument arrays, validates native session identifiers, parses CLI output, and builds bounded room prompts. The server launches the commands and owns process lifecycle.

## UI

`ui/src/main.tsx` mounts a normal React root and shared styles. `CommonspaceApp` composes the responsive navigation and conversation surface. `CommonspaceClientStore` owns bootstrap state, selection, sends, mutations, and revision-event refreshes.

## Persistence

State v6 is retained during the standalone extraction, so existing `~/.commonspace/state.json` data remains usable. Writes use a temporary file followed by rename. A future database migration must preserve this migration path and provide rollback evidence.
