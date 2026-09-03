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
The development API server does not serve `ui/dist`; open the Vite URL for the UI.

## Self-development hot reload

The development server runs behind a stable local supervisor. Changes under `server/src` or `packages/shared/src` request a new server generation without terminating active agent turns. The old generation keeps its ACP processes and Commonspace MCP endpoint alive, continues accepting concurrent work, and exits at the first all-idle boundary. Multiple edits made while agents are working are coalesced into one restart. The browser reconnects its revision stream after the replacement server is healthy.

`SIGINT` and `SIGTERM` remain explicit forced shutdowns: they cancel active work instead of waiting for a development reload boundary.

## Workspace map

- `packages/shared/src` — versioned contracts and pure shared helpers.
- `server/src/state.ts` — deterministic mutations.
- `server/src/service.ts` — persistence, routing, sessions, and process lifecycle.
- `server/src/app.ts` — Express API, loopback/origin guards, SSE, and media streaming.
- `server/src/dev.ts` and `dev-supervisor.ts` — coalesced, idle-gated development restarts.
- `server/src/index.ts` — process startup and shutdown.
- `ui/src/commonspace-store.ts` — observable API client state.
- `ui/src/CommonspaceSidebar.tsx` — Projects, Channels, DMs, and Agents.
- `ui/src/CommonspaceConversation.tsx` — messages, threads, commands, and composer.
- `ui/src/AgentTrace.tsx` — expandable provider-emitted reasoning, plan, tool, and usage activity.
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

## Fast UI loop

Keep Storybook running while working on visible UI:

```bash
pnpm storybook
```

The Storybook testing panel can watch the selected story and rerun only its component, interaction, and accessibility checks after an edit. The equivalent focused terminal loop accepts a story-file filter:

```bash
pnpm test:storybook:watch -- Conversation
```

Use the six representative screen stories for a quick cross-screen check, then run the complete browser suite before handing off visible work:

```bash
pnpm test:storybook:smoke
pnpm check:ui
```

The Storybook Vitest suite validates rendering, interactions, and accessibility in a real browser. It does not compare pixels. The Chromatic panel provides optional visual-regression baselines after the repository is linked to a Chromatic project; it is intentionally excluded from the local headless test process.

`verify:live` is the production-wiring smoke test. It builds and boots the API and UI, exercises desktop and narrow layouts, and verifies the installed single-origin path. Do not put component permutations there when a deterministic Storybook story can cover them faster.

CI runs static checks, unit/integration tests, and browser checks in parallel. Browser jobs use the Chrome already present on the GitHub runner, while local browser tests continue to use Playwright's managed Chromium unless `COMMONSPACE_USE_SYSTEM_CHROME=1` is set.

The macOS lifecycle manager can install the current committed `main` checkout through `pnpm service:install`. Use `pnpm service:status`, `service:stop`, `service:start`, `service:update`, and `service:rollback` to exercise the packaged path. It writes only the managed paths documented in [Operations](operations.md); normal development does not register a background service.

## Contract changes

Cross-process shapes have one writer: `packages/shared`. When changing persisted state:

1. Increment `COMMONSPACE_STATE_VERSION` when compatibility changes.
2. Sanitize every loaded field.
3. Migrate during initialization and persist the result.
4. Redact host-private session references from API snapshots.
5. Add malformed-state, migration, and rollback tests.
6. Update architecture and operations documentation.

## Agent runtime changes

Hermes and Codex ACP lifecycle code lives in the server. Activity traces must remain provider-neutral, bounded, and derived only from ACP updates the native runtime emits. Real runtime smoke tests are opt-in because they use local credentials and model access.

Commonspace must not inspect or mutate runtime-specific Agent configuration through provider CLIs or profile files. Agent capabilities and controls belong in shared contracts only after the connected harness advertises them through ACP.
