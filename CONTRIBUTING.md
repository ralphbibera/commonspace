# Contributing

## Setup

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm verify:live
```

Use `pnpm dev` for the server and Vite UI. The UI runs on port `5173`; the API runs on port `3100`.

## Change workflow

1. Add a focused failing test.
2. Implement the smallest production change.
3. Run the focused test.
4. Run `pnpm check`.
5. Run `pnpm verify:live` for server, API, or visible UI work.
6. Review `git diff --check` and the complete diff.

Keep changes inside the conversation-first product model. Shared contracts belong in `packages/shared`, adapter mechanics in `packages/adapters`, host behavior in `server`, and presentation in `ui`.

Never commit credentials, CLI session stores, `~/.commonspace`, generated `dist` output, or browser artifacts.
