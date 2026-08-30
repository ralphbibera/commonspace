# Security Policy

## Reporting

Report suspected vulnerabilities privately through GitHub's **Report a vulnerability** flow. Include the affected revision, reproduction steps, impact, and any suggested mitigation.

## Current support

Commonspace is a private preview. Security fixes target the latest `main` revision.

## Security boundary

- The HTTP server binds to `127.0.0.1`.
- State-changing API requests require same-origin browser metadata.
- Project paths are canonicalized before an agent runtime receives them.
- Agent CLIs are invoked without a shell and with bounded input, output, and execution time.
- Commonspace stores session references but never copies runtime credentials.
- Project Files refuse to preview known credential-bearing names and private-key formats.
- Routing credentials are stored owner-only, never returned by the API, cleared when the endpoint origin changes, and never inherited from `OPENAI_API_KEY` for a non-OpenAI origin.
- Unsafe agent modes require explicit environment variables and are disabled by default.

Commonspace is local-first, not a secret manager. Keep credentials in the supported Hermes, Codex, provider, or operating-system store. Do not place secrets in messages, traces, screenshots, or Project files that agents are asked to inspect.

Do not attach local state files, credential stores, or native agent transcripts to a vulnerability report unless requested through the private thread.
