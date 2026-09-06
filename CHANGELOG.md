# Changelog

Notable changes to Commonspace. See the [versioning policy](docs/releasing.md#choose-the-version) for release numbering.

## [0.0.1] - Unreleased

### Conversations and agents

- Channels, Direct Messages, and Threads keep requests, replies, decisions, and agent handoffs in one conversation record.
- Codex, Claude Code, Gemini CLI, OpenCode, and Hermes connect through the Agent Client Protocol (ACP). Agent discovery selects a compatible installed harness or an existing Hermes profile; runtimes retain their tools, credentials, permissions, and native sessions.
- A typed adapter registry and [authoring guide](docs/agent-adapters.md) separate native discovery, launch, and settings from the shared ACP lifecycle. Claude Code adds native-session resumption, activity, permissions, and scoped context through its bundled bridge.
- Claude Code, Gemini CLI, and OpenCode integration tests exercise real runtimes without provider credentials, using local model API fixtures. Graceful ACP shutdown preserves native-child cleanup before forced termination.
- Gemini CLI uses native ACP with a compatibility check for stable `>=0.39.1` and `<0.44.0` (tested 0.43.0); later tested versions regress session resume. OpenCode uses native ACP (tested 1.18.29). Both retain native configuration and credentials.
- Changing effective Full access cancels active work and pending permissions, refreshes native processes, and preserves saved session references. Queued requests use current permissions. Stop during ACP setup cannot dispatch a later prompt.
- Conversations resume their exact agent session. `/new` starts a fresh Direct Message session. Independent sessions run concurrently; requests to the same session run in order. Temporary authentication or transport failures preserve session continuity.
- Explicit `@agent` mentions choose responders and support peer handoffs. Unaddressed Channel messages use configured inference to select agents and assign relevant requests. Service-level corrections preserve earlier replies and inform later routing; pending and failed routing remain visible.
- Busy sessions retain follow-ups with reordering, removal, steering where supported, and stop-and-send controls. Replies distinguish completion, input requests, failure, cancellation, timeout, and interruption.

### Projects, context, and review

- Projects reference one or more local folders. Messages and Threads can use several Projects through `@@project` tags or visible inference. Conversations without a Project use a dedicated private working folder.
- Each Thread starts with a Channel-context snapshot and maintains separate shared context. Users can inspect, edit, pin, and summarize context; automatic compaction preserves human edits. Later Project-reference changes preserve earlier deliveries and access boundaries.
- Scoped Model Context Protocol (MCP) tools let agents inspect permitted context and transcripts, post progress, and hand off work in the conversation. New agent turns receive the new request rather than a replay of the full conversation.
- Human-message edits create visible branches with separate session continuity. Deletion preserves a delivery marker while removing message content and associated attachment bytes.
- Project views show files, Git changes, diffs, and emitted verification. Human and agent attachments support previews, downloads, search, and pins; Agent artifacts validate source, resolved, and display filenames before reading bytes, use a bounded same-file descriptor copy, and reject symlink replacement, growth, credential disguises, or permitted-root escapes.

### Desktop experience

- Search scrolls only its results, keeps keyboard selection visible, and replaces the crowded type strip with checked Type/Project menus, removable filters, and a reset action. Request tracking handles normalized queries and prevents stale results from remaining actionable while filters load.
- DM and Thread follow-up trays gain expandable previews, readable delivery status, aligned reorder/removal icons, and compact Queue/Steer/Stop and send controls.
- Workspace startup distinguishes loading from an empty Inbox and offers retry after a connection failure. Long dialogs scroll, confirmation actions remain reachable, and vertical tabs and toggle groups use the requested keyboard orientation.
- Dedicated Storybook primitive, workspace, routing, sorting, and follow-up stories support local UI iteration with a Light/Dark toolbar. See the [coverage map](docs/storybook-coverage.md).
- Inbox, search, unread state, saved sidebar preferences, and conversation URLs help users find replies and return to the exact message or Thread. Channel ordering supports recent activity, name, and custom order.
- Agent replies expose runtime-reported reasoning summaries, plans, tool calls, results, and usage. Native permission requests show the runtime's choices and block only their own session.
- Light, Dark, and System appearance accompany desktop conversation and Project panes. Channel composers preserve unsent attachments while opening or closing Threads.
- Optional desktop notifications cover replies, mentions, permissions, failures, and timeouts. Category and sound controls remain independent of Inbox state; restarts and imports do not replay old alerts.

### Installation and local data

- One npm package ships the Commonspace CLI/server bundle and built UI while npm installs external runtime dependencies. Release automation verifies an exact tag through a clean package installation before npm publication and creates a notes-only GitHub Release.
- The macOS background service supports source installation, health checks tied to the managed process, staged updates, recovery after a failed update, and rollback to one retained release. Updates wait for the previous service to unload before replacement.
- The server listens on loopback and guards state changes by origin. Runtime diagnostics explain local readiness, recovery, and configured inference data flow without exposing credentials or host paths. Agents and inference may use remote model services.
- Accepted conversation history persists until explicit user cleanup. State schema 27 migrates older data and uses atomic writes with backup recovery. Model and reasoning defaults apply across the workspace; migration removes legacy Channel overrides while preserving valid older workspace exports.
- Version-1 workspace exports preserve conversation text and exact attachment bytes while omitting Commonspace-managed credentials, paths, session references, and temporary capabilities. Archives are unencrypted private data and may contain sensitive author-supplied content. Import requires an empty workspace and explicit local-folder mappings.
- Retention previews changes for one Channel or Direct Message, checks the current revision, and refuses cleanup during active or queued work or context compaction. Retention never runs automatically.
