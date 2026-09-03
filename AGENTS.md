# Commonspace development contract

This file applies to the entire repository. It is the execution contract for agents working on Commonspace; product detail remains in `docs/`.

## Instruction order and scope control

1. Follow the latest user instruction or correction.
2. Follow this file.
3. Follow `docs/product-spec.md`, `docs/product.md`, and `docs/product-direction.md` for product behavior.
4. Follow `docs/architecture.md`, `docs/development.md`, and `docs/design-system.md` for implementation constraints.
5. Treat current code and tests as evidence of the implementation, not permission to contradict the intended product.

A correction immediately supersedes an incompatible earlier plan. Stop the old path instead of finishing it first.

Before editing, reduce the request to five concrete facts:

- requested outcome;
- exact target surface or files;
- named source/reference;
- explicitly excluded adjacent work;
- evidence that will prove completion.

Keep those facts stable throughout the task. Do not turn a narrow request into a redesign, broad audit, dependency upgrade, test-infrastructure project, or documentation sweep. Do not narrate a plan when the next supported tool call can perform the work.

Inspect live sources first. When the user provides a repository, file, URL, screenshot, running app, or named local reference, inspect that source directly before searching past sessions. Use session history only when the request is about prior work or the live source is unavailable.

## Shared working-tree safety

Coding-agent sessions may have isolated conversation context while sharing the same checkout. Treat the working tree as concurrently accessible even when the chats are separate.

- Run `git status --short` before editing and inspect the scoped diff for every target file.
- One session is the writer for a file or tightly coupled artifact set. Other sessions may inspect or report evidence, but must not edit those artifacts concurrently.
- Preserve all pre-existing work. Never reset, stash, revert, overwrite, or broadly format changes you did not create.
- Use targeted edits. Do not run repository-wide autofixes in a dirty tree.
- A failed patch, unexpectedly changed target, or diff that moves between reads is a collision signal. Re-read once; if another writer is active, stop and report the exact conflicting files instead of forcing the edit.
- Track every process and temporary directory created by the current task. Stop or delete only those exact resources. Never clean broad temp globs or another repository's fixtures.

Runtime concurrency is a product feature; concurrent mutation of the same source artifact is not.

## Product contract

Commonspace is a standalone, local-first conversation workspace for one human working with supported local agent harnesses.

Non-negotiable invariants:

- Conversation is the work record. Do not add a parallel ticket, task, goal, company, org-chart, approval, or work-queue domain.
- Projects are explicit context references, not containers that own Channels or conversations.
- Channels are global shared rooms. A message or thread carries zero, one, or many Project references; the Channel itself does not inherit Project scope.
- Threads are focused conversation continuations, not tasks.
- Direct Messages preserve exact native-session continuity. `/new` creates a hard boundary and must not leak old context or stale replies into the new session.
- Agents are real ACP harnesses. Workspace names, avatars, and accents are local aliases; they must not rename or reconfigure the native harness.
- Inbox contains durable user-relevant replies, mentions, permissions, failures, and timeouts—not thinking, progress chatter, or generic runtime status.
- Each visible message owns its avatar, author, timestamp, body, attachments, and activity. Message times remain visible.
- Explicit `@agent` and `@@project` references are authoritative.
- Unaddressed Channel routing always uses configured BYO inference and selects the smallest useful harness set. Do not add a deterministic/no-inference routing mode.
- Shared context belongs to Commonspace; private model context, credentials, tools, permissions, and native sessions remain owned by Hermes or Codex.
- Commonspace must not depend on DeepSeek Harness, Cordis, OpenAgents, Hermes Kanban, Paperclip's product model, or another hidden agent runtime.

A borrowed implementation pattern must not import the reference product's domain.

## Architecture and ownership

The pnpm workspace has three primary boundaries:

- `packages/shared` owns versioned cross-process contracts and pure shared helpers.
- `server` owns Express APIs, validation, routing, persistence, ACP/MCP integration, concurrency, subprocess lifecycle, and shutdown.
- `ui` owns the Vite/React interface and communicates with the server only through shared contracts and same-origin `/api` endpoints.

Important file ownership:

- `server/src/state.ts`: deterministic state mutations.
- `server/src/service.ts`: domain behavior, persistence, routing, sessions, and process lifecycle.
- `server/src/app.ts`: HTTP boundary, loopback/origin guards, SSE, and media delivery.
- `server/src/acp-runtime.ts`: provider-neutral ACP lifecycle.
- `server/src/commonspace-mcp.ts`: scoped loopback MCP transport and capabilities.
- `ui/src/commonspace-store.ts`: browser-side API and observable state.
- `ui/src/CommonspaceSidebar.tsx`: Projects, Channels, DMs, and Agents navigation.
- `ui/src/CommonspaceConversation.tsx`: messages, threads, commands, and composer.
- `ui/src/AgentTrace.tsx`: bounded harness-emitted activity.

Put a cross-process shape in `packages/shared` first. Do not duplicate wire contracts in `server` and `ui`.

For persisted-state changes:

1. increment `COMMONSPACE_STATE_VERSION` when compatibility changes;
2. sanitize every loaded field;
3. migrate during initialization and atomically persist the result;
4. retain rollback/recovery behavior;
5. remove host paths, credentials, capabilities, and native session identifiers from browser-visible snapshots;
6. add malformed-state, migration, and rollback evidence.

