# Changelog

Notable changes to Commonspace are recorded here. Changes under **Unreleased** have not been assigned a published release.

## [Unreleased]

### Fixed

- Opening or closing a Thread preserves unsent attachments in its Channel composer.
- The unread marker and its Mark read control fit within a split conversation pane.
- Installed-service readiness verifies that the LaunchAgent process owns the loopback listener before accepting its health response. Another Commonspace process can no longer mask a failed installation or update.
- Service updates wait for macOS to unload the previous job before activating its replacement.
- Release archives retain third-party dependency license and copyright notices alongside the application.

### Added

#### Installation and releases

- Runtime archives for macOS ARM64, macOS x64, and Linux x64. Each archive includes the built UI, server, production dependencies, a foreground launcher, and a SHA-256 checksum.
- macOS service installation and updates from an extracted archive, without a source checkout or pnpm build.
- A macOS background service with health checks, staged updates, automatic recovery after a failed update, and one previous release for rollback.
- Release automation that checks the version, tag, source commit, CI results, and platform archives before creating a draft. Publishing remains a separate manual step.
- Scheduled dependency-update pull requests for workspace packages and GitHub Actions.

#### Conversations and shared context

- Channels where agents can mention and invoke one another without blocking unrelated conversations.
- Queued follow-ups, steering, queue reordering and removal, and stop-and-send controls. Each run records whether it completed, failed, stopped, or needs attention.
- Automatic routing for unaddressed Channel messages through a configured agent runtime or OpenAI-compatible model. Each chosen agent receives its own request and relevant projects.
- Saved routing decisions and timing, measured separately from agent execution. Failed routing appears in Inbox so the user can return to the affected conversation.
- Inferred project context for new Channel conversations. Visible `@@project` tags provide explicit context; the UI does not add a hidden default project.
- A service/API correction path for rerouting one agent's request while keeping unrelated requests, project scope, and earlier replies intact. Corrections inform later routing decisions.
- A snapshot of Channel context when each Thread begins, plus separate Thread context that users can inspect, edit, and compact. Automatic compaction responds to context size and preserves user edits.
- Project context that can change for later Thread replies without changing earlier deliveries. `@@project` tags set explicit context for a new turn and subsequent defaults.
- Pins for messages, files, and notes at Channel and Thread level, including a record of removed pins.
- Message editing through visible branches that preserve the original version and its replies. New branches use separate agent-session continuity.
- Deletion markers that preserve the fact of delivery while removing the message body, attachment bytes, and derived context.
- A Channel context editor with status, manual compaction, and note-pin controls.

#### Agents, files, and permissions

- Hermes and Codex integration through the Agent Client Protocol (ACP). New turns send only the new request, resume the correct agent session, and respect reset and cancellation boundaries.
- Expandable activity records for the reasoning summaries, plans, tool calls, results, and usage reported by an agent.
- Commonspace tools through the Model Context Protocol (MCP) for reading permitted context, paging through transcripts, and posting visible progress.
- Workspace display names, emoji avatars, and colors for agents, without changing their installed runtime identity or profile.
- Native permission requests with the choices supplied by the agent runtime. A request blocks only its own session and remains visible in the conversation and Inbox; interrupted requests recover honestly after shutdown.
- File attachments from humans, with safe downloads, search, pinning, and links to the exact message version. Known credential files are rejected.
- Agent-created file attachments copied only from permitted working folders into Commonspace storage.
- A private, dedicated working folder for conversations without a project.
- Runtime diagnostics covering storage, agent availability, recovery steps, and whether configured inference sends data to a remote endpoint. Diagnostics keep credentials and private paths out of browser responses.

#### Navigation and appearance

- Shareable workspace URLs for directories, Projects, Channels, Direct Messages, Threads, and messages, including browser back/forward navigation and older notification links.
- Channel sorting by recent activity, name, or a saved custom order. Custom order supports dragging and Alt+ArrowUp/ArrowDown within pinned and unpinned groups.
- Inbox entries for actual agent replies, with unread filtering, exact Thread navigation, and persistent read position.
- Saved sidebar pins, recent items, collapsed sections, and manual unread state.
- Project files, Git changes and diffs, image previews, live activity, and stop controls.
- Support for several projects in one message or Thread, including multiple working folders, project-aware search, and file-change attribution.
- Consistent desktop navigation, pane geometry, spacing, borders, conversation layouts, and project views.
- Light, Dark, and System appearance settings, with Light as the default. Message focus uses a neutral highlight.
- Optional desktop notifications for replies, mentions, permissions, failures, and timeouts. Category and sound controls are independent, and each notification opens the relevant conversation. Restarting or importing a workspace does not replay old notifications.

#### Data and development

- A documented version-1 workspace export format with validated import, explicit local-folder mapping, and exact attachment restoration. Exports omit managed secrets and private runtime identifiers; user-authored content and attachments remain private data.
- A preview of retention changes before deleting a Channel or DM. Applying cleanup checks the current revision and refuses active or queued work and context compaction.
- Browser-safe project folder labels, with actual filesystem roots kept on the server.
- An Express API bound to loopback, with same-origin protections for state changes.
- A pnpm workspace separating shared contracts, server behavior, and the React/Vite UI.
- API, health, build, and browser verification, including keyboard navigation, search, and light/dark appearance in preview and installed serving modes.
- Reliable detection of preview URLs when terminal output contains ANSI formatting.
- Product requirements and acceptance scenarios, plus installation, contributor, maintainer, security, and release guides.

### Changed

- Model and reasoning defaults now apply across the workspace. State format 27 removes Channel overrides; valid older workspace-data exports remain importable without changing their workspace defaults or conversation data.
- Accepted messages survive appends and restarts without the former 500-message limit.
- Thread replies inherit projects only when the request omits project fields. Conflicting legacy fields are rejected, and removed projects or missing folders no longer leave stale file-change attribution.
- New Channel threads pass their selected projects into routing. Queued and running replies cannot retain obsolete project access after configuration changes.
- Context refresh and compaction handle concurrent changes without overwriting user edits. Independent inference runs use separate native sessions.
- Agent discovery runs only when the user opens the Add Agent flow. New Channels do not preselect agents.
- State format 24 added native-notification preferences and migrations from formats 1–23. The recovery path preserves older Thread context and restores an invalid primary state file from a valid backup.
- Channel and Thread context record visible `compacting` and `failed` states while keeping the last valid content.
- Routing uses the visible maximum-agent setting instead of a hidden two-agent limit.
- Different agents and sessions can run concurrently. Requests to the same native session remain serialized.
- Every supported agent turn uses ACP. A missing native session gets one recovery attempt; authentication and transport failures do not silently discard session continuity.
- Saved agent activity removes private host paths, native session identifiers, and MCP credentials before reaching the browser.
- Commonspace's product model centers on conversations, projects, agents, and shared context.
- Source preview serves browser assets through Vite. Installed builds serve the UI and API from one loopback address.
- Documentation now starts with the reader's task, explains required terms, and groups guides by audience. Design requirements describe Commonspace directly and do not depend on comparison material or private reference files.

### Removed

- Resolved routing destinations, assignment details, latency, and inline reroute controls from conversation messages. Pending and failed routing remain visible.
- Managed/custom agent creation, profile import, and application-defined agent personas. A new agent now represents an explicitly selected supported installation.
- Runtime-specific configuration inspection, mutation, and the native-configuration dashboard. Workspace appearance remains editable; runtime controls require advertised ACP capabilities.
- Extra delivery wrappers and repeated conversation history in agent requests.
- The plugin lifecycle, UI slot mounting, bundle manifests, and related framework-specific build dependencies.
