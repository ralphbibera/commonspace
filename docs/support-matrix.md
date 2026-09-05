# Support matrix

Use this page to choose a release archive or development environment. Commonspace runs in a desktop browser. The tables distinguish automated checks from integrations that need a separate local test.

## Release archives

All release archives require Node.js 22 or newer. They include the application and its production dependencies, so users do not need Git or pnpm.

| Computer | Archive target | Background operation |
| --- | --- | --- |
| Apple Silicon Mac | `darwin-arm64` | A per-user macOS service is included. |
| Intel Mac | `darwin-x64` | A per-user macOS service is included. |
| Linux on x86-64 | `linux-x64` | Run from a terminal; no managed background service is included. |
| Windows or Linux ARM | No archive provided | Not currently validated. |

The release workflow builds and checks these targets on macOS and Ubuntu runners. Other Linux distributions need local validation. See the workflow results and release notes for evidence about a particular version; a configured target alone does not mean that release has passed.

Commonspace does not currently ship a desktop app wrapper. Follow [Installation](install.md) to run it in your browser.

## Development environments

| Requirement or tool | Current coverage |
| --- | --- |
| Node.js | Version 22 is the CI baseline. Newer versions satisfy the `>=22` requirement but are not separately tested by the CI matrix. |
| pnpm | Use version 10.34.5 and `pnpm install --frozen-lockfile`. |
| macOS and Linux | Supported source-development environments. Linux runs the main CI checks; macOS also has service checks. |
| Windows | Source development is not currently validated. |
| Git and Corepack | Needed to build release archives and for the source-based macOS installation. |
| Vite | Serves the development UI at `127.0.0.1:5173` and forwards API requests to the local server. |
| Express | Serves the local API at `127.0.0.1:3100`. |

Start with [Contributing](../CONTRIBUTING.md) for a fresh checkout and [Development](development.md) for day-to-day commands.

## What the checks cover

| Check | Credentials needed | Coverage |
| --- | --- | --- |
| Unit and integration tests | No. | Commonspace's state, API, and other application behavior. |
| Storybook browser tests | No. | Isolated component and screen behavior. |
| `pnpm verify:live` | No. | The built UI and server working together in a desktop browser. Uses managed Chromium locally or system Chrome in CI. |
| `pnpm verify:release` | No. | An extracted archive starts, serves its API and UI, and shuts down. macOS installation checks substitute launchctl and health responses. |
| `pnpm verify:service` | No agent credentials. | The macOS source-based service lifecycle in a temporary home, with launchctl and health responses substituted. |
| Real Hermes and Codex checks | Yes. | Agent session start, exact session resumption, and permitted context/progress tools. |
| Real macOS service check | A local macOS user session. | Installation, startup, update, and rollback with the actual LaunchAgent. |

Normal contribution checks do not need provider credentials or agent session stores. Keep those outside the repository. See [Releasing](releasing.md) for the required integration checks.
