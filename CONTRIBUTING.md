# Contributing

Thank you for helping improve Commonspace. Small, focused fixes are welcome. Larger changes should establish product and architectural fit before implementation starts.

## Start in five minutes

You can work on the UI, server, tests, and Storybook without agent credentials.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the UI at `http://127.0.0.1:5173`. The API is at `http://127.0.0.1:3100`.

Run the focused contributor gate in another terminal:

```bash
pnpm check:fast
```

For isolated UI work, use Storybook:

```bash
pnpm storybook
pnpm test:storybook:watch -- Conversation
```

Real Hermes and Codex sessions are optional. They are not required for normal contribution work or for the default test suite.

Read [the contributor guide](docs/contributor-guide.md) for the repository map, supported development environments, test ownership, and common change paths.

## Before starting

1. Search open issues and pull requests for duplicate or in-progress work.
2. Read [product direction](docs/product-direction.md), [product specification](docs/product-spec.md), and [architecture](docs/architecture.md) for the area you will change.
3. Choose the smallest useful scope.
4. For a larger feature or a change to a product boundary, open or update a public discussion before writing a large implementation.

Do not include private task IDs, local instance links, localhost URLs, private filesystem paths, or credentials in public branches, commits, issues, or pull requests.

## Change workflow

1. Describe the user problem and the product rule involved.
2. Identify the owning package or feature boundary.
3. Add a focused failing test for behavior changes, or document the existing coverage that proves the change.
4. Implement the smallest production change.
5. Run the focused test and inspect the result.
6. Run `pnpm check:fast` while iterating.
7. Run `pnpm check` before requesting review.
8. Run `pnpm verify:live` for server, API, routing, persistence, or visible end-to-end changes.
9. Review `git diff --check` and the complete diff.

Keep changes inside the conversation-first product model. Shared contracts belong in `packages/shared`, host behavior belongs in `server`, and presentation belongs in `ui`.

## Verification commands

| Change | Minimum verification |
| --- | --- |
| Shared contract or server behavior | Focused test, `pnpm check`, `pnpm verify:live` |
| Isolated UI component or state | Storybook story, focused Storybook test, `pnpm check:ui` |
| Integrated UI flow | Storybook coverage, `pnpm check`, `pnpm verify:live` |
| Persistence, migration, or security boundary | Focused regression tests, `pnpm check`, `pnpm verify:live` |
| Documentation or templates only | Link and syntax checks, `git diff --check` |

Useful focused commands:

```bash
pnpm test -- tests/channel-context.spec.ts
pnpm test -- tests/commonspace.client.spec.tsx
pnpm test:storybook:watch -- Conversation
pnpm test:storybook:smoke
```

## Pull requests

Use the pull request template. Every pull request should make the following clear:

- what problem the change solves;
- how the change fits Commonspace’s product model;
- what changed and where ownership lives;
- the focused and full verification performed;
- manual verification for visible behavior;
- risks, migrations, compatibility concerns, or known follow-up work;
- the model used, including `None, human-authored` when no AI helped.

One pull request should represent one logical change. Keep unrelated cleanup in a separate pull request.

## AI-assisted contributions

AI-assisted contributions are welcome. The contributor remains responsible for understanding the change, checking its product fit, reviewing generated code, and validating the result. AI use must be disclosed in the pull request. Do not paste private workspace data, credentials, native agent session data, or internal links into prompts or public artifacts.

## Security and data

Never commit credentials, CLI session stores, `~/.commonspace`, generated `dist` output, browser artifacts, or local state. Follow [SECURITY.md](SECURITY.md) for vulnerability reports.

## License

By contributing, you agree that your contribution is provided under the repository’s MIT license.
