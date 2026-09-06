# Commonspace UI direction

Commonspace's desktop UI should keep conversations, context, and agent responses easy to follow. This guide applies the [design contract](design.md) to the main product surfaces. Use the [Product specification](product-spec.md) for behavior and the [Design system](design-system.md) for component and token ownership.

## Shell and navigation

The shell uses a 52px title bar, a 260px navigation rail, a flexible working area, 64px pane headers, and 8px pane dividers. Preserve consistent spacing, borders, and alignment across collections and conversations.

The URL selects the destination when the app opens. `/` opens Inbox; unknown or stale detail routes return there. Workspace branding does not navigate, and returning from a Project pane goes to Inbox.

Inbox and each owning conversation or Thread show runtime outcomes. Keep this model intact: the current product has no separate Workspace landing page or Agent-runs dashboard.

## Collections and context

Projects, Channels, Agents, Inbox, and Threads use clear titles, compact rows, and visible selection. Show the metadata that helps users decide where to go next. Keep secondary controls quiet but discoverable.

The Channel list offers recent-activity, alphabetical, and custom sorting. Returning to Custom restores the saved order. Users can drag Channels or focus a Channel row and press Alt+ArrowUp or Alt+ArrowDown to move it within its pinned or unpinned group. Keep the shortcut hint visible in Custom mode and preserve focus after a move.

Project files and Git changes provide context for conversation. Channel and Thread context should be inspectable without exposing native session identifiers or absolute host paths. Use visible `@@project` references in composers; do not introduce separate Project-scope pickers for roots, Threads, branches, or reroutes.

## Conversations

Ordinary messages stay flat. Highlight an active or deep-linked message with a neutral surface, border, or ring. Keep its highlight card; do not use an orange left rail, border, or tint.

Opening a reply focuses the exact reply in its Thread pane. Its Channel root remains the navigation anchor. Keep agent activity collapsed until requested so that it does not interrupt the readable conversation.

Pending routing and failures remain visible. Resolved routing metadata supports dispatch, reply binding, diagnostics, and correction history at the service boundary; resolved assignment cards and inline reroute controls are outside the current conversation UI.

Queued follow-ups sit in a compact tray aligned with the composer. Keep message previews and delivery status distinct, allow long previews to expand, and bound the tray so the composer remains usable. Reorder and removal actions use consistently sized icons with tooltips. Queue remains a labeled action; Steer and Stop and send use named icon controls beside it.

Before workspace data arrives, show an explicit loading state. An initial connection failure shows its error and a Try again action. Refreshing an already loaded workspace preserves its content, with refresh errors shown in an actionable notice.

## Appearance

The default appearance is Light. Users can choose Light, Dark, or System, and the choice persists locally. System follows the operating-system preference.

Colors come from semantic tokens in [`ui/src/index.css`](../ui/src/index.css). A palette change must not require theme-specific React components or alter the layout. Product copy uses the appearance labels above and does not explain the underlying theme implementation.

## Implementation rules

Use Tailwind CSS v4, the existing shadcn primitives, and Commonspace's shared components. Keep styles close to the component that owns them. Avoid a second custom selector or token system.

Keep visual changes within the UI unless the requested behavior requires a shared or server change. A new visual treatment does not justify a new product object or runtime capability.

Desktop is the supported design target. Mobile design and validation require a separate product decision.

## Verification

Tests protect user-visible behavior, accessibility, state transitions, and API contracts. Avoid assertions against private styling hooks, exact utility-class strings, or CSS implementation details.

Review the actual desktop rendering against [design.md](design.md), including relevant before-and-after interaction states. Check Light and Dark appearance, focus, overflow, and overlay placement. Use the [visual verification loop](visual-verification.md) to distinguish automated evidence from visual acceptance.
