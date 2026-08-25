# Operations and troubleshooting

## Runtime layout

Commonspace runs inside the existing DSH Web process. It does not start another web server.

- Bundle: linked/installed DSH plugin.
- State: `~/.commonspace/state.json` (`0600`, atomic temp-file publication).
- Temporary files: `~/.commonspace/tmp/` (`0700`; files `0600`).
- Native sessions and credentials: owned by Hermes, Codex CLI, or Claude Code in their supported stores.

## Configuration

`CommonspaceHostConfig` supports:

- `root`
- `hermesPath`
- `codexPath`
- `claudePath`
- `maxAgentsPerTurn`
- `runBudgetSeconds`
- `maxClaudeTurns`
- `hermesYolo` / legacy `yolo`
- `externalAgentYolo`

The packaged bundle maps:

```bash
COMMONSPACE_HERMES_YOLO=1  # Hermes only
COMMONSPACE_AGENT_YOLO=1   # Codex + Claude only
```

Both are intentionally unset by default.

## Install and update modes

### Linked developer checkout

Use this when the target machine will edit Commonspace:

```bash
git clone git@github.com:ralphbibera/commonspace.git
cd commonspace
pnpm install --frozen-lockfile
pnpm build
dsh plugin --profile web add .
```

The profile records a `link:` dependency. Pull and rebuild to update it; restart DSH Web after every host/client build.

### Prebuilt package

Use the `commonspace.tgz` artifact attached to a successful `main` CI run, or create one with `pnpm pack:plugin`. Install it with:

```bash
dsh plugin --profile web add ./commonspace.tgz
```

This path needs no build allowance and is the best way to test one exact pushed commit on another machine.

### Pinned Git source

The package has a self-contained `prepare` build. Install `github:ralphbibera/commonspace#<full-commit-sha>` once and let pnpm reject the unapproved build. Copy the exact rejected build key it prints—including source identity where required—into the web profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  '<exact key printed by pnpm>': true
```

Rerun the same pinned add. Never guess a broader package-only key or allow a moving unreviewed branch to execute install-time code. This flow requires pnpm 10.26+; the repository pins 10.34.5.

## Health checks

1. Confirm DSH Web answers on its configured loopback URL.
2. Switch to Commonspace and verify the browser and conversation surfaces replace—not stack under—the native surfaces.
3. Verify the Agent roster.
4. Run `pnpm verify:live` from a checkout for end-to-end coverage.
5. Run the adapter-specific smoke test for every enabled managed runtime.

## Common failures

### No Hermes agents

Run `hermes profile list` in the same service environment. Commonspace tolerates Hermes discovery failure so managed Codex/Claude agents remain usable, but logs the discovery error.

### Codex cannot resume

Commonspace recognizes a missing rollout/session, deletes the stale mapping, and tries one fresh session. Repeated failure is not a stale-session problem; inspect Codex authentication, model configuration, and sandbox access.

### Claude Code times out or returns OAuth 401

`claude auth status` can report logged in while the access token is no longer accepted. Reauthenticate through the supported Claude CLI flow:

```bash
claude auth login
```

Then run:

```bash
pnpm verify:adapters:claude
```

Do not enable unsafe mode to solve authentication.

### Project path rejected

Paths must be absolute, resolve through `realpath`, exist, and be directories. Loaded state is sanitized the same way before an adapter can receive `cwd` or an additional writable path.

### Live UI looks stale after a build

Because the checkout is linked, rebuild and restart DSH Web:

```bash
pnpm build
# stop the old dsh web process
dsh web --no-open --port 3080
```

A browser reload alone does not reload the host bundle.

## Backup and rollback

Before reverting across a state-version boundary:

```bash
cp ~/.commonspace/state.json ~/.commonspace/state-v6.backup.json
```

A pre-v6 host cannot preserve DM generation scopes. Do not let it overwrite the backup. To remove the bundle:

```bash
dsh plugin --profile web remove @ralphbibera/commonspace
dsh web
```

The state file remains until deliberately removed. Never commit it or CLI credential/session stores.
