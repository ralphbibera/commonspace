# Operations

## Runtime

```bash
pnpm build
pnpm start
```

The server binds to `127.0.0.1:3100` by default and serves the built UI plus `/api`. Override the port with `COMMONSPACE_PORT`.

## Local data

- State: `~/.commonspace/state.json`
- Temporary prompts and adapter output: `~/.commonspace/tmp/`
- Credentials and native transcripts: each agent CLI's supported stores

Set `COMMONSPACE_HOME` to isolate state for development or verification.

## Health checks

```bash
curl http://127.0.0.1:3100/api/health
pnpm verify:live
```

The health response is `{"status":"ok"}`. The live verifier builds the workspace, starts an isolated server on an OS-assigned loopback port, opens the UI in Chromium, and verifies the application, navigation, conversation surface, and API.

## Common failures

### UI development cannot reach the API

Run `pnpm dev` from the workspace root. Confirm the server is on port `3100` and open the Vite URL on port `5173`.

### No Hermes agents

Run `hermes profile list` in the same environment. Discovery failure is non-fatal so configured Codex and Claude agents remain usable.

### Project path rejected

Project paths must be absolute, exist, resolve through `realpath`, and be directories.

### Adapter authentication fails

Authenticate with the adapter's supported CLI flow. Unsafe mode does not solve authentication and should not be used for that purpose.

## Backup and rollback

Before changing state versions:

```bash
cp ~/.commonspace/state.json ~/.commonspace/state.backup.json
```

The standalone extraction retains state version 6. Rolling back to the earlier implementation can reuse the same file as long as no newer state version has been written.
