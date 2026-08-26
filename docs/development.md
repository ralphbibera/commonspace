# Development guide

## Setup

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Development services:

- UI: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3100`

Vite proxies `/api` to the server, so browser code always uses same-origin relative paths.

## Workspace map

- `packages/shared/src` — versioned contracts and pure shared helpers.
- `packages/adapters/src` — Hermes, Codex CLI, and Claude Code invocation and parsing.
- `server/src/state.ts` — deterministic mutations.
- `server/src/service.ts` — persistence, routing, sessions, and process lifecycle.
- `server/src/app.ts` — Express API and production asset serving.
- `server/src/index.ts` — process startup and shutdown.
- `ui/src/commonspace-store.ts` — observable API client state.
- `ui/src/CommonspaceSidebar.tsx` — Projects, Channels, DMs, and Agents.
- `ui/src/CommonspaceConversation.tsx` — messages, threads, commands, and composer.
- `ui/src/main.tsx` — standalone browser mount.

## Test-driven workflow

1. Add a focused failing test in `tests/` or beside a package module.
2. Confirm the failure describes the missing behavior.
3. Implement the smallest change.
4. Run the focused test.
5. Run the full gates:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:live
```

`pnpm check` combines lint, typecheck, tests, and build. `verify:live` additionally starts the built server and exercises the application through a real browser.

## Contract changes

Cross-process shapes have one writer: `packages/shared`. When changing persisted state:

1. Increment `COMMONSPACE_STATE_VERSION` when compatibility changes.
2. Sanitize every loaded field.
3. Migrate during initialization and persist the result.
4. Redact host-private session references from API snapshots.
5. Add malformed-state, migration, and rollback tests.
6. Update architecture and operations documentation.

## Adapter changes

Adapters build argument arrays and parse results; they do not read credentials or spawn processes. Real adapter smoke tests are opt-in because they use the locally authenticated CLI and may consume model access.
