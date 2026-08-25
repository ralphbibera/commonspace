# Commonspace

Commonspace is a small DeepSeek Harness Web plugin that adds a Slack-like navigation entry to the existing Harness sidebar.

![Commonspace navigation panel](docs/assets/commonspace-panel.png)

> **Status:** private preview. The repository is structured for a future public release, but the package is intentionally marked `private` until its first release is ready.

## What it adds

Click **Commonspace** in the DeepSeek Harness sidebar to open three collapsible groups:

- **Projects**
- **Channels**
- **Direct Messages**

The plugin is additive. It preserves the existing Harness workspace list, sessions, conversation UI, model controls, tools, and context management.

## Install from a checkout

Requirements:

- Node.js 22 or newer
- pnpm 10 or newer
- DeepSeek Harness `0.1.1-rc.2` or newer

```bash
git clone git@github.com:ralphbibera/commonspace.git
cd commonspace
pnpm install
pnpm build
dsh plugin --profile web add .
```

Restart the Web profile:

```bash
dsh web
```

The plugin declares itself as a DSH bundle, so installing it activates `commonspace.patch.yml` automatically.

## Remove

```bash
dsh plugin --profile web remove @ralphbibera/commonspace
```

Restart `dsh web` after installing or removing a profile plugin.

## Development

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

With a patched Web profile running locally:

```bash
COMMONSPACE_TEST_URL=http://127.0.0.1:3080 pnpm verify:live
```

The live check opens the real Harness Web UI, clicks the Commonspace launcher, verifies the three disclosure groups, expands Projects, checks browser errors, and captures screenshots.

## Architecture

Commonspace is one dual-face Cordis package:

- `src/index.ts` is the host plugin face. The first release is intentionally a no-op.
- `src/client/index.ts` registers one entry in `sidebar.footer.action`.
- `src/client/CommonspaceLauncher.tsx` owns the accessible inline navigation and disclosure state.
- `commonspace.patch.yml` inserts the package into the Web profile.

See [`docs/architecture.md`](docs/architecture.md) for boundaries and future extension points.

## Current boundary

This first slice is navigation only. Projects, channels, direct-message records, persistence, and Harness-session mapping are not implemented yet. Those features should be added behind this UI without replacing Harness chat or compaction.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Security reports belong in private GitHub Security Advisories; see [`SECURITY.md`](SECURITY.md).

## License

MIT © Ralph Bibera