Bind services to loopback, preserve same-origin mutation guards, invoke CLIs with argument arrays and piped input, and never construct shell command strings from user data.

## Reference-driven work

Use the reference named in the current task only for the requested layer.

### UI and visual parity

- `docs/design-system.md` is the default repository design contract when the user does not name another source.
- If the user names a local Mattermost clone, Apple prototype, screenshot, or other reference, inspect its actual pixels and relevant interaction states. Paths, DOM text, stale screenshots, and model confidence are not visual proof.
- Copy the requested geometry, hierarchy, behavior, or component pattern; do not invent decorative controls or import the reference product's features.
- Make the smallest scoped edit, inspect the rendered Commonspace result once at the required viewport/state, and stop when the requested result is confirmed.
- Do not replace visual inspection with Playwright assertions or a prose description.

### Paperclip E2E reference

When the request is to copy or follow Paperclip's E2E setup, inspect the Paperclip source provided or available for the task and its relevant E2E package scripts first. Do not assume a machine-specific checkout path.

Port the harness structure, adapting it to Commonspace:

- Playwright-owned `webServer` lifecycle;
- isolated temporary state;
- deterministic seed data;
- a health-gated server;
- automatic cleanup;
- project-owned browser assertions.

Do **not** substitute a persistent seeded development preview such as `dev:e2e`. Do not run Paperclip's suite, inspect unrelated Paperclip UI components, modify Paperclip, or delete Paperclip temporary state unless the task explicitly requires that action.

Storybook, visual regression, and E2E are separate deliverables. Do not conflate them.

## Implementation workflow

1. Inspect `git status`, the exact target files, and the governing documentation.
2. Inspect the named source/reference narrowly; stop searching once the needed pattern is understood.
3. Identify the owner boundary and the smallest coherent file set.
4. For behavior changes, establish focused failing evidence before implementation.
5. Implement the smallest complete vertical slice. Prefer explicit state, guard clauses, narrow error boundaries, and resource ownership tied to lifetime.
6. Exercise the real path affected by the change.
7. Inspect the scoped diff and remove accidental churn.
8. Report the changed target, commands exercised, observed results, skipped checks, remaining risk, and rollback when applicable.

Do not continue adjacent cleanup after the acceptance criterion is met. Do not add abstractions, dependencies, fallbacks, or compatibility layers without a concrete requirement.

## Testing and verification

Tests must protect project-owned behavior and be capable of detecting a realistic defect.

- Backend, state, routing, persistence, or session behavior: add a focused failing test, then implement.
- Cross-process contract changes: test the producer and consumer boundary.
- UI behavior changes: use focused interaction evidence at the level where the behavior is observable.
- Small visual/CSS-only changes: do not add absence-only, styling-only, or click/assertion tests. Verify actual rendered pixels and interaction states in the browser.
- E2E harness work: exercise isolated boot, seed, navigation, assertions, and teardown through `tests/e2e`.
- Storybook work: verify the specific story and use `pnpm test:storybook` only when the story test is part of the request.
- Real ACP checks use local credentials and model access. Run `pnpm verify:acp*` only when explicitly required.
- Service lifecycle checks affect the installed macOS path. Run `pnpm verify:service` only for service/installer work.

Useful commands:

```bash
pnpm test                         # unit and integration suite
pnpm typecheck                    # workspace TypeScript checks
pnpm biome:check                  # lint and formatting gate
pnpm check                        # Biome, types, and tests
pnpm test:e2e                     # isolated Commonspace Playwright E2E
pnpm test:e2e:headed              # headed E2E inspection
pnpm test:storybook               # Storybook browser tests
pnpm test:visual                  # explicit visual-regression suite
pnpm verify:live                  # production build plus real browser path
```

For behavior or cross-boundary implementation, the default completion gates are `pnpm check` and `pnpm verify:live`. During iteration, run the narrowest relevant command first. For a narrowly scoped visual-only task, use scoped static checks plus real browser verification; do not invent tests merely to satisfy a ritual, and state any full gates not run.

Never hide a failing exit code with a pipeline or fallback command. A failing check remains a blocker until fixed or explicitly reported.

## Browser and process discipline

- Run bounded builds and tests in the foreground with a generous timeout.
- Start long-lived development servers as tracked background processes without `watch_patterns` or `notify_on_complete` noise.
- After starting a server, verify readiness directly through its health endpoint, port, or browser in the next tool call. Do not wait for readiness by injecting synthetic process messages into the chat.
- Record the process identifier and stop only the server started by the current task.
- Reuse an existing healthy server only after confirming its URL and ownership; never kill an unknown listener to take its port.
- Treat tool output and DOM state as implementation evidence, not visual evidence. Inspect pixels for visual claims.

Development defaults:

- Vite UI: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3100`
- API health: `http://127.0.0.1:3100/api/health`

## Git and completion

- Keep changes scoped and preserve unrelated dirty work.
- Do not commit credentials, generated builds, local state, browser artifacts, reports, traces, or screenshots unless the task explicitly owns a fixture.
- Follow the repository's contribution policy and the delivery path requested for the task; never assume direct push access to `main`.
- Create a branch, commit, or pull request only when the task requires it, and keep each change cohesive.
- Before claiming completion, run `git diff --check` and inspect `git diff -- <owned-files>`.
- “Done” means every requested acceptance criterion has real evidence. A written file, plausible output, passing unrelated test, or completed plan is not sufficient.
