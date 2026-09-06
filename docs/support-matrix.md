# Support matrix

Use this page to choose a published package or development environment. Commonspace runs in a desktop browser. The tables distinguish automated checks from integrations that need a separate local test.

## Published package

The `commonspace` npm package requires Node.js 22 or newer. npm installs external runtime dependencies for the current computer; Commonspace does not publish separate operating-system archives.

| Computer | Published-package coverage | Background operation |
| --- | --- | --- |
| Apple Silicon or Intel Mac | Supported npm installation | Foreground package; source checkout can install a per-user service |
| Linux | Supported npm installation | Foreground package |
| Windows | Not currently validated | Not currently validated |

The release workflow installs one npm tarball in a clean Linux prefix and exercises its API, UI, and shutdown. macOS service behavior remains a separate source-based check. See workflow results and release notes for evidence about a particular version.

Commonspace does not currently ship a desktop app wrapper. Follow [Installation](install.md) to run it in your browser.

## Development environments

| Requirement or tool | Current coverage |
| --- | --- |
| Node.js | Version 22 is the CI baseline. Newer versions satisfy the `>=22` requirement but are not separately tested by the CI matrix. |
| pnpm | Use version 10.34.5 and `pnpm install --frozen-lockfile`. |
| macOS and Linux | Supported source-development environments. Linux runs the main CI checks; macOS also has service checks. |
| Windows | Source development is not currently validated. |
| Git and Corepack | Needed for repository development and the source-based macOS installation. Published-package users need npm or `npx`. |
| Vite | Serves the development UI at `127.0.0.1:5173` and forwards API requests to the local server. |
| Express | Serves the local API at `127.0.0.1:3100`. |

Start with [Contributing](../CONTRIBUTING.md) for a fresh checkout and [Development](development.md) for day-to-day commands.

## Agent runtimes

| Runtime | Connection and current compatibility |
| --- | --- |
| Codex | Installed CLI through bundled `@agentclientprotocol/codex-acp`. |
| Claude Code | Installed CLI through bundled `@agentclientprotocol/claude-agent-acp` 0.75.0; account-free fixture verifies bundled CLI 2.1.257. |
| Gemini CLI | Native `gemini --acp`; requires stable `>=0.39.1` and `<0.44.0`. Use tested version **0.43.0**. Later tested releases regress exact session resume and are rejected during discovery and launch. |
| OpenCode | Native `opencode acp`; account-free fixture verifies **1.18.29**. |
| Hermes | Installed `hermes acp`, using existing native profiles. |

Codex, Claude Code, Gemini CLI, and OpenCode form the initial baseline. Pi coding agent remains planned until its integration passes the same native-session and scoped MCP requirements. See the [adapter guide](agent-adapters.md) for setup, compatibility evidence, and the format for adding another runtime.

## What the checks cover

| Check | Credentials needed | Coverage |
| --- | --- | --- |
| Unit and integration tests | No. | Commonspace's state, API, and other application behavior. |
| Storybook browser tests | No. | Isolated component and screen behavior. |
| `pnpm verify:live` | No. | The built UI and server working together in a desktop browser. Uses managed Chromium locally or system Chrome in CI. |
| `pnpm verify:npm-package` | No. | A clean npm install starts, serves its API and UI, and shuts down outside the source checkout. |
| `pnpm verify:service` | No agent credentials. | The macOS source-based service lifecycle in a temporary home, with launchctl and health responses substituted. |
| `pnpm verify:adapters` | No. | Real Claude Code, Gemini CLI, and OpenCode runtimes, native restart/resume and reset, scoped MCP and progress, using local model API fixtures. |
| Real Hermes, Codex, and Claude Code checks | Yes. | Agent session start, exact session resumption, and permitted context/progress tools. |
| Real macOS service check | A local macOS user session. | Installation, startup, update, and rollback with the actual LaunchAgent. |

Normal contribution checks do not need provider credentials or agent session stores. Keep those outside the repository. See [Releasing](releasing.md) for the required integration checks.
