# Operations

Use this guide to configure, inspect, update, back up, and recover a local Commonspace instance. [Installation](install.md) covers the first launch. [Development](development.md) covers the source editing workflow.

## Runtime

If you have a runtime archive, extract it and run this from the extracted directory:

```bash
node commonspace.mjs
```

Node.js 22 or newer is required. The archive includes the built UI, server, and production dependencies. It serves the application and API at `http://127.0.0.1:3100` without a source checkout, dependency install, or build. Stop the foreground process with Ctrl+C.

To run production builds from source:

```bash
pnpm build
pnpm start
```

In a second terminal, start the built UI:

```bash
pnpm --filter @commonspace/ui preview
```

Open the preview URL printed by Vite. The source server binds to `127.0.0.1:3100` and serves the API and root health check. It does not serve UI assets unless `COMMONSPACE_UI_ROOT` is set. The archive launcher and installed macOS service set that directory automatically so the UI and API share one origin.

## Runtime configuration

The server reads these variables at startup. They apply to the foreground process in which they are set. The installed macOS service uses the environment written into its LaunchAgent and does not automatically inherit later shell changes.

| Variable | Default or behavior |
| --- | --- |
| `COMMONSPACE_PORT` | API port; defaults to `3100`. Accepts `0` for an operating-system-assigned port. |
| `COMMONSPACE_HOME` | Local state directory; defaults to `~/.commonspace`. Use a separate directory for development or verification. |
| `COMMONSPACE_UI_ROOT` | Built browser asset directory. The source server serves no UI when unset; archive/service launchers set it. |
| `COMMONSPACE_LOG_LEVEL` | Server log level; defaults to `info`. |
| `COMMONSPACE_HERMES_PATH` | Hermes discovery executable and default Hermes ACP executable; defaults to `hermes`. |
| `COMMONSPACE_CODEX_PATH` | Codex executable; defaults to `codex`. |
| `COMMONSPACE_HERMES_ACP_PATH` | Overrides the Hermes ACP executable; otherwise uses `COMMONSPACE_HERMES_PATH`. |
| `COMMONSPACE_CODEX_ACP_PATH` | Overrides the Codex ACP bridge executable; the bundled bridge is used by default. |
| `COMMONSPACE_HERMES_YOLO=1` | Explicitly enables Hermes unsafe mode. |
| `COMMONSPACE_AGENT_YOLO=1` | Explicitly enables Codex unsafe mode. |
| `OPENAI_API_KEY` | Inference key fallback for the canonical OpenAI origin only. Other endpoints require an explicit configured key when needed. |

Unsafe modes change harness permission behavior. They do not authenticate a harness or repair routing configuration.

Configure inference in Workspace settings using a supported harness or an OpenAI-compatible endpoint. Stored endpoint keys are not returned to the browser. Changing the endpoint's origin clears its stored key, so enter the appropriate key again after that change.

## Installed macOS service

Use a verified archive for the computer's architecture. Stop any foreground Commonspace process so port `3100` is free, then run this inside the extracted directory:

```bash
node scripts/commonspace-service.mjs install --release .
```

The installer stages the release, validates the LaunchAgent property list, atomically activates it, starts the service, and requires `/api/health` to pass. State remains in `~/.commonspace`. One previous release is retained for recovery. Agent authentication is needed when running an agent, not when installing or opening the application.

After installation:

```bash
~/.local/bin/commonspace status
~/.local/bin/commonspace stop
~/.local/bin/commonspace start
~/.local/bin/commonspace restart
~/.local/bin/commonspace update --release /path/to/new/extracted/release
~/.local/bin/commonspace rollback
```

| Managed path | Contents |
| --- | --- |
| `~/Library/Application Support/Commonspace/current` | Active application release |
| `~/Library/Application Support/Commonspace/previous` | Rollback application release |
| `~/Library/LaunchAgents/dev.commonspace.service.plist` | LaunchAgent configuration |
| `~/.local/bin/commonspace` | Lifecycle command |
| `~/Library/Logs/Commonspace/service.log` | Standard service log |
| `~/Library/Logs/Commonspace/service.error.log` | Error log |

An update stages the new archive while the old process continues running. A staging failure leaves the current release in place. A failed activation health check restores and restarts the previous release.

