# Commonspace contributor contract

Commonspace is a standalone, local-first agent conversation workspace.

## Product scope

The product owns Projects, Channels, Direct Messages, Agents, Messages, threads, native agent-session continuity, and visible context handoffs. Conversation is the primary work record. Do not add a parallel ticket, issue, goal, company, org-chart, approval, or work-queue domain unless Ralph explicitly changes the product direction.

Commonspace may reuse proven infrastructure patterns, but it must not inherit another product's feature model.

## Architecture boundaries

- `packages/shared` is the single writer for cross-process contracts and pure shared helpers.
- `server` owns the Express API, local persistence, validation, routing, concurrency, and subprocess lifecycle.
- `ui` owns the Vite/React application and may communicate with the server only through shared contracts and `/api`.
- Hermes and Codex own their credentials and native session stores.
- Commonspace must not depend on DeepSeek Harness, Cordis, OpenAgents, Hermes Kanban, or another hidden agent runtime.

## Engineering rules

- Preserve hard `/new` context boundaries and exact native-session resumption.
- Treat Channels as non-blocking agent-to-agent rooms: persist messages immediately, wake addressed agents, and route bounded peer mentions without adding task-state gates.
- Different agents may act concurrently, including in the same Project. Serialize only calls that target the same native agent session.
- Treat session references and filesystem paths as host-private data.
- Invoke CLIs with argument arrays and piped input; never construct shell command strings.
- Bind the server to loopback and keep same-origin mutation guards.
- Make persisted-state changes versioned, sanitized, atomic, and migration-tested.
- Add a failing focused test before behavior changes, then run `pnpm check` and `pnpm verify:live` before completion.
- Keep changes scoped. Do not commit credentials, generated builds, local state, or browser artifacts.
