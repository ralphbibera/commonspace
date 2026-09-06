# Development guide

Use this guide to run Commonspace from source, choose the right verification loop, and change shared or runtime behavior safely. Start with [Contributing](../CONTRIBUTING.md) for the contribution process and [Installation](install.md) if you only want to run the application.

## Setup

Use Node.js 22 or newer, Git, and the pnpm version pinned by `packageManager` in [`package.json`](../package.json). Corepack can provide that pnpm version.

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the UI at `http://127.0.0.1:5173`. The API runs at `http://127.0.0.1:3100`. Vite forwards `/api` requests to the server, so browser code uses relative, same-origin API paths. The development API server does not serve the browser application; use the Vite URL.

A new workspace starts empty. Agent credentials are optional for application development: unit tests, Storybook, and the standard live verifier do not require an authenticated harness. Use `COMMONSPACE_HOME` to keep development data separate from an existing workspace; see [runtime configuration](operations.md#runtime-configuration).

Install the browser used by local checks after installing dependencies:

```bash
pnpm exec playwright install chromium
```

## Workspace map

| Location | Responsibility |
| --- | --- |
| `packages/shared/src` | Versioned contracts and pure shared helpers |
| `server/src/state.ts` | Deterministic state transitions and migration rules |
| `server/src/service.ts` | Persistence, routing, context, and native-session coordination |
| `server/src/app.ts` | Express API, origin guards, event streams, and media responses |
| `server/src/dev.ts`, `server/src/dev-supervisor.ts` | Development restarts |
| `server/src/index.ts` | Process startup, configuration, and shutdown |
| `ui/src/commonspace-store.ts` | Browser state and API coordination |
| `ui/src/CommonspaceSidebar.tsx` | Workspace navigation |
| `ui/src/CommonspaceConversation.tsx` | Messages, Threads, commands, and composer |
| `ui/src/AgentTrace.tsx` | Expandable harness activity |
| `ui/src/stories` | Isolated screen and component states |
| `ui/src/main.tsx` | Browser entry point |

Read [Architecture](architecture.md) before a change that crosses these boundaries.

## Development workflow

1. Describe the user-visible problem, the product rule involved, and the owning boundary.
2. For behavior changes, add a focused failing test that demonstrates the missing behavior. For visual-only changes, identify the Storybook states and desktop interactions that need review.
3. Implement the smallest change and rerun the focused verification.
4. Update the affected user and developer documentation.
5. Run the complete local check. Run the live verifier for server or visible end-to-end changes.

```bash
pnpm check
pnpm verify:live
```

Choose checks by the evidence you need:

| Command | What it verifies |
| --- | --- |
| `pnpm check:fast` | Formatting, lint, types, unit/integration tests, and representative Storybook browser tests during iteration |
| `pnpm check` | The full local gate, including all Storybook browser tests and production application and Storybook builds |
| `pnpm verify:live` | A fresh production build and the integrated desktop browser flow through both separate development-style servers and the installed single-origin path |
| `pnpm check:ui` | UI types, the complete Storybook browser suite, and the production UI build |

The live verifier uses temporary workspace data and test runtimes. It proves production wiring without proving that an authenticated external agent works. Real harness checks are a separate opt-in step described below.

## Fast UI loop

Run Storybook while editing components:

```bash
pnpm storybook
```

Open `http://localhost:6006`. Stories use local fixtures, so they do not need the Commonspace API. The testing panel can rerun the selected story's interactions and accessibility checks after an edit.

For a focused terminal loop, pass a story-file filter:

```bash
pnpm test:storybook:watch -- Conversation
```

Use the representative screen suite for a quick check, then the full UI gate before handing off visible work:

```bash
pnpm test:storybook:smoke
pnpm check:ui
```

Storybook's Vitest suite checks rendering, interactions, and accessibility in a real browser. Pixel comparisons use the separate `pnpm test:visual` command. The optional Chromatic integration also needs a configured project; it is not required for the local workflow.

Use the Light / Dark toolbar to inspect the actual rendering, including overlays. The [Storybook coverage map](storybook-coverage.md) lists dedicated primitive, workspace, routing, sorting, and follow-up states with focused commands. Follow [Visual verification](visual-verification.md) for screenshot review and baseline changes. Keep component permutations in Storybook and use `verify:live` for behavior that depends on the assembled application.

## Self-development hot reload

A stable supervisor watches `server/src` and `packages/shared/src`. After an edit, the running server keeps its agent processes and context endpoint alive until all accepted turns finish. Multiple edits during active work become one restart. The browser reconnects after the replacement server is healthy.

The server continues accepting work while waiting, so continuous activity can delay a reload. `SIGINT` and `SIGTERM` are explicit shutdowns: they cancel active work rather than wait for this idle boundary.

## CI and service verification

CI runs static/build checks, unit/integration tests, browser checks, and a Linux release-package smoke test in parallel. The aggregate `check` job succeeds only when all four jobs pass. GitHub enforces it as a merge requirement only after a maintainer configures branch protection; see [Maintaining](maintaining.md).

CI browser jobs use the runner's installed Chrome. Local checks use Playwright's managed Chromium unless `COMMONSPACE_USE_SYSTEM_CHROME=1` is set.

Normal development does not register a background service. To exercise source-based macOS installation, use `pnpm service:install` with a committed `main` checkout. The service commands and managed paths are documented in [Operations](operations.md#installed-macos-service).

## Release packaging

Packaging requires Git and Corepack in addition to Node.js and pnpm. To build and verify an archive for the current operating system and architecture:

```bash
pnpm release:pack
pnpm verify:release
```

`release:pack` includes a production build. `release:pack:built` packages an existing build. Output goes to the ignored `artifacts/release/` directory. The verifier extracts and runs the archive outside the source checkout without agent credentials.

For an archive installation on macOS, run `node scripts/commonspace-service.mjs install --release .` inside the extracted directory. See [Installation](install.md) for the full procedure and [Releasing](releasing.md) for supported targets, versioning, and release steps.

## Contract changes

`packages/shared` owns every shape exchanged between the server and UI. Update the shared contract, all consumers, tests, and documentation together.

When a persisted shape changes:

1. Increment `COMMONSPACE_STATE_VERSION` when compatibility changes.
2. Validate and sanitize every field loaded from disk.
3. Migrate during initialization and persist the migrated result.
4. Remove host-private paths and native-session references from browser snapshots.
5. Cover malformed state, migration, and recovery with focused tests.
6. Update [Architecture](architecture.md) and [Operations](operations.md).

## Agent runtime changes

The server owns Agent Client Protocol (ACP) integration. ACP connects Commonspace to a supported local harness and reports its session capabilities, activity, and permission choices. Commonspace must reflect those reports without inventing capabilities or changing provider-specific profiles.

Keep activity provider-neutral, bounded, and based only on emitted ACP updates. Runtime-specific credentials, configuration, and native transcripts remain owned by Hermes or Codex.

Real harness checks use local credentials and model access, so run only those relevant to the integration being changed:

```bash
pnpm verify:acp:hermes
pnpm verify:acp:codex
pnpm verify:acp:mcp
```

The first two check native session startup and resumption. The MCP check also requires real harnesses to read scoped context and post visible progress. These checks complement deterministic tests; they do not replace them.

The Codex live checks honor `COMMONSPACE_CODEX_PATH` when testing a particular installed CLI. Use a complete runtime installation, including its Code Mode companion when that feature is enabled. The selected CLI must support the model configured in its native settings; an authenticated but outdated CLI can still fail model requests.

On macOS, `pnpm verify:notifications` checks whether the native notifier accepts a safe test alert. Use **Send test notification** in Workspace settings to check visible delivery and follow any operating-system guidance.
