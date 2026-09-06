# Contributor guide

Use this guide to find the code responsible for a change and choose the right development tools. Start with [Contributing](../CONTRIBUTING.md) for checkout setup and the pull request requirements.

## Find the right place to work

| Location | What belongs here |
| --- | --- |
| `packages/shared/src` | Types and pure helpers used by both the server and UI. |
| `server/src/state.ts` | Changes to workspace state and rules for loading older data. |
| `server/src/service.ts` | Persistence, message routing, shared context, agent sessions, and execution. |
| `server/src/app.ts` | HTTP routes, request validation, and the API. |
| `ui/src` | Browser state, screens, components, and interaction. |
| `ui/src/stories` | Isolated examples of component and screen states. |
| `tests` | Unit, integration, and browser-flow tests. |
| `cli` | Published npm command and package build. |
| `scripts` | Development tools, source installation, packaging, and runtime verification. |
| `docs` | Product rules, development instructions, and operating guides. |

Use the existing owner of a behavior instead of adding a new abstraction. Shared types have one source in `packages/shared`; the UI communicates with the server through those types and `/api`.

Read the [product direction](product-direction.md), [product specification](product-spec.md), and [architecture](architecture.md) for the area you are changing. The [product model](product.md) explains Projects, Channels, Direct Messages, Agents, Messages, and threads. A change that introduces another product domain needs an explicit product decision first.

## Choose a test

| What you need to prove | Where to check it |
| --- | --- |
| A function, state change, or API behaves correctly. | Unit or integration tests in `tests/`. |
| A component renders and responds to input correctly. | A Storybook story and its interaction test. |
| The complete browser flow works with the built server and UI. | `pnpm verify:live`. |
| The npm package installs and runs independently of the checkout. | `pnpm build:npm`, then `pnpm verify:npm-package`. |
| A real agent starts or resumes its existing session. | Opt-in agent checks with your own installation and credentials. |

Use the smallest test that proves the behavior. A component test should not need a real agent connection. Tests should check behavior owned by Commonspace, rather than repeat implementation details.

Run one test file while working:

```bash
pnpm test -- tests/channel-context.spec.ts
```

Replace that path with the relevant test. Use `pnpm check:fast` during development and `pnpm check` before review. See [Contributing](../CONTRIBUTING.md#check-your-work) for the complete requirements for each kind of change.

## Work on the desktop UI

Storybook lets you inspect a component or screen without starting the whole application. Start it in one terminal:

```bash
pnpm storybook
```

In another terminal, watch the stories relevant to your change:

```bash
pnpm test:storybook:watch -- Conversation
```

Replace `Conversation` with the story-file filter you need. Include useful desktop states such as empty, populated, loading, error, and light or dark appearance.

For a quick check across representative screens, run:

```bash
pnpm test:storybook:smoke
```

Use `pnpm check:ui` for a complete UI-only check while developing. Before review, manually inspect the changed desktop flow and follow the full checks in Contributing. Run `pnpm verify:live` when the behavior depends on the UI and server working together.

## Change server behavior safely

Keep these rules intact:

- A continuing conversation resumes its exact agent session. `/new` starts a hard context boundary; do not carry the old session into it.
- Different agents and different sessions can work concurrently. Serialize only calls to the same agent session.
- Host paths, credentials, agent session identifiers, and temporary access tokens stay out of browser-visible state.
- Start subprocesses with argument arrays and piped input, never shell command strings.
- Keep the server on loopback and preserve checks that reject requests from another origin.
- Version and validate saved-data changes, write them atomically, and test migration and recovery.

For a saved-data change, update the shared types, every affected consumer, loading and migration logic, tests, and the relevant documentation together. Read [Development](development.md) for the detailed workflow and [Operations](operations.md) for storage and recovery.

## Check the npm package

Build the package used by npm releases:

```bash
pnpm build:npm
pnpm verify:npm-package
```

The first command builds one platform-neutral npm tarball. The second installs it into a clean temporary prefix and checks that it starts and serves the UI without the source checkout. Neither command needs agent credentials.

Real agent and real macOS background-service checks are separate. Record whether you ran them; npm-package smoke does not prove those integrations were exercised. See [Releasing](releasing.md) for the full process.

When the change is ready, follow [Contributing](../CONTRIBUTING.md#prepare-a-pull-request) to explain the result and the evidence for it.
