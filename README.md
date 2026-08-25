# Commonspace

Commonspace is a small, local-first collaboration workspace where Ralph and reusable Hermes, Codex CLI, and Claude Code agents work together through projects, channels, and direct messages. It is inspired by Block's open-source Buzz project, but intentionally omits voice, Nostr federation, GitHub workflows, and unrelated team features.

![Commonspace agent workspace](docs/assets/commonspace-panel.png)

> **Status:** private preview. The repository is structured for a future public release, but the package remains `private` until the first release is ready.

## Product model

Commonspace has four first-class objects:

- **Projects** — local context containers that can group multiple filesystem workspaces or repositories.
- **Channels** — shared rooms with an explicit roster of local agents.
- **Direct Messages** — persistent one-to-one conversations backed by each adapter's native session.
- **Agents** — discovered Hermes profiles plus user-managed Codex CLI and Claude Code agents.

There is no required captain. In channels, `@agent-id` routes a turn to that seated agent. A message without a valid mention is sent to the Channel's selected members.

## User experience

The existing DeepSeek Harness sidebar has two modes:

1. **Workspaces** — the unmodified native DSH workspace/session browser and conversation.
2. **Commonspace** — replaces that same sidebar body and center conversation with Projects, Channels, DMs, and Agents.

Use the footer switch to move between them. Commonspace does not stack underneath Workspaces and does not render as a popup.

## Current capabilities

- Discovers the real local Hermes profile roster.
- Adds named Codex CLI and Claude Code agents with optional per-agent models.
- Creates Projects from absolute local directory paths.
- Adds multiple local workspaces to one Project.
- Creates Channels scoped to a Project.
- Selects and edits the agent roster for each Channel.
- Routes valid `@agent-id` mentions only to agents seated in that Channel.
- Opens persistent DMs from a searchable agent picker and resumes the exact native agent session; every Channel root starts a new session and replies stay in that thread's session.
- Autocompletes Commonspace slash commands in the composer without forwarding command text to an agent.
- Stores Commonspace metadata and room messages in `~/.commonspace/state.json` using atomic writes.
- Restores Commonspace metadata and conversations after browser reload.
- Restores native DSH Workspaces/conversation immediately when switching back.

## Chat commands

Type `/` in the main composer to browse commands. Command matching is case-insensitive, and commands are handled by Commonspace rather than sent as agent prompts.

| Command | What it does |
| --- | --- |
| `/help` (`/commands`) | Shows the commands available in the active Channel or DM. |
| `/new` (`/clear`, `/reset`) | In a DM, confirms before clearing the transcript and starting fresh native agent context. Add `now`, `--yes`, or `-y` to skip confirmation. |
| `/retry` (`/again`) | Resends the latest user message in the current conversation or thread. |
| `/status` | Shows the active Channel or agent, model, adapter, and Project context. |
| `/agents` (`/tasks`) | Lists the currently available agents. |

## Install from a checkout

Requirements:

- Node.js 22 or newer
- pnpm 10 or newer
- DeepSeek Harness `0.1.1-rc.2` or newer
- At least one supported agent CLI on `PATH`: Hermes Agent (`hermes`), Codex CLI (`codex`), or Claude Code (`claude`)
- Authentication already configured in the selected CLI's supported credential store

```bash
git clone git@github.com:ralphbibera/commonspace.git
cd commonspace
pnpm install
pnpm build
dsh plugin --profile web add .
```

Restart the DSH Web profile:

```bash
dsh web
```

The package declares a DSH bundle, so installation activates `commonspace.patch.yml` automatically.

### Optional unsafe agent mode

Commonspace defaults to Codex workspace-write sandboxing, Claude Code `acceptEdits`, and normal Hermes permissions. To bypass Codex and Claude Code permission checks explicitly in a trusted, externally contained environment:

```bash
COMMONSPACE_AGENT_YOLO=1 dsh web
```

The legacy `COMMONSPACE_HERMES_YOLO=1` flag affects Hermes only and never escalates Codex or Claude Code.

## Remove

```bash
dsh plugin --profile web remove @ralphbibera/commonspace
```

Restart `dsh web` after installing or removing the bundle.

## Development

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm verify:adapters          # real Codex + Claude start/resume smoke test
pnpm verify:adapters:codex    # Codex only
pnpm verify:adapters:claude   # Claude Code only
```

With DSH Web running locally:

```bash
COMMONSPACE_TEST_URL=http://127.0.0.1:3080 \
COMMONSPACE_TEST_PROJECT="$PWD" \
pnpm verify:live
```

The live check verifies mode replacement, the real Hermes profile roster, a two-workspace Project, Channel membership/settings/memory, threaded execution, the DM picker, slash commands, a real Hermes DM, reload persistence, and restoration of native Workspaces.

## Architecture

Commonspace is a dual-face Cordis package:

- `src/index.ts` mounts the local host service and same-origin API routes.
- `src/host/state.ts` owns deterministic state transitions.
- `src/host/hermes.ts` owns Hermes discovery/invocation, room prompts, and membership-aware routing.
- `src/host/adapters.ts` owns safe no-shell Codex CLI and Claude Code invocation arguments and output parsing.
- `src/host/service.ts` owns validation, atomic persistence, API routes, native session mapping, and bounded adapter execution.
- `src/client/commonspace-mode.ts` owns the Workspaces/Commonspace mode.
- `src/client/commonspace-store.ts` is the observable browser store.
- `src/client/slash-commands.ts` is the context-aware command registry and resolver.
- `src/client/CommonspaceSidebar.tsx` renders Projects, Channels, DMs, and Agents.
- `src/client/CommonspaceConversation.tsx` renders room messages and the composer.
- `src/client/index.ts` dynamically shadows `sidebar.workspaces` and `conversation` only while Commonspace mode is active.

See [`docs/architecture.md`](docs/architecture.md) for the detailed boundary.

## Documentation

- [Product model](docs/product.md)
- [Architecture](docs/architecture.md)
- [Agent adapter contract](docs/agent-adapters.md)
- [Design system](docs/design-system.md)
- [Development guide](docs/development.md)
- [Operations and troubleshooting](docs/operations.md)
- [Roadmap](docs/roadmap.md)

## Current boundary

Commonspace is currently single-user and local-first. Metadata is not synchronized across machines or browsers. Channels invoke configured agents serially and return completed responses rather than token streams. Buzz/Nostr federation, voice, GitHub workflows, and hosted remote agent runtimes are intentionally out of scope.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Report vulnerabilities privately through GitHub Security Advisories; see [`SECURITY.md`](SECURITY.md).

## License

MIT © Ralph Bibera
