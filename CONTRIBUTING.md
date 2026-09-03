# Contributing to Commonspace

Commonspace welcomes focused fixes, documentation improvements, and carefully scoped product work. The fastest contributions are small, complete, and easy to verify.

## Before you start

Search the repository before writing code:

- Check [open issues](https://github.com/ralphbibera/commonspace/issues) for the same problem.
- Check open pull requests for work already in progress.
- Read the [roadmap](docs/roadmap.md) and [product specification](docs/product-spec.md) before proposing product behavior.
- If an older pull request attempted the same change, link it and explain why a new implementation is useful.

Do not open parallel work when an active pull request can be reviewed, tested, or completed instead.

## Choose the right contribution path

### Small, focused changes

Small fixes are the easiest to review and merge:

- Solve one clear problem.
- Touch only the files needed for that problem.
- Include the smallest useful test or verification evidence.
- Keep unrelated cleanup out of the pull request.
- Leave every required check green.

A separate issue is optional when the pull request fully explains a small bug or documentation correction.

### Features and architectural changes

Discuss significant work in a public GitHub issue before implementation. Significant work includes:

- New product concepts or user workflows.
- Persisted-state or compatibility changes.
- Agent runtime, routing, permission, or security changes.
- Broad UI redesigns.
- New dependencies or platform requirements.

Describe the user problem, proposed behavior, alternatives, and product fit. Wait for maintainer direction before investing in a large implementation. An uncoordinated feature may be closed even when its code is sound if it conflicts with the roadmap, product model, or maintenance capacity.

## Development setup

Requirements:

- Node.js 22 or newer.
- pnpm 10.34.5.
- macOS for service-lifecycle verification.
- Authenticated Hermes or Codex installations only for opt-in live ACP checks.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

The UI runs at `http://127.0.0.1:5173`. The API runs at `http://127.0.0.1:3100`.

Read [the development guide](docs/development.md) for the workspace map, runtime boundaries, and release-path commands. Repository-specific agent instructions live in [AGENTS.md](AGENTS.md).

## Change workflow

1. Reproduce the problem or define an observable acceptance condition.
2. Add a focused failing behavior test when behavior is changing.
3. Implement the smallest production change.
4. Run the focused test while iterating.
5. Run the required repository gates.
6. Review the complete diff and remove unrelated changes.
7. Open a pull request using the repository template.

For visual-only work, verify the actual rendered UI and provide screenshots of the affected states. Do not add a test whose only value is proving that an old element or CSS rule is absent.

## Pull request requirements

### Use the pull request template

Every pull request must use [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md). If tooling bypasses the template, copy its sections into the pull request description.

A reviewer must be able to understand the problem, the chosen solution, the verification evidence, and the remaining risk without reconstructing them from commits.

### Link public work or explain the problem

If a public issue exists, link it with `Fixes #123`, `Closes #123`, or `Refs #123`. Link related and superseded pull requests too.

If no issue exists, explain the problem directly in the pull request:

- Current behavior.
- Expected behavior.
- Reproduction steps or motivating workflow.
- Why the change belongs in Commonspace.

Only cite public GitHub issues and pull requests. Do not expose private task IDs, local workspace links, native agent-session references, absolute host paths, private network addresses, or `localhost` URLs from your environment. Restate useful context in plain language instead.

### Use a descriptive branch name

Use short kebab-case names that describe the change:

- `fix/thread-scroll-restoration`
- `feat/channel-export`
- `docs/runtime-setup`

Do not use private task IDs, local agent names, or machine-generated workspace identifiers in public branch names.

### Keep one logical change per pull request

A pull request should have one reviewable purpose. Avoid opportunistic refactors, dependency upgrades, formatting churn, and generated-file changes that are unrelated to that purpose. Large changes may be asked to split into independently verifiable slices.

### Provide verification evidence

Run the checks that match the change:

| Change                          | Required evidence                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Documentation only              | Review rendered Markdown and run `git diff --check`.                                                                             |
| Code or behavior                | Focused tests, then `pnpm check`.                                                                                                |
| Server, API, or visible UI      | `pnpm check` and `pnpm verify:live`.                                                                                             |
| Visual UI                       | Real rendered-state screenshots in addition to applicable checks.                                                                |
| macOS install/update/rollback   | `pnpm verify:service` on a supported macOS host.                                                                                 |
| Hermes or Codex ACP integration | Focused automated tests; run the applicable opt-in `pnpm verify:acp*` command when credentials and runtime access are available. |

List every command you ran and its result. If a relevant check could not run, say why. Do not describe an unrun check as passing. CI must be green before merge.

### Disclose AI assistance

Every pull request must state whether AI assisted the change.

When AI was used, include:

- Provider and exact model identifier when known.
- What the model did: research, implementation, tests, review, or documentation.
- Any important limitations in the generated or reviewed work.

When no AI was used, write `None — human-authored`.

Do not publish private reasoning, prompts containing secrets, credentials, local session identifiers, or tool logs with host-private data. The contributor remains responsible for every submitted line and every verification claim.

### Protect local and credential data

Never commit:

- Credentials, tokens, cookies, private keys, or `.env` files.
- `~/.commonspace` state or provider-native session stores.
- Native session IDs, scoped MCP capabilities, or private filesystem paths.
- Generated `dist` output, browser artifacts, or local screenshots unless the pull request intentionally includes reviewed documentation assets.

Security-sensitive behavior must preserve loopback binding, same-origin mutation guards, path containment, credential-file refusal, and runtime-owned authentication boundaries.

## Product and architecture boundaries

Commonspace is a local-first conversation workspace. Messages and threads are the work record. A contribution must not introduce a parallel task, issue, company, org-chart, approval, or work-queue domain without an explicit product decision.

Code ownership is intentionally clear:

- `packages/shared` owns cross-process contracts and pure shared helpers.
- `server` owns API behavior, persistence, routing, concurrency, and subprocess lifecycle.
- `ui` owns presentation and communicates with the server only through shared contracts and `/api`.
- Hermes and Codex own their credentials, configuration, and native session stores.

Persisted-state changes must be versioned, sanitized, atomic, migration-tested, and documented. CLI invocations must use argument arrays and piped input rather than constructed shell commands.

## Helping another contributor

Improving an active or stalled pull request is welcome. Coordinate publicly before taking over substantial work. Preserve the original contributor's commits when practical, credit their work in the new pull request, and keep review comments specific and respectful.

## Writing clearly

Use direct technical English:

- State the problem before the implementation.
- Use short sentences and active voice.
- Separate observed behavior from assumptions.
- Explain why the change belongs, not only what files changed.
- Report concrete commands and observed results.
- Name risks and rollback steps when applicable.
- Avoid promotional language, generic AI summaries, and hidden-context references.

Use clear imperative commit subjects. Keep each commit coherent enough to review or revert.

## Review standard

Maintainers evaluate:

1. Product fit.
2. Correctness and failure behavior.
3. Scope and reviewability.
4. Privacy and security boundaries.
5. Test and runtime evidence.
6. Compatibility and migration safety.
7. Documentation accuracy.
8. Long-term maintenance cost.

A thoughtful implementation is not automatically mergeable. Review may request a smaller scope, a different architecture, stronger evidence, or no product change at all.

## Conduct and security

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report security vulnerabilities through the private process in [SECURITY.md](SECURITY.md), not a public issue.
