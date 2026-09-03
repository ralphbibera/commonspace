# Contributor guide

This guide is the shortest path from a fresh checkout to a safe, reviewable Commonspace change.

## 1. Get the repository running

Requirements:

- Node.js 22 or newer;
- pnpm 10.34.5;
- macOS or Linux for the validated source-development path.

Install dependencies and start the local application:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

The UI is available at `http://127.0.0.1:5173`. The API is available at `http://127.0.0.1:3100`.

This path does not need agent credentials. It starts an empty local workspace. Install and authenticate a supported harness only when you need to verify a real ACP session.

## 2. Understand the repository

Commonspace has three product boundaries:

| Boundary | Responsibility |
| --- | --- |
| `packages/shared` | Versioned contracts and pure shared helpers |
| `server` | Local state, API, routing, context, persistence, and harness lifecycle |
| `ui` | Browser state, presentation, interaction, and Storybook stories |

The product is conversation-first. Projects provide context. Channels and Direct Messages provide durable conversation. Threads preserve focused continuity. Agents remain real harnesses with their own credentials and native sessions. Do not introduce a separate task, ticket, company, approval, or workflow domain without an explicit product decision.

Read these documents in order for most changes:

1. [Product direction](product-direction.md)
2. [Product specification](product-spec.md)
3. [Architecture](architecture.md)
4. [Development](development.md)
5. [Operations](operations.md), when runtime or persistence is involved

## 3. Choose the correct verification layer

| Question | Use |
| --- | --- |
| Does a pure function or state transition behave correctly? | Unit or integration test in `tests/` |
| Does an isolated component render and behave correctly? | Storybook story and Storybook interaction test |
| Does the browser path connect UI, API, and built assets correctly? | `pnpm verify:live` |
| Does a real provider session start and resume correctly? | Opt-in ACP verification with local credentials |

Storybook is the isolated UI workbench. Playwright-backed checks cover integrated browser behavior. Keep the layers separate so a component change does not require a real agent or a full production boot.

## 4. Make a focused change

Before editing:

1. Search open issues and pull requests for related work.
2. State the user problem and the product invariant involved.
3. Identify the owning package and the smallest affected surface.
4. Add or locate the focused test that will prove the behavior.

During editing:

1. Keep contracts in `packages/shared`.
2. Keep host-private paths, credentials, native session identifiers, and MCP capabilities out of browser-visible state.
3. Use argument arrays for subprocesses and preserve loopback and same-origin guards.
4. Preserve atomic persistence, migration coverage, and exact native-session boundaries.
5. Add or update a Storybook state for visible UI changes.

After editing:

```bash
pnpm check:fast
pnpm check
pnpm verify:live
git diff --check
```

Use `pnpm verify:live` when the change affects the server, API, routing, persistence, or integrated UI. Real ACP verification is additional and opt-in.

## 5. Work effectively on the UI

Start Storybook in one terminal:

```bash
pnpm storybook
```

Run one story while editing:

```bash
pnpm test:storybook:watch -- Conversation
```

Use the six-story smoke suite for a quick cross-screen check:

```bash
pnpm test:storybook:smoke
```

Stories should make important states easy to inspect: empty, populated, loading, error, narrow layout, and light/dark appearance where relevant. Do not use a story to hide an integration failure that belongs in a browser flow.

## 6. Work effectively with AI

AI assistance is allowed, but it does not change the contribution bar. An AI-assisted change must still have a clear owner, product fit, focused coverage, full verification, and a human-readable explanation. Record the provider and exact model in the pull request. If no AI helped, write `None, human-authored`.

Do not send private workspace contents, credentials, native session data, or internal links to an external model. Do not commit generated code that has not been inspected.

## 7. Keep public work reviewable

- Use a descriptive kebab-case branch name.
- Keep one logical change per pull request.
- Link public issue numbers when they exist.
- Describe the problem in the pull request when no issue exists.
- Include manual UI verification and screenshots for visible changes.
- Explain risks, migrations, and follow-up work.
- Give credit when finishing another contributor’s stalled work.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the complete pull request contract.
