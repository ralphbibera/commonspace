# Contributing

Thanks for helping improve Commonspace.

## Development setup

```bash
pnpm install
pnpm check
```

For a live integration check, link the checkout into the DeepSeek Harness Web profile and restart it:

```bash
pnpm build
dsh plugin --profile web add .
dsh web
```

Then run:

```bash
COMMONSPACE_TEST_URL=http://127.0.0.1:3080 pnpm verify:live
```

The verifier writes ignored artifacts by default. Set `COMMONSPACE_UPDATE_DOCS=1` only when intentionally refreshing `docs/assets/commonspace-panel.png`.

## Pull requests

- Keep changes focused and explain the user-visible behavior.
- Add or update tests before changing behavior.
- Preserve the existing Harness workspace, session, conversation, and context-management surfaces.
- Do not add Hermes or OpenAgents dependencies.
- Do not commit credentials, local profile files, generated bundles, or full-page test artifacts.
- Include screenshots for visible UI changes.
- Run `pnpm check` before requesting review.

## Design principles

- Commonspace should feel native to DeepSeek Harness, not like a second application embedded inside it.
- Prefer additive public slots over replacing core UI.
- Keep navigation readable and keyboard accessible.
- Add persistence only through explicit host-side services with migrations and tests.
