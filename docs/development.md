# Development guide

## Contributor start

The default development path is credential-free:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the Vite UI at `http://127.0.0.1:5173`. The API runs at `http://127.0.0.1:3100`. The workspace starts empty. This is intentional: contributors can work on the application and its tests without installing or authenticating an agent harness.

Read [the contributor guide](contributor-guide.md) before making a cross-cutting change. It explains which boundary owns each kind of work and which verification layer should cover it.

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

## Development workflow

1. For backend/runtime changes, add a focused failing behavior test.
2. For frontend changes, verify the real desktop browser flow and avoid styling-only click/assertion specs.
3. Confirm the evidence describes the missing behavior.
4. Implement the smallest change.
5. Run the full gates:

```bash
pnpm check                 # Biome, ESLint, TypeScript, tests, and builds
pnpm verify:live           # final release-path build and browser verification
```

`pnpm check` is the complete local gate, including Biome, ESLint, TypeScript, tests, and production builds. `verify:live` creates a fresh production build, starts the built server, and exercises the application through a real desktop browser.

On macOS, run `pnpm verify:notifications` to hand a safe test alert to
Notification Center. The command verifies that the native notifier accepted the
alert. Use **Send test notification** in Workspace settings to verify visible
delivery and get durable Inbox fallback guidance when macOS rejects it.

During iteration, use the smaller gate:

```bash
pnpm check:fast
```

It runs Biome, ESLint, type checks, the full unit/integration suite, and the representative Storybook browser suite. Use `pnpm check` before requesting review.

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

The Storybook Vitest suite validates rendering, interactions, and accessibility in a real browser. It does not compare pixels. The Chromatic panel provides optional visual-regression baselines after the repository is linked to a Chromatic project. Chromatic, docs rendering, and React docgen stay enabled in the normal Storybook workbench but are excluded from the headless test process.

`verify:live` is the production-wiring smoke test. It builds and boots the API and UI, exercises desktop and narrow layouts, and verifies the installed single-origin path. Do not put component permutations there when a deterministic Storybook story can cover them faster.

CI runs required Biome/ESLint static checks, unit/integration tests, and browser checks in parallel. Its aggregate `check` job fails unless every gate succeeds, so a failing Biome run blocks the merge. Browser jobs use the Chrome already present on the GitHub runner, while local browser tests continue to use Playwright's managed Chromium unless `COMMONSPACE_USE_SYSTEM_CHROME=1` is set.

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
