# Commonspace UI direction

Status: current direction, 2026-09-03.

This document is the visual contract for the current desktop web application. [Product specification](product-spec.md) remains the behavior contract.

## Reference

The active design contract is local [design.md](design.md).

When changing the shell, collections, conversations, Inbox, Threads, or Project panes, preserve the geometry, spacing, borders, hierarchy, row behavior, and pane composition defined there.

Do not copy the reference file's color settings. Preserve the active Tweakcn/Darkmatter semantic palette in `ui/src/index.css` and Commonspace's user appearance controls.

## Implementation rules

- Target the desktop web application first. Narrow/mobile validation is deferred until desktop parity is accepted.
- Use the existing Tailwind v4, shadcn primitives, and semantic tokens in `ui/src/index.css`.
- Do not add a parallel custom CSS naming layer or invented selectors such as `cs-titlebar-status`.
- Keep visual changes in the UI. Do not create product objects or runtime behavior to explain a visual treatment.

## Appearance

- With no saved preference, Commonspace starts in Light mode.
- The user can choose Light, Dark, or System mode.
- System mode follows the operating-system preference and the selected mode persists locally.
- User-facing copy uses Light, Dark, and System. Darkmatter remains a swappable theme source, not explanatory product copy.

To swap themes, run `pnpm dlx shadcn@latest add "<tweakcn-theme-url>" --cwd ui --yes`. React components and layout must not need theme-specific edits. Stable aliases at the end of `ui/src/index.css` adapt Commonspace-only names such as `surface`, status colors, sidebar depth, radius tiers, control sizing, shadows, and motion to the incoming shadcn variables.

## Conversation focus

- Ordinary messages stay visually flat.
- A deep-linked or active message keeps its highlight card: a quiet surface, border, or ring using semantic neutral tokens.
- The focus treatment has no orange left rail, orange border, or orange tint.
- Opening a reply keeps the exact reply focused in the Thread pane while its Channel root remains the navigational card.
- Resolved routing remains stored at the service boundary for dispatch, reply binding, diagnostics, and future correction work. The conversation currently shows only pending and failed routing state; resolved assignment cards and inline reroute controls are intentionally deferred.

## Verification

Tests should protect user-visible behavior, accessibility semantics, state transitions, and API contracts. They should not assert private `data-*` styling hooks, exact utility-class strings, or computed CSS values.

Use the in-app browser at a desktop viewport for visual proof. Keep screenshot comparisons against the reference focused on layout and component structure; do not turn reference colors into acceptance criteria. Swap-test by changing only the Tweakcn URL and rebuilding.
