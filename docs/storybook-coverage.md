# Storybook coverage and UI iteration

Run `pnpm storybook` and open `http://localhost:6006`. Use the **Light / Dark** toolbar to inspect the same state in both appearances, including portaled menus, dialogs, and tooltips. Component Controls expose supported variants, sizes, disabled states, and orientation where relevant.

Changing toolbar appearance restarts the current story so its application settings agree with the preview.

## Start with the surface you are changing

| Surface | Storybook location | States to inspect |
| --- | --- | --- |
| Buttons, badges, empty states, toggles | Foundations → Button, Badge, Empty, Toggle, ToggleGroup | Variants, sizes, selected, disabled, pending, and grouped controls |
| Tabs | Foundations → Tabs | Default, line, Project, and vertical layout with keyboard selection |
| Dialogs and confirmations | Foundations → Dialog, AlertDialog | Open, closed, keyboard dismissal, compact confirmation, and long content |
| Menus and tooltips | Foundations → DropdownMenu, Tooltip | Keyboard focus, disabled actions, checked choices, and placement at a viewport edge |
| Workspace content | Shell → Workspace | Loading, connection failure, empty data, refresh with existing data, collections, Project, and conversation |
| URL navigation | Shell → Routing | Inbox, sessions, Channel and Thread links, Project-file links, invalid or stale destinations, and failed bootstrap followed by retry |
| Sidebar sorting | Design System → SidebarSortControl | Compact header trigger, current mode, open menu, and mode selection |
| Follow-up queue and delivery | Design System → RunDelivery | Queued and steered messages, stop-and-send status, long or attachment-only messages, narrow Thread panes, and disabled delivery actions |
| Complete desktop workspace | Screens → Workspace | Inbox, collections, conversations, Project panes, settings, search, permissions, and runtime activity |

The component-specific `Pages`, `Workspace`, and `Design System` stories remain useful for their existing focused states. `Foundations → UI Primitives` remains a quick overview.

## Coverage from the September 6 audit

Every primitive named in the missing-story audit now has a dedicated story file under `ui/src/stories`: Button, Badge, Empty, Toggle, ToggleGroup, Tabs, Dialog, AlertDialog, and DropdownMenu. Tooltip has its own stories as well.

`CommonspaceWorkspace.stories.tsx` renders the real workspace component through its navigation hook and a memory router. `CommonspaceRouter.stories.tsx` uses the real client store, router, and app with a synthetic HTTP boundary. Startup retry therefore exercises the client refresh path, rather than swapping a display-only snapshot. These stories do not start native agents or contact a workspace API.

`main.tsx` only mounts the application and starts loading; it is intentionally covered by the production browser flow instead of a standalone visual story. File-level story presence does not establish complete behavior or visual acceptance.

## Focused verification

```bash
pnpm --filter @commonspace/ui test-storybook --run src/stories/SidebarSortControl.stories.tsx src/stories/RunDelivery.stories.tsx
pnpm --filter @commonspace/ui test-storybook --run src/stories/CommonspaceRouter.stories.tsx src/stories/CommonspaceWorkspace.stories.tsx
```

The sidebar stories also check sorting across pinned and unpinned groups, saved custom order, and keyboard reordering. Conversation stories check that Queue, Steer, and Stop and send submit the intended delivery value. Inspect the assembled runtime screen and narrow Thread queue in both appearances after changing these controls.

For overlays, check actual wheel scrolling and keyboard focus as well as viewport bounds. A long confirmation keeps its actions visible while its explanation scrolls. Follow the [visual verification loop](visual-verification.md); passing interactions and saved screenshots alone do not establish visual acceptance.
