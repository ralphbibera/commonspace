# Commonspace design system

## Direction: a shared field

Commonspace should feel like a focused native DSH surface, not a miniature Slack clone or a second application. Its signature is a small four-point constellation: separate agents connected by shared context. The mark appears in the mode switch, product header, and empty state; it is never used as a decorative backdrop.

## Visual principles

1. **Screen first.** Use the real application surface—no device frames or presentation chrome.
2. **Dense, not cramped.** The sidebar supports fast scanning; the conversation gives messages breathing room.
3. **Structure before decoration.** Selection bars, tree lines, labels, and metadata explain hierarchy.
4. **One accent.** Indigo identifies Commonspace actions and active context. Jade, amber, red, and terracotta are reserved for status/adapter semantics.
5. **Native inheritance.** DSH semantic tokens are authoritative. Commonspace fallbacks exist only when the host omits a token.
6. **No gradients.** Depth comes from borders, restrained shadows, and surface contrast.

## Semantic tokens

`src/client/polish.ts` defines the Commonspace layer:

- `--csp-fg`, `--csp-muted`, `--csp-subtle`
- `--csp-canvas`, `--csp-surface`, `--csp-raised`
- `--csp-border`, `--csp-border-soft`, `--csp-hover`
- `--csp-accent`, `--csp-accent-soft`, `--csp-accent-line`
- `--csp-success`, `--csp-warning`, `--csp-danger`, `--csp-claude`
- `--csp-radius-sm`, `--csp-radius-md`, `--csp-radius-lg`
- `--csp-shadow-raised`

New components must consume these tokens instead of adding isolated colors or radii. Prefer `color-mix()` from an existing semantic token for subtle fills.

## Component language

### Sidebar

- Product header: constellation, wordmark, private/local status, compact utility actions.
- Section labels: small uppercase labels with quiet count pills.
- Selected rows: soft accent fill plus a two-pixel accent edge.
- Projects: folder glyph and a tree line for canonical workspace children.
- Channels: bounded `#` tile and visible roster count.
- Agents: initial avatar, adapter color, presence dot, adapter badge, model, and status.
- Forms: raised local panels; labels and full-width controls remain legible at narrow widths.

### Conversation

- Header kicker communicates FIELD, CHANNEL, or DIRECT.
- Content aligns to a readable maximum width while the canvas still fills the host slot.
- User and agent avatars use different semantic treatments.
- Thread roots are inspectable units with status and reply count.
- Composer is a raised working surface with command/reference affordances in its footer.
- Local command results are visibly distinct from agent messages.

### Empty state

The empty state explains the product model rather than merely saying “select something”:

`Project → Channel → Thread`

Its constellation and three-step line are the most expressive visual moment in the product. Keep the surrounding canvas quiet.

## Accessibility

- Every icon-only control requires an `aria-label`.
- Selection uses `aria-pressed` or `aria-selected`; color is not the sole indicator.
- Focus-visible uses a two-pixel accent ring.
- Composer and picker suggestion lists use listbox/option semantics.
- Error and command outcomes use alert/status roles.
- Text and controls must remain usable at 320px width.
- Motion is minimal and disabled under `prefers-reduced-motion`.

## Responsive behavior

At narrow conversation widths, the thread panel becomes an in-place overlay and the header mode pill can disappear. The sidebar remains a compact information surface; metadata may truncate, but names, status dots, and primary actions must remain visible.

## Avoid

- Generic dashboard cards around every section.
- Decorative gradients, glows, or background illustrations.
- Phone/device frames.
- Emoji as primary navigation icons.
- Hard-coded white surfaces that break host dark themes.
- Status conveyed only through tiny low-contrast text.
- Introducing a new color when an existing semantic token communicates the same meaning.
