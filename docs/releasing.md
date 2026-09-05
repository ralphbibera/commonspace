# Releasing Commonspace

This guide is for maintainers preparing an installable Commonspace release. The release workflow builds and checks archives, then creates a draft release on GitHub.

The repository owner reviews and approves the verified draft before a maintainer publishes it.

## Choose the version

Commonspace follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html), starting at `0.0.1`. Keep one identical version in the root, `packages/shared`, `server`, and `ui` package manifests.

Compatibility covers documented HTTP and MCP interfaces, CLI behavior, and the workspace archive format. The internal saved-state schema has a separate version and requires its own migration and recovery coverage.

| Change | Version update |
| --- | --- |
| Compatible bug or security fix | Increment the patch version. |
| Compatible feature or deprecation | Increment the minor version and reset the patch to zero. |
| Breaking change before `1.0.0` | Increment the minor version, reset the patch to zero, and include migration notes. |
| Breaking change from `1.0.0` onward | Increment the major version, reset minor and patch to zero, and include migration notes. |

Version `1.0.0` establishes stable supported interfaces. Before then, interfaces are under initial development and breaking changes follow the minor-version policy above.

Use a prerelease suffix for candidates, such as `0.0.2-rc.1`. Build metadata is supported, such as `0.0.2+build.1`, and does not affect version precedence. Store the complete version without a prefix in each manifest. Git tags add only `v` and must match exactly, including any suffix or metadata: version `0.0.2-rc.1` uses tag `v0.0.2-rc.1`.

The workflow always creates a draft. It marks the GitHub release as a prerelease only when the version contains a prerelease suffix; `0.0.1` and versions with build metadata alone are not prereleases.

Update the version and move the relevant [changelog](../CHANGELOG.md) entries into a dated release section through the normal contribution workflow. Release only a reviewed commit. Do not move an existing release tag to another commit.

The workspace packages are not published individually. This process distributes the assembled runtime as downloadable archives.

## Build and check locally

Use a clean checkout with Git, Corepack, Node.js 22, and the pinned pnpm version. From the repository root, run:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm verify:live
pnpm release:pack
pnpm verify:release
```

`release:pack` builds the app and writes an archive and checksum under `artifacts/release/`. It packages the operating system and CPU architecture of the machine running it. Use `release:pack:built` only when that checkout already has current production builds.

`verify:release` extracts the archive into a temporary directory, starts it without the source checkout, and checks the API, UI files, and shutdown. On macOS, it also checks installation, update, and rollback with `launchctl` commands and health responses substituted for the test. It does not start a real LaunchAgent or connect a real agent.

Local development archives may record uncommitted changes. Release automation rejects those archives and requires the recorded commit to match the selected tag.

## Check the real integrations

Before publishing, record results from the supported release environment:

| Check | What it proves |
| --- | --- |
| `pnpm verify:service` on macOS | The source-based clone, install, build, update, and rollback path works in a temporary home. It substitutes launchctl and health responses. |
| Install an archive with `node scripts/commonspace-service.mjs install --release .` on macOS | The real per-user service starts. Check browser access, status, update, and rollback as described in [Installation](install.md). |
| `pnpm verify:acp` | Authenticated Hermes and Codex installations can start and resume their exact existing sessions. |
| `pnpm verify:acp:mcp` | Those agents can read the allowed conversation context, post progress, and return the expected reply. |

Keep credentials and transcripts local. Record the commands, platform versions, results, and any checks that were not run. Passing an archive test does not establish that the real integrations passed.

## Prepare the draft on GitHub

The [Draft release workflow](../.github/workflows/release.yml) runs when a version tag is pushed. You can also start **Actions → Draft release → Run workflow** and supply an existing version tag in the `tag` field.

Before starting it, confirm that the selected tag matches the root version and has no existing release.

The workflow:

1. Resolves the tag to a commit and checks the version.
2. Runs the same complete CI checks used for contributions.
3. Builds and tests archives on macOS ARM64, macOS x64, and Linux x64.
4. Checks each archive's recorded version, commit, operating system, CPU architecture, and clean source state.
5. Rechecks all checksums and confirms the tag still points to the verified commit.
6. Creates a draft release with the archives and checksum files attached, using the version's prerelease suffix to set the prerelease flag.

The workflow refuses to overwrite any existing draft or published release. If a failed run left a draft, inspect it and the failure before removing that draft for a retry. Do not silently replace a published release's files. A code fix requires a new reviewed commit and release version.

## Review and publish

Inspect the draft's commit, version, download files, installation instructions, changes, known limitations, and test results. Include migration and backup instructions whenever a release changes saved data. Download and run the candidate archive on the release account using [Installation](install.md).

Complete the [release readiness checklist](maintaining.md#release-readiness-checklist), then publish the approved draft manually.

## What the archive contains

Each target produces:

```text
commonspace-<version>-<platform>-<arch>.tar.gz
commonspace-<version>-<platform>-<arch>.tar.gz.sha256
```

The targets are `darwin-arm64`, `darwin-x64`, and `linux-x64`. Build on the matching platform so any native dependencies work on the user's computer. The [support matrix](support-matrix.md) describes platform limits.

The archive extracts into one directory with the same base name:

| File or directory | Purpose |
| --- | --- |
| `commonspace.mjs` | Starts the app in the terminal and provides `--version` and `--help`. |
| `scripts/commonspace-service.mjs` | Installs and manages the macOS background service. |
| `server/dist` and production dependencies | Runs the API and agent connections, including shared code and the Codex ACP bridge. |
| `ui/dist` | Contains the built browser app. |
| `commonspace-release.json` | Records the version, source commit, source-change status, and target platform. |
| `README.md` | Contains the [installation guide](install.md). |
| `LICENSE` | Contains Commonspace's license. |
| `THIRD_PARTY_NOTICES.txt` | Preserves license and copyright notices for production dependencies, including libraries bundled into the browser app. |

The archive must work without the source checkout, and its filesystem links must stay within the extracted directory. Do not commit release archives, generated builds, workspace state, credentials, agent session stores, or browser artifacts.

Application rollback changes application files, not saved data. Keep a backup compatible with the older release before testing a downgrade; see [Operations](operations.md#backup-and-rollback).
