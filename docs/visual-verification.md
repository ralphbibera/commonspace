# Commonspace visual verification loop

## Purpose

`pnpm verify:live` is the behavioral and evidence-capture half of the UI verification loop. It is not, by itself, proof that the interface looks good.

The loop is deliberately split into three gates:

1. **Journey gate** — a real Playwright browser reaches the intended user-visible states.
2. **Mechanics gate** — each state is checked for broken interaction mechanics such as missing focus, clipping, overflow, bad overlay placement, or failed transitions.
3. **Visual gate** — the actual pixels are reviewed against the Commonspace visual contract and reference. A screenshot path, DOM snapshot, or green behavior test is not a visual review.

A run is not visually accepted until all three gates have evidence.

## What the live verifier captures

The live verifier starts disposable production server/UI processes and uses a desktop viewport of `1180 × 820`. It records an evidence packet under:

```text
artifacts/experience-audit/<run>/
```

The packet contains:

- `audit.json` — ordered state/action manifest and gate status;
- one PNG for each before/after interaction state;
- one JSON file per state with the screenshot path, ARIA snapshot, focus target, overlay bounds, viewport dimensions, overflow observations, and hovered element;
- `trace.zip` — Playwright screenshots, DOM snapshots, and action trace;
- a failure state and screenshot when a journey cannot reach its expected state.

The verifier currently exercises the global search hover/focus/open/query/keyboard states, channel action-menu hover/open/Escape, channel navigation, composer focus and project suggestions, workspace settings open/close, Light/Dark transitions, and the installed-server mount.

## Storybook visual lab

Storybook is the component-state and agent-context layer. It lives under `ui/.storybook`, uses the production token CSS, exposes the Components Manifest, and serves the Storybook MCP endpoint at `http://localhost:6006/mcp` while the dev server is running.

Use these commands from the repository root:

```bash
pnpm storybook
pnpm test:storybook
pnpm build-storybook
pnpm exec playwright test --config playwright.visual.config.ts
```

The stories under `ui/src/stories` are canonical states across the Commonspace shell and page surfaces (`CommonspaceApp`, Conversation, Directory, Inbox, Threads, Project panes, Sidebar, Topbar, and settings), the owned design-system components, trace/markdown/evidence renderers, and the shared UI primitives. They use local fixture stores and fetchers, so Storybook does not depend on the running Commonspace API. Storybook `play` functions exercise local interaction and accessibility behavior in a real Chromium browser. `tests/storybook-visual.spec.ts` captures the reviewed story canvases with Playwright and compares them to the approved PNG baselines under `tests/storybook-visual.spec.ts-snapshots`.

Do not run `--update-snapshots` as a normal verification step. Updating a PNG is a design decision: inspect the rendered pixels first, record any finding, then update only the affected baseline after the state is accepted.

The Storybook MCP is project context for agents, not a visual approval signal. It exposes the current stories, component APIs, docs, and test feedback; the visual gate still requires actual pixel review.

## Visual review protocol

Review states in action order, one state at a time:

1. Run `pnpm verify:live` and record the emitted `experienceAudit.artifactDir`.
2. Read `audit.json` to get the state order and each exact PNG path.
3. For every meaningful **after** state, inspect the actual PNG immediately with the configured vision-capable review path. Do not collect a large batch and rely on context memory; older images may be evicted.
4. For hover/focus/open/selected states, compare the before and after state while the action intent is still in context.
5. Compare against `docs/design.md`, `docs/ui-direction.md`, and the approved reference composition. Do not turn reference colors into acceptance criteria when the semantic palette is intentionally swappable.
6. Write a structured verdict containing the state id, action, exact region, expected treatment, observed treatment, severity, and evidence path.
7. Mark the visual gate `passed` only when there are no unresolved must-fix findings and every required state was actually seen. If pixels were unavailable, mark the gate `unavailable`, never `passed`.

A useful visual finding is specific:

```json
{
  "state": "search-open-after",
  "action": "click global search",
  "region": "type-filter row",
  "severity": "must-fix",
  "expected": "one coherent, scannable filter group with an obvious selected state",
  "observed": "a filter wrapped onto an orphan second line and the controls read as unstyled text",
  "evidence": "artifacts/experience-audit/<run>/030-search-open-after.png"
}
```

Do not write findings such as `looks bad`, `polish needed`, or `snapshot changed` without a region and observable reason.

## Mechanics checks that belong in code

The deterministic verifier should continue to check:

- the intended control is selected with an exact accessible name;
- a click/keyboard action reaches the expected next state;
- menus, dialogs, listboxes, and suggestions appear and disappear;
- focus remains visible and moves to the intended target;
- overlays remain inside the viewport and are anchored to the triggering control;
- document and key containers do not gain unexpected horizontal overflow;
- visible text is not clipped by its own bounded container;
- hover affordances actually appear before their control is clicked;
- theme changes alter the rendered palette and restore correctly;
- page errors, console errors, and failed requests remain empty.

These checks protect mechanics. They do not replace the visual gate.

## State matrix

A complete acceptance run should eventually cover each critical surface in these states:

| Surface | Rest | Hover | Focus/keyboard | Open/selected | Empty/dense/error |
| --- | --- | --- | --- | --- | --- |
| Workspace shell/sidebar | yes | yes | yes | yes | yes |
| Inbox | yes | yes | yes | yes | yes |
| Channels and DMs | yes | yes | yes | yes | yes |
| Composer and slash/reference suggestions | yes | yes | yes | yes | yes |
| Search | yes | yes | yes | yes | yes |
| Threads | yes | yes | yes | yes | yes |
| Projects/files/diffs | yes | yes | yes | yes | yes |
| Settings and confirmations | yes | yes | yes | yes | yes |
| Agent activity, permissions, attachments | yes | yes | yes | yes | yes |

The current live verifier is the first slice of this matrix, not the finished matrix. Missing rows are explicit coverage gaps, not implicit passes.

## Iteration loop

For each visual finding:

1. keep the evidence packet and finding;
2. change the smallest owning UI artifact;
3. rerun the focused journey;
4. inspect the changed state and its adjacent before/after states again;
5. rerun `pnpm verify:live` and the full checks before accepting.

Never update a golden image solely because the implementation changed. A baseline that already looks wrong is not a quality standard.
