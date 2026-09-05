# Commonspace contributor contract

Commonspace is a standalone, local-first agent conversation workspace.

## Read before changing code

Read the smallest set of project documents that explains the change before editing:

1. [Product direction](docs/product-direction.md)
2. [Product specification](docs/product-spec.md)
3. [Architecture](docs/architecture.md)
4. [Development guide](docs/development.md)
5. [Contributing guide](CONTRIBUTING.md)

Use the [product model](docs/product.md) when the change affects Projects, Channels, Direct Messages, Agents, Messages, threads, or shared context. Use the [operations guide](docs/operations.md) when the change affects installation, state, service lifecycle, or recovery.

## Product scope

The product owns Projects, Channels, Direct Messages, Agents, Messages, threads, native agent-session continuity, and visible context handoffs. Conversation is the primary work record. Do not add a parallel ticket, issue, goal, company, org-chart, approval, or work-queue domain unless Ralph explicitly changes the product direction.

Feature decisions must follow Commonspace's documented product direction.

## Architecture boundaries

- `packages/shared` is the single writer for cross-process contracts and pure shared helpers.
- `server` owns the Express API, local persistence, validation, routing, concurrency, and subprocess lifecycle.
- `ui` owns the Vite/React application and may communicate with the server only through shared contracts and `/api`.
- Hermes and Codex own their credentials and native session stores.
- Commonspace must not depend on an undeclared agent runtime or another application's backend.

## Repository map

- `packages/shared/src` contains versioned cross-process contracts and pure helpers.
- `server/src/state.ts` contains deterministic state transitions and migration-facing rules.
- `server/src/service.ts` coordinates persistence, routing, context, sessions, and execution.
- `server/src/app.ts` contains HTTP concerns and API boundaries.
- `server/src/acp-runtime.ts` contains provider-neutral ACP process lifecycle.
- `server/src/commonspace-mcp.ts` contains scoped Commonspace MCP transport and tools.
- `server/src/dev.ts` and `server/src/dev-supervisor.ts` contain the development restart boundary.
- `ui/src/commonspace-store.ts` contains browser state and API coordination.
- `ui/src/stories` contains isolated component and screen states for Storybook.
- `tests` contains cross-package, server, and client behavior tests.
- `scripts` contains real-path verification and service lifecycle checks.
- `docs` contains product, architecture, development, and operations contracts.

Prefer the smallest existing owner. Do not create a new abstraction when the owning boundary already exists.

## Engineering rules

- Preserve hard `/new` context boundaries and exact native-session resumption.
- Treat Channels as non-blocking agent-to-agent rooms: persist messages immediately, wake addressed agents, and route bounded peer mentions without adding task-state gates.
- Different agents may act concurrently, including in the same Project. Serialize only calls that target the same native agent session.
- Treat session references and filesystem paths as host-private data.
- Invoke CLIs with argument arrays and piped input; never construct shell command strings.
- Bind the server to loopback and keep same-origin mutation guards.
- Make persisted-state changes versioned, sanitized, atomic, and migration-tested.
- Add a failing focused test before behavior changes, then run `pnpm check` and `pnpm verify:live` before completion.
- Keep changes scoped. Do not commit credentials, generated builds, local state, or browser artifacts.

## Change contract

Before implementation, state the following in the working notes or pull request:

- the user-visible problem;
- the product rule or invariant involved;
- the owning package or feature boundary;
- the focused test that proves the change, or the explicit reason no new test is needed;
- the verification commands and any manual checks.

If a request changes a shared contract, update the shared type, every affected consumer, migration or sanitization logic, and the relevant documentation in the same change.

## Test ownership

- Unit and integration tests verify server behavior, state transitions, persistence, contracts, and security boundaries.
- Storybook verifies isolated UI rendering, interactions, and accessibility.
- Playwright-backed flows verify the integrated browser path and production wiring.
- `pnpm check:fast` is the focused contributor gate.
- `pnpm check` is the complete local gate.
- `pnpm verify:live` is required for server or visible end-to-end changes.
- Real ACP checks are opt-in and require local harness credentials.

Do not replace a deterministic unit or Storybook check with a slower live-agent test.

## Documentation

- Write about Commonspace directly. Do not use other projects as comparisons, inspiration, or authorities for product decisions.
- Keep names of actual dependencies and supported integrations when readers need them to follow instructions.
- Use complete sentences, familiar words, and descriptive headings. Explain necessary terms before using them.
- Write product documentation for public readers. Do not add repository-visibility banners, launch-preparation notes, or work-session status to product copy. Keep administrative procedures in maintainer guides.
- Organize guides around the reader's task. State prerequisites, give steps in order, and describe the expected result.
- Keep implementation details in technical references and label historical verification with its date or revision. Check related documents, links, and commands after an edit.

## AI-assisted changes

AI contributors follow the same product, security, testing, and review rules as human contributors. They must inspect the relevant documents first, keep changes scoped, disclose the model used in the pull request, and leave enough evidence for a human maintainer to verify the result. Generated code is not trusted merely because it compiles.

Do not place credentials, native session identifiers, private filesystem paths, internal task links, or local machine details in source, fixtures, screenshots, commits, or public issue and pull request text.
