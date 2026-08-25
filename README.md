# Commonspace

Commonspace is a small, local-first collaboration workspace where Ralph and reusable Hermes agent profiles work together through projects, channels, and direct messages. It is inspired by Block's open-source Buzz project, but intentionally omits voice, Nostr federation, GitHub workflows, and unrelated team features.

![Commonspace agent workspace](docs/assets/commonspace-panel.png)

> **Status:** private preview. The repository is structured for a future public release, but the package remains `private` until the first release is ready.

## Product model

Commonspace has four first-class objects:

- **Projects** — local context containers that can group multiple filesystem workspaces or repositories.
- **Channels** — shared rooms with an explicit roster of Hermes agent profiles.
- **Direct Messages** — persistent one-to-one conversations with a Hermes profile's canonical `Bot Chat`.
- **Agents** — real Hermes profiles, preserving each profile's role, model, memory, skills, and sessions.

There is no required captain. In channels, `@profile` routes a turn to that seated agent. A message without a valid mention is sent to the channel's selected members.

## User experience

The existing DeepSeek Harness sidebar has two modes:

1. **Workspaces** — the unmodified native DSH workspace/session browser and conversation.
2. **Commonspace** — replaces that same sidebar body and center conversation with Projects, Channels, DMs, and Agents.

Use the footer switch to move between them. Commonspace does not stack underneath Workspaces and does not render as a popup.

## Current capabilities

- Discovers the real local Hermes profile roster.
- Creates Projects from absolute local directory paths.
- Adds multiple local workspaces to one Project.
- Creates Channels scoped to a Project.
- Selects and edits the Hermes agent roster for each Channel.
- Routes valid `@profile` mentions only to agents seated in that Channel.
- Opens persistent profile DMs through Hermes `Bot Chat`.
- Stores Commonspace metadata and room messages in `~/.commonspace/state.json` using atomic writes.
- Restores Commonspace metadata and conversations after browser reload.
- Restores native DSH Workspaces/conversation immediately when switching back.

## Install from a checkout

Requirements:

- Node.js 22 or newer
- pnpm 10 or newer
- DeepSeek Harness `0.1.1-rc.2` or newer
- Hermes Agent available as `hermes` on `PATH`
- At least one configured Hermes profile

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

### Optional Hermes yolo mode

Commonspace does **not** enable Hermes `--yolo` by default. To opt in explicitly for a local trusted environment:

```bash
COMMONSPACE_HERMES_YOLO=1 dsh web
```

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
```

With DSH Web running locally:

```bash
COMMONSPACE_TEST_URL=http://127.0.0.1:3080 \
COMMONSPACE_TEST_PROJECT="$PWD" \
pnpm verify:live
```

The live check verifies mode replacement, the real Hermes profile roster, a two-workspace Project, channel membership, a real Hermes profile DM, reload persistence, and restoration of native Workspaces.

## Architecture

Commonspace is a dual-face Cordis package:

- `src/index.ts` mounts the local host service and same-origin API routes.
- `src/host/state.ts` owns deterministic state transitions.
- `src/host/hermes.ts` owns profile discovery, safe no-shell CLI arguments, room prompts, and membership-aware routing.
- `src/host/service.ts` owns validation, atomic persistence, API routes, and bounded Hermes execution.
- `src/client/commonspace-mode.ts` owns the Workspaces/Commonspace mode.
- `src/client/commonspace-store.ts` is the observable browser store.
- `src/client/CommonspaceSidebar.tsx` renders Projects, Channels, DMs, and Agents.
- `src/client/CommonspaceConversation.tsx` renders room messages and the composer.
- `src/client/index.ts` dynamically shadows `sidebar.workspaces` and `conversation` only while Commonspace mode is active.

See [`docs/architecture.md`](docs/architecture.md) for the detailed boundary.

## Current boundary

Commonspace is currently single-user and local-first. Metadata is not synchronized across machines or browsers. Channels invoke Hermes profiles serially and return completed responses rather than token streams. Buzz/Nostr federation, voice, GitHub workflows, and non-Hermes runtimes are intentionally out of scope.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Report vulnerabilities privately through GitHub Security Advisories; see [`SECURITY.md`](SECURITY.md).

## License

MIT © Ralph Bibera
