# Install Commonspace

A Commonspace release archive contains the app and the dependencies it needs. Install Node.js 22 or newer, download the archive for your computer, and run it from a terminal. You do not need Git, pnpm, or a source build.

If you already have an extracted archive, go to [Start Commonspace](#start-commonspace).

## Check your computer

Release archives are built for these targets:

| Computer | Archive target |
| --- | --- |
| Apple Silicon Mac | `darwin-arm64` |
| Intel Mac | `darwin-x64` |
| Linux on x86-64 | `linux-x64` |

Windows and Linux ARM archives are not currently provided. See the [support matrix](https://github.com/ralphbibera/commonspace/blob/main/docs/support-matrix.md) for the full coverage and limits.

Check your Node.js version and the target it uses:

```bash
node --version
node -p "process.platform + '-' + process.arch"
```

The first command should report version 22 or newer. Choose the archive target printed by the second command. Use a Node.js installation built for your computer's architecture.

## Download a release

For packaged builds, check the [Releases page](https://github.com/ralphbibera/commonspace/releases). To build and run Commonspace locally, follow [the source setup](https://github.com/ralphbibera/commonspace/blob/main/CONTRIBUTING.md).

Download both the archive for your target and its matching `.tar.gz.sha256` file. Keep them in the same folder.

In a terminal opened in that folder, set the version and target for your download. Replace `X.Y.Z` with the release version without its leading `v`.

```bash
version=X.Y.Z
target=darwin-arm64
archive="commonspace-${version}-${target}.tar.gz"
```

If you prefer the GitHub CLI, you can download the same files with an authenticated `gh` installation:

```bash
gh release list --repo ralphbibera/commonspace
gh release download "v$version" --repo ralphbibera/commonspace \
  --pattern "$archive" --pattern "$archive.sha256"
```

## Verify and extract

In the same terminal, check the download:

```bash
shasum -a 256 -c "$archive.sha256"
```

On Linux, you can use `sha256sum -c "$archive.sha256"` instead. Continue only if the check reports `OK`. The checksum detects a damaged or mismatched download; it is not a separate publisher signature.

Extract the verified archive and open its directory:

```bash
tar -xzf "$archive"
cd "${archive%.tar.gz}"
```

## Start Commonspace

From the extracted directory:

```bash
node commonspace.mjs
```

Open `http://127.0.0.1:3100` in your desktop browser. Keep the terminal open while using the app. Press Ctrl+C to stop Commonspace and its active agent work.

You can open the workspace without an agent. To send your first message:

1. Install and authenticate Hermes or Codex separately, then choose **Add Agent** in Commonspace and select it.
2. Select the agent in the sidebar to open its **Direct Message**, then send a message. This conversation goes directly to that agent and does not need Channel routing setup.
3. For code work, create a **Project** with the relevant local folder or folders. In a message, type `@@` and select the Project to insert its `@@project` reference.

These commands show the release version and available options without starting the app:

```bash
node commonspace.mjs --version
node commonspace.mjs --help
```

Workspace data is stored in `~/.commonspace` by default, outside the release directory. For a terminal-run instance, set `COMMONSPACE_HOME` to choose another data directory or `COMMONSPACE_PORT` to choose another loopback port. Keep workspace data and credentials out of the extracted archive.

## Run in the background on macOS

Commonspace can install a per-user macOS service, called a LaunchAgent, so closing the browser or terminal does not stop the app.

Stop any terminal-run instance with Ctrl+C first so port `3100` is available. From the extracted release directory, run:

```bash
node scripts/commonspace-service.mjs install --release .
```

The installer copies the release into its managed location, starts it, and checks that it responds. It also installs the command at `~/.local/bin/commonspace`. The managed service uses `~/.commonspace` for data and port `3100`.

Check the result:

```bash
~/.local/bin/commonspace status
```

The output should begin with `Commonspace: healthy`. Open `http://127.0.0.1:3100` to use it. Choose the command for the action you need:

| Action | Command |
| --- | --- |
| Stop the service | `~/.local/bin/commonspace stop` |
| Start the service | `~/.local/bin/commonspace start` |
| Restart the service | `~/.local/bin/commonspace restart` |

Linux archives run from the terminal. A managed Linux background service is not included.

## Update Commonspace

Finish or stop active agent work and back up your workspace data before updating. Download, verify, and extract the new archive into a separate directory.

For a terminal-run instance, stop the old process and run `node commonspace.mjs` from the new directory. Use the same `COMMONSPACE_HOME`, if you set one, to keep using your workspace.

For the macOS service, replace the example path below with the new extracted directory:

```bash
~/.local/bin/commonspace update --release "/path/to/new/extracted/release"
~/.local/bin/commonspace status
```

The update keeps your workspace data and one previous application release. A failed startup check restores and restarts the previous application release.

## Return to the previous release

Check the release notes before downgrading. Application rollback does not undo changes to the workspace's saved-data format. If the format changed, stop Commonspace and restore a compatible data backup before starting the older release. See [backup and recovery instructions](https://github.com/ralphbibera/commonspace/blob/main/docs/operations.md#backup-and-rollback).

The installed macOS service can switch to its retained release with:

```bash
~/.local/bin/commonspace rollback
```

This command restarts the previous application release. For a terminal-run instance, stop the current process and start the older extracted release instead.

## Get help

See [Operations](https://github.com/ralphbibera/commonspace/blob/main/docs/operations.md) for logs, configuration, and common failures. A bug report should include your Commonspace version, operating system, Node.js version, and reproduction steps. Keep credentials, agent transcripts, and workspace state out of the report.

Follow the [security policy](https://github.com/ralphbibera/commonspace/blob/main/SECURITY.md) for suspected vulnerabilities. To contribute a fix, start with [Contributing](https://github.com/ralphbibera/commonspace/blob/main/CONTRIBUTING.md).

Commonspace is MIT licensed. This archive includes `LICENSE`.
