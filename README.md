# Commonspace

Commonspace is a local-first workspace for durable conversations with coding agents. It keeps filesystem projects, shared channels, direct messages, agent identities, and native session continuity visible in one place.

![Commonspace workspace](docs/assets/commonspace-panel.png)

> **Status:** private preview. `Commonspace` is the working product name while the standalone experience is being proven.

## What Commonspace manages

- **Projects** bind conversations to one or more local directories. Messages and threads may reference zero, one, or many Projects.
- **Channels** provide shared, optionally projectless conversations with explicit agent rosters and editable compacted context.
- **Direct Messages** preserve one-to-one continuity with a chosen agent.
- **Inbox** collects actual agent replies from Channels and Direct Messages, with unread filtering and exact thread navigation.
- **Startup** opens directly to the attention-focused Inbox. There is no separate Workspace landing page or Agent-runs dashboard; runtime outcomes remain attached to their replies and Inbox items.
- **Agents** are explicitly chosen from discovered supported harness installations. Workspace names and appearance stay local and never rename or reconfigure the harness.
- **Messages and threads** are the work record. Native agent session references keep every continuation attached to the correct context.

Commonspace is conversation-first. Hermes and Codex receive only the newly delivered message over ACP, resume their exact provider-native session, and can read bounded shared-room context or post progress through a session-scoped Commonspace MCP server. Each reply can expose a durable, expandable audit of the reasoning summaries, plans, tool calls, results, and usage emitted by its native harness. Raw session mechanics remain host-private.

Optional native notifications mirror new durable Inbox events for replies, mentions, permissions, failures, and timeouts. Their category/sound settings are independent from Inbox state, and clicks open the exact loopback conversation item.

Unaddressed Channel messages always use configured inference—either an agent harness or a BYO OpenAI-compatible model—to select the smallest useful harness set and persist one bounded sub-request for each selection. When a new root has no `@@project` tag, the same decision infers visible Project scope; each harness receives only its assigned sub-request and Project subset. Routing records remain durable for dispatch and diagnostics, but resolved destinations and assignment details are not rendered in the conversation. Explicit `@agent` and `@@project` tags remain authoritative; there is no deterministic/no-inference routing mode or separate Project picker.

## Quick start

Requirements:

- Node.js 22+
- pnpm 10.34.5

The contributor path does not require agent credentials. It starts the local API and UI with an empty workspace so you can work on the product, tests, and Storybook in isolation.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173` for the UI. The API runs at `http://127.0.0.1:3100`.

To exercise real agent sessions, install and authenticate Hermes and/or Codex separately, then add the discovered harness from the Commonspace UI. Agent credentials remain optional for source development.

On macOS, install the private preview as an owner LaunchAgent directly from `main`:

```bash
curl -fsSL https://raw.githubusercontent.com/ralphbibera/commonspace/main/scripts/commonspace-service.mjs | node --input-type=module - install
```

The installer clones through SSH, builds in an owner-only managed release, starts the service at `http://127.0.0.1:3100`, and installs `~/.local/bin/commonspace`. Lifecycle commands need no repository checkout:

```bash
~/.local/bin/commonspace status
~/.local/bin/commonspace stop
~/.local/bin/commonspace start
~/.local/bin/commonspace update
~/.local/bin/commonspace rollback
```

For the production path:

```bash
# Terminal 1: API
pnpm build
pnpm start

# Terminal 2: UI preview
pnpm --filter @commonspace/ui preview
```

The API server runs at `http://127.0.0.1:3100`; Vite preview serves the built UI separately. The installed LaunchAgent instead serves the built UI and API from one loopback origin.

## Repository structure

```text
packages/shared    Versioned product and API contracts
server             Express API, persistence, local relay, ACP/MCP, and execution
ui                 Vite and React application
scripts            Real-path verification
tests              Cross-package behavior and integration tests
```

The split keeps product contracts, server behavior, and the browser interface independently testable without introducing a second product domain.

## Commands

```bash
pnpm dev                    # server + UI development
pnpm storybook              # persistent UI workbench
pnpm test                   # unit and integration tests
pnpm test:storybook:smoke   # six representative browser stories
pnpm test:storybook:watch   # focused browser-test watch mode
pnpm check:fast             # lint, types, tests, and Storybook smoke
pnpm lint                   # ESLint
pnpm typecheck              # workspace TypeScript checks
pnpm build                  # all production builds
pnpm check:ui               # full UI type, Storybook, and build gate
pnpm check                  # complete local gate
pnpm verify:live            # build, boot API + UI preview, and exercise the browser path
pnpm verify:service         # isolated real clone/build/update/rollback lifecycle on macOS
pnpm service:install        # install current committed main checkout as a macOS LaunchAgent
pnpm service:status         # inspect installed service and health
pnpm verify:acp             # opt-in real Hermes and Codex ACP start/resume tests
pnpm verify:acp:hermes      # real Hermes profile start/resume test
pnpm verify:acp:codex       # real Codex start/resume test
pnpm verify:acp:mcp         # real Hermes and Codex scoped-context/progress tests
```

## Runtime configuration

| Variable | Purpose |
| --- | --- |
| `COMMONSPACE_PORT` | Standalone server port; defaults to `3100` |
| `COMMONSPACE_HOME` | State directory; defaults to `~/.commonspace` |
| `COMMONSPACE_HERMES_PATH` | Hermes discovery executable and default Hermes ACP executable |
| `COMMONSPACE_CODEX_PATH` | Codex executable override |
| `COMMONSPACE_HERMES_ACP_PATH` | Hermes ACP executable override; defaults to `COMMONSPACE_HERMES_PATH` or `hermes` |
| `COMMONSPACE_CODEX_ACP_PATH` | Codex ACP bridge executable override; bundled bridge is the default |
| `COMMONSPACE_HERMES_YOLO=1` | Explicit Hermes unsafe mode |
| `COMMONSPACE_AGENT_YOLO=1` | Explicit Codex unsafe mode |

Unsafe modes are off by default.

Routing provider settings live in the Defaults panel. Endpoint changes clear the previously stored key so credentials cannot silently cross origins. `OPENAI_API_KEY` is considered only for the canonical OpenAI origin; other providers use the explicitly supplied key or an unauthenticated local endpoint.

## Local state and credentials

Commonspace binds only to loopback, rejects cross-origin API mutations, writes versioned state atomically to `~/.commonspace/state.json`, and never copies provider credentials. ACP uses local stdio; its scoped MCP endpoint uses ephemeral bearer capabilities on loopback. Persisted activity is bounded and strips host paths, native session identifiers, and MCP capabilities. There is no Nostr or remote relay in this local-first phase. Hermes and Codex continue using their supported credential and native session stores.

The Project Files browser refuses to preview known credential-bearing files such as `.env*`, common auth/credential/secret files, private keys, and key containers.

## Documentation

- [Contributor guide](docs/contributor-guide.md)
- [Development support matrix](docs/support-matrix.md)
- [Product specification](docs/product-spec.md)
- [Product model](docs/product.md)
- [Architecture](docs/architecture.md)
- [Development](docs/development.md)
- [Operations](docs/operations.md)
- [Workspace archive format](docs/workspace-archive-format.md)
- [Design system](docs/design-system.md)
- [Roadmap](docs/roadmap.md)
- [Implementation gap audit](docs/implementation-gap-audit.md)
- [v0.1 acceptance ledger](docs/v0.1-acceptance.md)

## License

MIT © Ralph Bibera
