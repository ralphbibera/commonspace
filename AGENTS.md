# Working on Commonspace

Commonspace is a local-first workspace for conversations with coding agents. This guide summarizes the repository structure and engineering conventions. See [Contributing](CONTRIBUTING.md) for setup, pull requests, and review requirements.

## Find the relevant context

- [Product direction](docs/product-direction.md) defines the purpose and scope of Commonspace.
- [Product model](docs/product.md) explains Projects, Channels, Direct Messages, Agents, Threads, and shared context.
- [Product specification](docs/product-spec.md) records behavior requirements and acceptance criteria.
- [Architecture](docs/architecture.md) describes package ownership and runtime boundaries.
- [Development](docs/development.md) covers local commands and testing. [Operations](docs/operations.md) covers configuration, persistence, and service lifecycle.

Read the documents relevant to the change before editing. Keep feature decisions consistent with the product model and discuss changes to its scope with a maintainer.

## Repository layout

| Location | Responsibility |
| --- | --- |
| `packages/shared/src` | Cross-process contracts and pure shared helpers |
| `server/src/state.ts` | Deterministic state transitions and migration rules |
| `server/src/service.ts` | Persistence, routing, context, and native-session coordination |
| `server/src/app.ts` | Express API, request validation, and HTTP security boundaries |
| `server/src/acp-runtime.ts` | Agent Client Protocol process and session lifecycle |
| `server/src/commonspace-mcp.ts` | Scoped Model Context Protocol transport and tools |
| `ui/src` | React application, browser state, and API coordination |
| `ui/src/stories` | Isolated component and screen states |
| `tests` | Unit, integration, and browser behavior tests |
| `scripts` | Verification, packaging, and service lifecycle tools |
| `docs` | Product, development, architecture, and operations guides |

Keep behavior in its existing owning package. Shared types belong in `packages/shared`; the UI communicates with the server through shared contracts and `/api`.

## Engineering constraints

- Conversations are the primary work record. Preserve the context and session relationships defined by the product model.
- Resume the exact native agent session when continuing work. Preserve `/new` as a fresh-context boundary.
- Persist accepted messages before routing or execution. Agent failures must not remove the original message.
- Allow independent agent sessions to run concurrently, including within one Project. Serialize requests to the same native session.
- Agent runtimes own their credentials and native session stores. Keep session references and host filesystem paths private.
- Bind the server to loopback and preserve same-origin mutation guards.
- Invoke subprocesses with argument arrays and piped input, without constructing shell command strings.
- Version persisted-state changes, write atomically, and cover migrations and sanitization with tests.

When a shared contract changes, update its consumers, validation, migrations, tests, and documentation together. Use synthetic data in examples and tests; keep credentials, local workspace state, session data, and generated artifacts out of commits.

## Verify a change

Add a focused failing test for behavior changes, then run the checks appropriate to the affected area:

| Command | Purpose |
| --- | --- |
| `pnpm check:fast` | Contributor checks during development |
| `pnpm check` | Complete local checks, tests, and builds |
| `pnpm verify:live` | Integrated browser and server verification for server or end-to-end changes |
| `git diff --check` | Whitespace and patch checks |

Use Storybook for isolated UI states and interactions, and browser flows for behavior that depends on the assembled application. Real agent checks are opt-in and require local runtime credentials.

For documentation-only changes, check links, command examples, and file syntax; new behavior tests are not required. Record the checks performed and any limitations in the pull request. The [contribution verification table](CONTRIBUTING.md#check-your-work) gives the requirements for each change type.
