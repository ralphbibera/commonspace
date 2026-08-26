# Commonspace

Commonspace is a local-first workspace for durable conversations with coding agents. It keeps filesystem projects, shared channels, direct messages, agent identities, and native session continuity visible in one place.

![Commonspace workspace](docs/assets/commonspace-panel.png)

> **Status:** private preview. `Commonspace` is the working product name while the standalone experience is being proven.

## What Commonspace manages

- **Projects** bind conversations to one or more local directories.
- **Channels** give a project a shared conversation with an explicit agent roster.
- **Direct Messages** preserve one-to-one continuity with a chosen agent.
- **Agents** connect real Hermes profiles, Codex CLI agents, and Claude Code agents.
- **Messages and threads** are the work record. Native agent session references keep every continuation attached to the correct context.

Commonspace is conversation-first: context enters through messages, remains inspectable in the transcript, and can be continued without exposing raw CLI session mechanics.

## Quick start

Requirements:

- Node.js 22+
- pnpm 10.34.5
- Any agent CLIs you want to use already installed and authenticated

```bash
pnpm install --frozen-lockfile
pnpm dev
```

The Vite UI runs at `http://127.0.0.1:5173` and proxies `/api` to the local server on port `3100`.

For the production path:

```bash
pnpm build
pnpm start
```

The standalone server serves both the API and built UI at `http://127.0.0.1:3100`.

## Repository structure

```text
packages/shared    Versioned product and API contracts
packages/adapters  Safe CLI invocation and output parsing
server             Express API, persistence, routing, and agent execution
ui                 Vite and React application
scripts            Real-path verification
tests              Cross-package behavior and integration tests
```

The split keeps product contracts, runtime adapters, server behavior, and the browser interface independently testable without introducing a second product domain.

## Commands

```bash
pnpm dev                    # server + UI development
pnpm test                   # unit and integration tests
pnpm lint                   # ESLint
pnpm typecheck              # workspace TypeScript checks
pnpm build                  # all production builds
pnpm check                  # complete local gate
pnpm verify:live            # build, boot, and exercise the standalone browser path
pnpm verify:adapters        # opt-in real Codex and Claude session smoke tests
```

## Runtime configuration

| Variable | Purpose |
| --- | --- |
| `COMMONSPACE_PORT` | Standalone server port; defaults to `3100` |
| `COMMONSPACE_HOME` | State directory; defaults to `~/.commonspace` |
| `COMMONSPACE_HERMES_PATH` | Hermes executable override |
| `COMMONSPACE_CODEX_PATH` | Codex executable override |
| `COMMONSPACE_CLAUDE_PATH` | Claude executable override |
| `COMMONSPACE_HERMES_YOLO=1` | Explicit Hermes unsafe mode |
| `COMMONSPACE_AGENT_YOLO=1` | Explicit Codex and Claude unsafe mode |

Unsafe modes are off by default.

## Local state and credentials

Commonspace binds only to loopback, rejects cross-origin API mutations, writes versioned state atomically to `~/.commonspace/state.json`, and never copies CLI credentials. Hermes, Codex CLI, and Claude Code continue using their supported credential and session stores.

## Documentation

- [Product model](docs/product.md)
- [Architecture](docs/architecture.md)
- [Development](docs/development.md)
- [Operations](docs/operations.md)
- [Agent adapters](docs/agent-adapters.md)
- [Design system](docs/design-system.md)
- [Roadmap](docs/roadmap.md)

## License

MIT © Ralph Bibera