`rollback` swaps the current and previous application releases. It does not reverse state migrations; read [Backup and rollback](#backup-and-rollback) before downgrading.

### Source-based macOS installation

Contributors can install a committed `main` checkout:

```bash
pnpm service:install
```

This path also requires Corepack, Git, the pinned pnpm version, and SSH repository access. The installer clones committed source and builds a staging release; it does not include uncommitted edits.

For a source-based installation, `~/.local/bin/commonspace update` clones `git@github.com:ralphbibera/commonspace.git` over SSH and builds `main`. Archive installations require an explicit `--release` directory for updates; they do not automatically switch to a source build.

Linux archives run in the foreground. A managed Linux background service is not included.

## Local data

| Path | Contents |
| --- | --- |
| `~/.commonspace/state.json` | Current workspace state |
| `~/.commonspace/state.backup.json` | Previous valid state |
| `~/.commonspace/state.corrupt.json` | Last invalid primary retained during automatic recovery |
| `~/.commonspace/routing.json` | Routing-provider configuration |
| `~/.commonspace/workspace` | Managed directory for projectless work |
| `~/.commonspace/attachments` | Private image and general-file bytes |
| Harness-owned locations | Native credentials and transcripts |

`COMMONSPACE_HOME` changes the Commonspace data root. Startup enforces `0700` on this directory, and state writes use `0600` files and atomic replacement.

Agent Client Protocol (ACP) runs over local child-process input/output. Commonspace's Model Context Protocol (MCP) endpoint is authenticated and loopback-only. Its bearer capabilities exist only in memory and are never persisted.

## Export, import, and retention

Open **Workspace data** in Commonspace settings to export `commonspace-export.json`. The archive excludes credentials, native-session references, temporary capabilities, and known absolute paths from Commonspace-managed fields. It keeps conversation text and exact attachment bytes, which may contain sensitive author-supplied content. Treat the unencrypted archive as private data. See [Workspace archive format](workspace-archive-format.md) for the contract.

To import:

1. Start with a new, empty workspace.
2. Choose the archive.
3. Map every exported Project root to an existing local directory.
4. Import and check the restored conversations and attachments.

Commonspace validates the entire archive before activating it. Native harness sessions are not transferred; the next agent turn starts new native continuity.

Retention removes data from one Channel or Direct Message. Preview the affected messages, Threads, attachments, pins, and permissions before confirming. A state change after preview requires a new preview. Active work must finish or be stopped first. Commonspace never expires conversation data in the background.

## Health checks

For a running instance:

```bash
curl http://127.0.0.1:3100/api/health
```

A healthy response is `{"status":"ok"}`. Adjust the port if configured differently. This checks server availability; it does not establish that an agent is authenticated or that a browser interaction works.

Contributor verification commands cover separate boundaries:

| Command | Evidence provided |
| --- | --- |
| `pnpm verify:live` | Fresh production build, temporary API/UI servers, and real desktop browser flows through separate and installed single-origin paths |
| `pnpm release:pack` followed by `pnpm verify:release` | A package built for the current target, extracted and run outside the source checkout |
| `pnpm verify:service` | Local Git clone, frozen install, build, real plist validation, staged update, and rollback under a temporary home; `launchctl` and health responses are stubbed |
| `pnpm verify:acp:hermes` | Real Hermes session startup and exact resumption |
| `pnpm verify:acp:codex` | Real Codex session startup and exact resumption |
| `pnpm verify:acp:mcp` | Real harness context reads, visible progress, and final response through scoped MCP tools |

ACP checks are opt-in and use locally authenticated harnesses and model access. A package or lifecycle smoke test does not replace real service and harness verification on each supported target.

## OS notifications

Notifications are off by default. Enable them in settings and choose categories for replies/input requests, mentions, permissions, failures/timeouts, and sound. Saving these preferences does not depend on inference configuration or change durable Inbox items.

The service delivers only new Inbox events after its current baseline. Restart and archive import do not replay old alerts. Muting a session suppresses its native alert while preserving the Inbox record. Clicking an alert opens its exact validated conversation, Thread, and message on the loopback application origin.

Use **Send test notification** to check macOS delivery. When native delivery fails, Commonspace reports the failure and operating-system guidance while preserving the event in Inbox. The Agent result is unchanged.

## Common failures

### UI development cannot reach the API

Run `pnpm dev` from the repository root. Confirm that the API is on port `3100` and open the Vite UI on port `5173`. If using a custom API port, check the development proxy configuration as well.

### No supported agent appears

Run `hermes --version` or `codex --version` in the same environment as Commonspace. Open **Add Agent** and request a scan. Discovery lists installed supported harnesses; selecting one adds it to the roster. Previously selected identities remain visible during temporary availability failures so their conversation history is preserved.

### Project path rejected

Use an absolute path to an existing directory. Commonspace resolves it through `realpath` before accepting it. Canonical roots stay server-private; browser responses show **Working folder** and **Reference folder N** labels, and file requests use root indexes plus relative paths.

### Agent authentication fails

Authenticate through the affected Hermes or Codex installation and retry. Commonspace uses the harness's supported credential store. Unsafe mode does not solve authentication.

### Routing inference fails

The Channel message is persisted before inference. If routing fails, the accepted message remains visible with a failed state and a durable Inbox item; Commonspace does not broadcast it to every agent.

Configure a working inference harness or OpenAI-compatible endpoint in Workspace settings. Open the affected conversation or Thread from Inbox, then use `/retry` to send your most recent message there again. You can also send a new message explicitly addressing the intended `@agent`. After changing an endpoint origin, enter its key again. The `OPENAI_API_KEY` fallback applies only to the canonical OpenAI origin.

### A Project file is marked sensitive

Commonspace lists known credential-bearing files but does not preview their contents. This includes `.env*`, common credential/authentication/secret files, private keys, and certificate key containers. Inspect them outside Commonspace using a workflow appropriate for secrets.

### ACP bridge fails to start

Run `hermes acp --check` or `codex --version` in the same environment as Commonspace. Check the executable overrides in [Runtime configuration](#runtime-configuration). A successful version check establishes that the executable is reachable; an ACP session check establishes that the integration can start.

### A native session cannot resume

Commonspace starts a replacement native session only when the provider explicitly reports the saved session missing. Authentication, transport, and other temporary failures preserve the saved session reference. Use `/new` when you deliberately want a hard context boundary.

### An agent misses Channel context

Check that the run uses ACP and that local `/api/mcp` requests are not returning `401`. Channel agents receive a native `commonspace_get_context` tool whose description requires a call at the start of the turn. Shared room context is supplied through that tool instead of being repeated inside the user message.

### A reply has no activity trace

Commonspace records only activity emitted by the native ACP runtime. A reply may legitimately have no activity row if the runtime reports only final text. Check the harness's ACP support before treating absent reasoning, plan, tool, or usage updates as a Commonspace rendering failure.

## Shutdown

Ctrl+C, `SIGINT`, and `SIGTERM` stop new sends, cancel and close ACP process groups, wait for background work and atomic writes, revoke MCP capabilities, and close HTTP connections.

During `pnpm dev`, watched backend edits use a different path: the existing server waits for accepted turns to finish and then replaces itself once. A crash or explicit terminal shutdown does not use that idle wait.

Closing the browser leaves an installed LaunchAgent and its turns running. `commonspace stop`, logout, or machine shutdown terminates the service. On the next start, interrupted work has an explicit interruption state.

## Backup and rollback

Back up the whole Commonspace data directory before testing a version downgrade or changing state compatibility. Stop the service first, or use Ctrl+C for a foreground instance. Choose a new backup directory so an earlier backup is not overwritten:

```bash
~/.local/bin/commonspace stop
cp -R ~/.commonspace ~/commonspace-backup-YYYYMMDD
```

Replace `YYYYMMDD` with your backup date, and adjust the source if using `COMMONSPACE_HOME`. The copy includes routing configuration and attachments; keep it private. Native harness stores remain separate and are not included.

The current internal state version is 26 and migrates versions 1–25 on startup. Each write retains the previous valid primary as `state.backup.json`. If the primary is invalid and the backup is valid, startup preserves the primary as `state.corrupt.json` and recovers the backup. If both are invalid, startup stops without replacing them.

The automatic state backup protects against an invalid write; it is not a complete archive of earlier releases. Application rollback does not reverse migrations. Before starting an older build, restore a data backup compatible with that build, and keep a separate copy of the current data so the recovery attempt remains reversible.
