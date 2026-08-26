# Commonspace design system

## Direction: visible context

Commonspace should feel like a focused working surface for conversations with agents. Its signature is a small four-point constellation: separate agents connected by shared context.

## Principles

1. **Screen first.** Show the application itself without device frames or presentation chrome.
2. **Dense, not cramped.** Navigation supports scanning; conversations preserve readable rhythm.
3. **Structure before decoration.** Selection, hierarchy, labels, and metadata explain where context lives.
4. **One accent.** Indigo identifies active context and primary actions; status colors remain semantic.
5. **Theme from tokens.** Standalone root variables feed the existing `--csp-*` semantic layer.
6. **No gradients.** Depth comes from borders, restrained shadows, and surface contrast.

## Application shell

The desktop layout uses fixed navigation and a flexible conversation canvas. At narrow widths, navigation becomes a dismissible overlay with an explicit menu control and backdrop. The product remains usable without a desktop wrapper.

## Components

- Projects show canonical filesystem children.
- Channels expose roster count and shared context.
- DMs prioritize agent identity and continuity.
- Messages distinguish user, agent, and system authors without turning every message into a card.
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
