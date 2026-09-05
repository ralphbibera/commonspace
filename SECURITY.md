# Security policy

Report suspected security problems privately. Do not put vulnerability details, credentials, or private workspace data in a normal issue.

## Send a private report

Use the repository's **Security → Report a vulnerability** form when it is available. During the private preview, you can also contact a maintainer through an existing private communication channel. If neither route is available to you, ask a maintainer how to submit a confidential report before sharing the details.

Include:

- the affected Commonspace release or Git commit;
- your operating system and Node.js version;
- the smallest reproduction you can provide without private data;
- the possible impact and any workaround you have found.

Do not attach workspace state, credential stores, or agent transcripts unless a maintainer requests them through the private reporting channel.

A monitored private reporting route must be verified before public launch. Its availability is tracked in the [maintainer launch checklist](docs/maintaining.md#public-launch-checklist).

## Supported versions

Commonspace is in private preview. Security fixes target the latest `main` revision and the latest available preview release. Older preview versions do not have a separate backport commitment; use the fixed release when it becomes available. The preview does not have a fixed response-time guarantee.

## How Commonspace protects local data

- The server listens only on `127.0.0.1`. Requests that change data must pass the same-origin browser checks.
- Project folders are resolved to their real filesystem locations before they are passed to an agent.
- Agent commands run without a shell, with limits on input, output, and execution time.
- Commonspace stores references to agent sessions. The agents retain their own credentials and session stores.
- Project Files blocks previews of known sensitive filenames and private-key formats.
- Routing provider keys are stored with owner-only permissions and are never returned by the API. Changing the endpoint's origin clears its saved key. `OPENAI_API_KEY` is used only for the OpenAI origin, not for other providers.
- Unsafe agent modes are off by default and require explicit environment variables.

These protections do not make Commonspace a secret manager or every Project file safe to share. Agents may read files and contact model services according to their permissions and provider settings. Keep secrets out of messages, screenshots, and files you ask agents to inspect.

See [Operations](docs/operations.md) for local storage, configuration, and recovery details.
