# Contributing to Commonspace

You can help with bug fixes, features, tests, and documentation. This guide explains how to prepare a change that a maintainer can understand and verify. Normal development and tests do not require agent credentials.

## Choose a change

Search existing issues and pull requests before starting. Small fixes can go directly to a pull request; explain the problem there if no issue exists. For larger features or changes to the product model, open an issue and agree on the approach with a maintainer before implementing it.

Read the relevant parts of the [product direction](docs/product-direction.md), [product specification](docs/product-spec.md), and [architecture](docs/architecture.md). Keep one logical change per pull request. When continuing someone else's work, link it and give them credit.

## Set up your checkout

You need Node.js 22 or newer, pnpm 10.34.5, and Git. Fork the repository, then clone your fork. Replace `YOUR_USERNAME` with your GitHub username:

```bash
git clone https://github.com/YOUR_USERNAME/commonspace.git
cd commonspace
git remote add upstream https://github.com/ralphbibera/commonspace.git
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173` for the app. The API runs on port `3100`. Install and configure a [supported native runtime](docs/support-matrix.md#agent-runtimes) only when you need to test against its configured model provider. The normal suite includes real Claude Code, Gemini CLI, and OpenCode integration checks with local model fixtures and no account.

The [contributor guide](docs/contributor-guide.md) explains the repository layout and common development tasks. Check the [support matrix](docs/support-matrix.md) for platform coverage.

## Make the change

Before editing, write down the user problem, the product rule involved, the package responsible for the behavior, and how you will verify the result. These notes can become your pull request description.

1. Add a focused failing test for a behavior change. If no new test is needed, explain why and identify any existing coverage.
2. Make the smallest change that solves the problem. Keep unrelated cleanup separate.
3. Keep shared types and helpers in `packages/shared`, server behavior in `server`, and browser behavior in `ui`.
4. Update every affected consumer when a shared type changes. Include the migration and validation needed for saved-data changes.
5. Update the documentation that describes the changed behavior.
6. Review the complete diff, including generated code, and run the checks below.

Preserve local-only serving, request validation, private session data, and the agent's existing session when a conversation continues. The [architecture](docs/architecture.md) and [contributor guide](docs/contributor-guide.md) describe these requirements in more detail.

## Check your work

Use a focused test while developing, then run the full checks before requesting review:

```bash
pnpm test -- tests/channel-context.spec.ts
pnpm check:fast
pnpm check
git diff --check
```

Replace the example test file with the one relevant to your change. `check:fast` is useful during development. `check` runs the complete local code checks, tests, and builds.

| Change | Required verification |
| --- | --- |
| Shared types, server behavior, saved data, or security | A focused regression test, `pnpm check`, and `pnpm verify:live`. |
| UI component or screen | Relevant Storybook states and behavior checks, `pnpm check`, and a manual desktop check. Run `pnpm verify:live` when the change affects the complete app flow. |
| Packaging, installation, production dependencies, or release workflow | Focused tests, `pnpm check`, `pnpm verify:live`, `pnpm build:npm`, and `pnpm verify:npm-package`. Include macOS service checks when relevant. |
| Documentation or templates only | Check links, command examples, and file syntax, then run `git diff --check`. New behavior tests are not required. |

For UI work, `pnpm check:ui` runs the UI checks separately. The [contributor guide](docs/contributor-guide.md) explains Storybook and focused browser tests. Real agent and background-service checks are additional; record which ones you actually ran.

## Prepare a pull request

Use the pull request template to explain:

- the problem and the resulting behavior;
- which files or packages changed and why;
- the checks you ran, their results, and any checks you skipped;
- manual verification for visible changes, with screenshots or a short recording when useful;
- migration, compatibility, security, or performance risks;
- the provider and exact model used for AI assistance, or `None, human-authored`.

Use a descriptive branch name and conventional commit messages, such as `fix(server): preserve thread continuity` or `docs: clarify installation`. Mark unfinished pull requests as drafts.

A change is ready to merge when required CI passes, substantive review comments are resolved, and a maintainer approves it. [CODEOWNERS](.github/CODEOWNERS) identifies the current reviewer. A passing test suite does not replace review of product fit and behavior. See the [maintainer guide](docs/maintaining.md) for review responsibilities.

## Write useful documentation

- Write for the person using the page. State what they can do or learn before explaining implementation details.
- Use complete sentences and familiar words. Explain a technical term before relying on it.
- Give prerequisites, accurate commands, and the expected result. Check file links and command examples against the current implementation.
- Put detailed technical rules in the relevant reference page and link to them. Avoid repeating the same instructions across several pages.
- Distinguish supported behavior from planned work, and test results from checks that still need to run.

## Use AI responsibly

AI assistance is welcome. You remain responsible for understanding the change, checking its product fit, reviewing every changed line, and verifying the result. Disclose the provider and exact model in the pull request.

Use only code and data you are authorized to share with the chosen model. Do not send real Commonspace conversations or saved state, credentials, agent session records, or internal links without permission. Use synthetic data in contributions.

## Protect private data

Use synthetic data in examples and tests. Remove private paths, local instance links, internal task IDs, credentials, and agent session identifiers from screenshots, logs, commits, issues, and pull requests.

Do not commit `~/.commonspace`, agent credential or session stores, generated builds, npm tarballs, or browser artifacts. Follow [Security](SECURITY.md) for vulnerability reports and the [Code of Conduct](CODE_OF_CONDUCT.md) when participating.

By contributing, you agree that your contribution is provided under the repository's [MIT license](LICENSE).
