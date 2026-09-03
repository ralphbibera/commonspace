# Development support matrix

This matrix describes the environments maintained for source contribution.

| Area | Supported or validated path | Notes |
| --- | --- | --- |
| Runtime | Node.js 22 or newer | Required by the root package engine declaration |
| Package manager | pnpm 10.34.5 | Use the repository lockfile and `--frozen-lockfile` |
| Source development | macOS and Linux | Linux is exercised by CI; macOS also has the service lifecycle path |
| Windows source development | Not currently validated | Contributions are welcome, but CI and service behavior may need platform work |
| UI development | Vite at `127.0.0.1:5173` | Proxies API requests to the local server |
| API development | Express at `127.0.0.1:3100` | Loopback-only by design |
| Isolated UI work | Storybook and its browser test runner | Does not require agent credentials |
| Integrated browser checks | Playwright-backed `pnpm verify:live` | Uses managed Chromium locally or system Chrome in CI |
| Real agent checks | Opt-in Hermes and Codex ACP commands | Requires the contributor’s own local installation and credentials |
| Installed service | macOS LaunchAgent | Not part of the normal source-development loop |

The default contributor path is intentionally local and credential-free. Provider credentials and native session stores stay outside the repository and are never required for the normal unit, integration, or Storybook checks.
