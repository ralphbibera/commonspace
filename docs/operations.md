# Operations

## Runtime

```bash
pnpm build
pnpm start
# In another terminal:
pnpm --filter @commonspace/ui preview
```

The API server binds to `127.0.0.1:3100` by default and serves `/api` plus the root health check. In the source/runtime default it does not serve UI assets; run `pnpm --filter @commonspace/ui preview` separately for the built UI. Override the API port with `COMMONSPACE_PORT`. Hermes uses its installed profile-native ACP server; Codex uses its bundled ACP bridge.

That two-process shape is the source/development path. The installed macOS service sets `COMMONSPACE_UI_ROOT` and serves the built browser client and API from `http://127.0.0.1:3100` without changing package ownership or API boundaries.

## Installed macOS service

Prerequisites are macOS, Node.js 22+, Corepack, Git with SSH access to GitHub, and at least one authenticated supported harness. Install from `main` with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/ralphbibera/commonspace/main/scripts/commonspace-service.mjs | node --input-type=module - install
```

The installer builds a staging clone before touching the running service, validates the LaunchAgent property list, atomically swaps the release, starts it, and requires `/api/health` to pass. State remains in `~/.commonspace` across updates. One previous release remains available for recovery.

```bash
~/.local/bin/commonspace status
~/.local/bin/commonspace stop
~/.local/bin/commonspace start
~/.local/bin/commonspace restart
~/.local/bin/commonspace update
~/.local/bin/commonspace rollback
```

Managed lifecycle paths:

- Current release: `~/Library/Application Support/Commonspace/current`
- Rollback release: `~/Library/Application Support/Commonspace/previous`
- LaunchAgent: `~/Library/LaunchAgents/dev.commonspace.service.plist`
- CLI: `~/.local/bin/commonspace`
- Logs: `~/Library/Logs/Commonspace/service.log` and `service.error.log`

`update` clones `git@github.com:ralphbibera/commonspace.git` through SSH and builds the new `main` release while the old process continues running. A failed build never swaps releases. A failed health check restores and restarts the previous release. `rollback` explicitly swaps the current and previous releases, so recovery does not require repository knowledge.

## Local data

- State: `~/.commonspace/state.json`
- Previous valid state: `~/.commonspace/state.backup.json`
- Last invalid primary preserved after automatic recovery: `~/.commonspace/state.corrupt.json`
- Routing provider configuration: `~/.commonspace/routing.json`
- Managed projectless workspace: `~/.commonspace/workspace`
- Private image and general-file bytes: `~/.commonspace/attachments`
- Credentials and native transcripts: each agent CLI's supported stores

ACP runs over child-process stdio. The Commonspace MCP endpoint is authenticated, loopback-only, and uses in-memory bearer capabilities that are never persisted. There is no Nostr or remote relay service to configure.

Set `COMMONSPACE_HOME` to isolate state for development or verification.
Commonspace enforces `0700` on this directory at startup and replaces `state.json` atomically with `0600` permissions.

## Export, import, and retention

Open Commonspace settings and use **Workspace data** to export `commonspace-export.json`. Commonspace-managed fields exclude provider credentials, native-session references, capabilities, and known absolute host paths. Attachment bytes remain exact and may contain sensitive author-supplied content. The archive is unencrypted private data. The versioned contract is documented in [Workspace archive format](workspace-archive-format.md).

Import works only in a new empty workspace. Choose the archive, map every exported Project root to an existing local directory, then import. Commonspace validates the entire archive and attachment set before activating it; native harness sessions are not transferred.

Retention is manual and conversation-scoped. Select one Channel or Direct Message, preview its message/Thread/attachment/pin impact, then confirm. If workspace state changes after preview, preview again. Active work must finish or be stopped first. Commonspace never expires conversation data in the background.

## Health checks

```bash
curl http://127.0.0.1:3100/api/health
pnpm verify:live
pnpm verify:acp:hermes
pnpm verify:acp:codex
pnpm verify:acp:mcp
```

The health response is `{"status":"ok"}`. The live verifier builds the workspace, starts an isolated API server and Vite preview on OS-assigned loopback ports, opens the UI in Chromium, and verifies the application, navigation, conversation surface, and API. ACP verifiers are opt-in because they use locally authenticated provider runtimes; each starts a native session and resumes the exact returned opaque ID.

## Common failures

### UI development cannot reach the API

Run `pnpm dev` from the workspace root. Confirm the server is on port `3100` and open the Vite URL on port `5173`.

### No Hermes agents

Run `hermes --version` or `codex --version` in the same environment. Commonspace shows an installed supported harness in the Add Agent panel only after an explicit scan; discovery alone does not add it to the roster. Previously selected harness identities remain visible through transient availability failures so conversation history is preserved.

### Project path rejected

Project paths must be absolute, exist, resolve through `realpath`, and be directories.

### Agent authentication fails

Authenticate with Hermes or Codex. Unsafe mode does not solve authentication and should not be used for that purpose.

### Routing inference fails

Unaddressed Channel messages are not accepted unless inference selects a valid seated agent. Configure either a harness router or an OpenAI-compatible model in Defaults. A stored endpoint key is cleared when its origin changes and must be entered again. `OPENAI_API_KEY` is used only with the canonical OpenAI origin; local and third-party endpoints need their own explicit key when authentication is required.

### A Project file is marked sensitive

Commonspace lists known credential-bearing files but does not preview their contents. This includes `.env*`, common credential/auth/secret files, private keys, and certificate key containers. Inspect such files outside Commonspace with an appropriate secret-safe workflow.

### ACP bridge fails to start

Run `hermes acp --check` and `codex --version` in the same environment as Commonspace. Hermes ACP defaults to `COMMONSPACE_HERMES_PATH` or `hermes`; `COMMONSPACE_HERMES_ACP_PATH` overrides its ACP executable. The Codex bridge uses `COMMONSPACE_CODEX_PATH` when set.

### A native session cannot resume

Commonspace retries with a new native session only when the provider explicitly reports that the saved session is missing. Authentication, transport, and other transient failures remain visible and preserve the stored session ID. Use `/new` when you deliberately want a hard boundary.

### An agent misses Channel context

Confirm the run is using ACP and that the local `/api/mcp` request is not returning `401`. Channel agents receive a native `commonspace_get_context` tool whose description requires one call at the start of the turn; room context is intentionally not replayed inside the user message.

### A reply has no activity trace

Commonspace records only activity the native ACP runtime emits. Confirm the installed Hermes or Codex ACP implementation reports reasoning, plan, tool-call, and usage session updates. A reply can legitimately have no activity row when the runtime emits only final text.

## Shutdown

`SIGINT` and `SIGTERM` stop accepting sends, cancel/close ACP process groups, wait for background relay work and atomic state writes, revoke MCP capabilities, and then close HTTP connections.

During `pnpm dev`, watched backend changes use a separate graceful-restart path. The supervisor leaves the current server and its per-CLI ACP/MCP connections alive until all accepted turns finish, coalesces further edits, and then starts one replacement generation. A crash or explicit terminal shutdown still follows the forced-shutdown behavior above.

Closing the browser does not stop the installed LaunchAgent or its active turns. `commonspace stop`, logout, or machine shutdown sends the service a normal process termination signal; interrupted work is persisted with explicit interruption state on the next start.

## Backup and rollback

Before changing state versions:

```bash
cp ~/.commonspace/state.json ~/.commonspace/state.backup.json
```

State version 23 migrates versions 1–22 on startup. Each write automatically keeps the previous valid primary as `state.backup.json`. When `state.json` is invalid and the backup is valid, startup moves the invalid primary to `state.corrupt.json`, restores the backup, and writes a fresh primary. If both files are invalid, startup stops without replacing either one. Restore a backup compatible with the target release before rolling back to an older build.
