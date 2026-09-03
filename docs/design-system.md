# Commonspace design system

## Direction: Apple workspace structure, Darkmatter palette, Commonspace model

Commonspace should feel like a focused working surface for conversations with agents. Its desktop visual direction follows `/Users/ralphbibera/Downloads/commonspace-apple-workspace.html` for shell geometry, pane composition, borders, spacing, and dense flat rows. Commonspace retains its own product model. Tweakcn/shadcn Darkmatter remains the swappable color source in `ui/src/index.css`.

## Principles

1. **Screen first.** Show the application itself without device frames or presentation chrome.
2. **Dense, not cramped.** Navigation supports scanning; conversations preserve readable rhythm.
3. **Structure before decoration.** Selection, hierarchy, labels, and metadata explain where context lives.
4. **Quiet selection.** Neutral translucent fills identify active context; the constellation accent is reserved for identity, links, and focus.
5. **Theme from tokens.** Standalone root variables feed the existing `--csp-*` semantic layer.
6. **Reference-led composition.** The Apple prototype controls structure; semantic tokens control color. Do not add decorative CSS layers or prototype-only class names.

## Application shell

The desktop layout uses a 260px navigation canvas, a 52px titlebar, and a flexible conversation surface. Main headers are 64px. Collections use bordered 1020px content rails; the Home dashboard uses a 920px rail; Project workbenches use a 330px file rail. Threads split the available desktop surface with an 8px draggable divider and default to an even 50/50 split.

## Components

- Projects show canonical filesystem children.
- Channels expose roster count and shared context.
- DMs prioritize agent identity and continuity.
- Messages distinguish user, agent, and system authors without turning every message into a card.
- Agent activity stays collapsed beneath the reply until requested, then expands into a quiet timeline of harness-emitted reasoning, plans, tool calls, and usage.
- Threads make native execution boundaries inspectable.
- The composer exposes slash commands and references without hiding the active context.
- Deep-linked and active messages keep a quiet neutral highlight card without an orange rail or tint.
- Light is the default appearance; Light, Dark, and System are selectable and persisted.
- Any Tweakcn theme can replace the current palette through the shadcn CLI without React/layout edits.

## Accessibility

- Every icon-only control has an accessible name.
- Selection uses semantic state in addition to color.
- Keyboard focus uses a visible accent ring.
- Pickers and suggestions use listbox/option semantics.
- Errors and command outcomes use alert or status roles.
- Motion is minimized under `prefers-reduced-motion`.
- Desktop flows are the acceptance target for this visual slice. Narrow/mobile validation is deferred until desktop parity is accepted.
