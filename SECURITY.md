# Security Policy

## Reporting

Report suspected vulnerabilities privately through GitHub's **Report a vulnerability** flow. Include the affected revision, reproduction steps, impact, and any suggested mitigation.

## Current support

Commonspace is a private preview. Security fixes target the latest `main` revision.

## Security boundary

- The HTTP server binds to `127.0.0.1`.
- State-changing API requests require same-origin browser metadata.
- Project paths are canonicalized before an adapter receives them.
- Agent CLIs are invoked without a shell and with bounded input, output, and execution time.
- Commonspace stores session references but never copies runtime credentials.
- Unsafe adapter modes require explicit environment variables and are disabled by default.

Do not attach local state files, credential stores, or native agent transcripts to a vulnerability report unless requested through the private thread.
