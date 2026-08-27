# Operations

## Runtime

```bash
pnpm build
pnpm start
# In another terminal:
pnpm --filter @commonspace/ui preview
```

The API server binds to `127.0.0.1:3100` by default and serves `/api` plus the root health check. It never serves UI assets. Run `pnpm --filter @commonspace/ui preview` separately for the built UI. Override the API port with `COMMONSPACE_PORT`. Hermes uses its installed profile-native ACP server; Codex uses its bundled ACP bridge.

## Local data

- State: `~/.commonspace/state.json`
- Credentials and native transcripts: each agent CLI's supported stores

ACP runs over child-process stdio. The Commonspace MCP endpoint is authenticated, loopback-only, and uses in-memory bearer capabilities that are never persisted. There is no Nostr or remote relay service to configure.

Set `COMMONSPACE_HOME` to isolate state for development or verification.
Commonspace enforces `0700` on this directory at startup and replaces `state.json` atomically with `0600` permissions.

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

Run `hermes profile list` in the same environment. Commonspace shows discovered profiles in the Agents add panel; discovery alone does not add them to the roster. Codex agents remain usable if discovery fails.

### Project path rejected

Project paths must be absolute, exist, resolve through `realpath`, and be directories.

### Agent authentication fails

Authenticate with Hermes or Codex. Unsafe mode does not solve authentication and should not be used for that purpose.

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

## Backup and rollback

Before changing state versions:

```bash
cp ~/.commonspace/state.json ~/.commonspace/state.backup.json
```

Local agent appearance, Inbox read state, agent activity traces, and managed image attachment metadata use state version 12, which migrates versions 1–11 on startup. Restore a version 11 backup before rolling back to an older build.
