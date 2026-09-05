# Changelog

Notable changes to Commonspace. See the [versioning policy](docs/releasing.md#choose-the-version) for release numbering.

## [0.0.1] - Unreleased

### Conversations and agents

- Channels, Direct Messages, and Threads keep requests, replies, decisions, and agent handoffs in one conversation record.
- Hermes and Codex connect through the Agent Client Protocol (ACP). Agent discovery selects the installed Codex harness or an existing Hermes profile; runtimes retain their tools, credentials, permissions, and native sessions.
- Conversations resume their exact agent session. `/new` starts a fresh Direct Message session. Independent sessions run concurrently; requests to the same session run in order. Temporary authentication or transport failures preserve session continuity.
- Explicit `@agent` mentions choose responders and support peer handoffs. Unaddressed Channel messages use configured inference to select agents and assign relevant requests. Service-level corrections preserve earlier replies and inform later routing; pending and failed routing remain visible.
- Busy sessions retain follow-ups with reordering, removal, steering where supported, and stop-and-send controls. Replies distinguish completion, input requests, failure, cancellation, timeout, and interruption.

### Projects, context, and review

- Projects reference one or more local folders. Messages and Threads can use several Projects through `@@project` tags or visible inference. Conversations without a Project use a dedicated private working folder.
- Each Thread starts with a Channel-context snapshot and maintains separate shared context. Users can inspect, edit, pin, and summarize context; automatic compaction preserves human edits. Later Project-reference changes preserve earlier deliveries and access boundaries.
- Scoped Model Context Protocol (MCP) tools let agents inspect permitted context and transcripts, post progress, and hand off work in the conversation. New agent turns receive the new request rather than a replay of the full conversation.
- Human-message edits create visible branches with separate session continuity. Deletion preserves a delivery marker while removing message content and associated attachment bytes.
- Project views show files, Git changes, diffs, and emitted verification. Human and agent attachments support previews, downloads, search, and pins; known credential files are rejected, and agent files are copied only from permitted folders.

### Desktop experience

- Inbox, search, unread state, saved sidebar preferences, and conversation URLs help users find replies and return to the exact message or Thread. Channel ordering supports recent activity, name, and custom order.
- Agent replies expose runtime-reported reasoning summaries, plans, tool calls, results, and usage. Native permission requests show the runtime's choices and block only their own session.
- Light, Dark, and System appearance accompany desktop conversation and Project panes. Channel composers preserve unsent attachments while opening or closing Threads.
- Optional desktop notifications cover replies, mentions, permissions, failures, and timeouts. Category and sound controls remain independent of Inbox state; restarts and imports do not replay old alerts.

### Installation and local data

- Runtime archives target macOS ARM64, macOS x64, and Linux x64, with production dependencies, a foreground launcher, SHA-256 checksums, and third-party license notices. Release automation verifies the version, tag, source commit, CI, and archives before creating a draft.
- The macOS background service supports source or archive installation, health checks tied to the managed process, staged updates, recovery after a failed update, and rollback to one retained release. Updates wait for the previous service to unload before replacement.
- The server listens on loopback and guards state changes by origin. Runtime diagnostics explain local readiness, recovery, and configured inference data flow without exposing credentials or host paths. Agents and inference may use remote model services.
- Accepted conversation history persists until explicit user cleanup. State schema 27 migrates older data and uses atomic writes with backup recovery. Model and reasoning defaults apply across the workspace; migration removes legacy Channel overrides while preserving valid older workspace exports.
- Version-1 workspace exports preserve conversation text and exact attachment bytes while omitting Commonspace-managed credentials, paths, session references, and temporary capabilities. Archives are unencrypted private data and may contain sensitive author-supplied content. Import requires an empty workspace and explicit local-folder mappings.
- Retention previews changes for one Channel or Direct Message, checks the current revision, and refuses cleanup during active or queued work or context compaction. Retention never runs automatically.
