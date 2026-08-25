# Development guide

## Prerequisites

- Node.js 22+
- pnpm 10+
- DeepSeek Harness Web `0.1.1-rc.2`+
- At least one configured Hermes, Codex CLI, or Claude Code runtime for live execution tests

## Setup

```bash
pnpm install
pnpm check
```

`pnpm check` is the release gate: ESLint, TypeScript, Vitest, and both host/client builds.

## Repository map

- `src/contracts.ts` — versioned API/state contracts.
- `src/host/state.ts` — deterministic mutations.
- `src/host/service.ts` — validation, persistence, routing, locking, subprocess lifecycle, and same-origin routes.
- `src/host/hermes.ts` — Hermes discovery/invocation plus common prompt/routing helpers.
- `src/host/adapters.ts` — Codex and Claude invocation builders/parsers.
- `src/host/memory.ts` — Channel memory projection.
- `src/client/commonspace-store.ts` — browser state and API client.
- `src/client/CommonspaceSidebar.tsx` — Projects, Channels, DMs, and Agents navigation.
- `src/client/CommonspaceConversation.tsx` — messages, threads, commands, and composer.
- `src/client/slash-commands.ts` — command registry, aliases, and resolver.
- `src/client/styles.ts` — compatibility/base styles.
- `src/client/polish.ts` — semantic Commonspace design layer.
- `scripts/verify-live.mjs` — real DSH browser acceptance path.

## Change workflow

1. Write a failing focused test.
2. Run only that test and verify the failure is meaningful.
3. Implement the smallest production change.
4. Run the focused tests.
5. Run `pnpm check` once the slice is complete.
6. For visible work, rebuild, restart linked DSH Web, run `pnpm verify:live`, and inspect screenshots.
7. Review `git diff --check` and the complete diff before committing.

Do not modify DeepSeek Harness core files. Commonspace remains an external bundle that uses public Cordis/DSH extension points.

## State changes

When changing persisted state:

1. Increment `COMMONSPACE_STATE_VERSION`.
2. Keep older supported versions in the load gate.
3. Structurally sanitize every loaded field; never cast raw JSON into a state interface.
4. Canonicalize persisted filesystem paths before adapters can use them.
5. Redact host-private values from browser/API snapshots.
6. Persist the migrated state during initialization.
7. Add tests for malformed old state, migration durability, and rollback notes.
8. Update `docs/architecture.md` and `docs/operations.md`.

## Verification commands

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm check
pnpm verify:adapters:codex
pnpm verify:adapters:claude
```

The real adapter checks are opt-in and consume the installed CLI's configured model access. A passing unit suite is not a substitute for a real start/resume smoke test, but an authentication failure is reported as an external blocker rather than fabricated success.

## Live DSH verification

Link the checkout once:

```bash
pnpm build
dsh plugin --profile web add .
dsh web --no-open --port 3080
```

Then run:

```bash
COMMONSPACE_TEST_URL=http://127.0.0.1:3080 \
COMMONSPACE_TEST_PROJECT="$PWD" \
pnpm verify:live
```

The verifier checks mode switching, the real Hermes roster, Project paths, Channel settings and memory, immediate root acceptance, thread isolation, DM picker, slash commands, a real DM, reload persistence, and restoration of native Workspaces.

Artifacts are written under ignored `artifacts/`. Set `COMMONSPACE_UPDATE_DOCS=1` only when deliberately refreshing the checked-in sidebar image.
