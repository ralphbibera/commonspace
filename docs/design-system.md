# Commonspace design system

## Direction: Buzz's shell, Commonspace's model

Commonspace should feel like a focused working surface for conversations with agents. Its desktop visual direction deliberately adapts [Buzz](https://github.com/block/buzz): a tinted navigation canvas, inset conversation surface, dense flat rows, and chat-first composer. Commonspace retains its own constellation mark and product model.

## Principles

1. **Screen first.** Show the application itself without device frames or presentation chrome.
2. **Dense, not cramped.** Navigation supports scanning; conversations preserve readable rhythm.
3. **Structure before decoration.** Selection, hierarchy, labels, and metadata explain where context lives.
4. **Quiet selection.** Neutral translucent fills identify active context; the constellation accent is reserved for identity, links, and focus.
5. **Theme from tokens.** Standalone root variables feed the existing `--csp-*` semantic layer.
6. **One structural gradient.** Buzz's yellow-to-blue wash belongs to the outer shell and navigation only; conversation surfaces stay flat.

## Application shell

The desktop layout uses a 256px navigation canvas and a flexible, inset conversation surface with rounded corners. A compact decorative desktop chrome completes the shell. At narrow widths, navigation becomes a dismissible overlay with an explicit menu control and backdrop. The product remains usable without a desktop wrapper.

## Components

- Projects show canonical filesystem children.
- Channels expose roster count and shared context.
- DMs prioritize agent identity and continuity.
- Messages distinguish user, agent, and system authors without turning every message into a card.
- Agent activity stays collapsed beneath the reply until requested, then expands into a quiet timeline of harness-emitted reasoning, plans, tool calls, and usage.
- Threads make native execution boundaries inspectable.
- The composer exposes slash commands and references without hiding the active context.

## Accessibility

- Every icon-only control has an accessible name.
- Selection uses semantic state in addition to color.
- Keyboard focus uses a visible accent ring.
- Pickers and suggestions use listbox/option semantics.
- Errors and command outcomes use alert or status roles.
- Motion is minimized under `prefers-reduced-motion`.
- All primary flows must remain usable at 320px width.
