# Commonspace feature-parity research

Researched 2026-08-27 against the current working tree and official Slack, ClickUp, and Visual Studio Code documentation.

## Executive conclusion

Commonspace already has the right **agent-collaboration spine**: local filesystem Projects, Channels, one-to-one agent DMs, threaded native sessions, explicit agent routing, exact session resumption, bounded cross-agent handoffs, per-channel context, and durable agent activity traces.

The largest gaps are not another task model. They are the trust and navigation surfaces that let a person understand what agents discussed and changed:

1. **Files and changes:** repository browsing, changed-file inventory, and readable diffs.
2. **Live control:** stop, steer, queue, and visible in-progress activity.
3. **Attention:** unified search, unread state, mentions/activity inbox, and deep links.
4. **Message quality:** rich composer behavior, consistent Markdown for all authors, attachments, previews, and message actions.
5. **Durable context:** lightweight project/channel briefs, pinned decisions, and import/export.

ClickUp's task hierarchy, assignees, statuses, dashboards, and approval/work-queue model should remain comparator context, not parity targets. Commonspace's product contract says conversation is the work record and explicitly excludes a parallel task domain.

## Status legend

- **Implemented:** present in the current working tree and backed by code/tests.
- **Partial:** useful implementation exists, but important baseline behavior is missing.
- **Missing:** no user-facing implementation found.
- **Intentional non-goal:** conflicts with the current product model or single-owner/local-first boundary.

## Current Commonspace inventory

| Capability                          | Status               | Current nuance                                                                                                                                                                                                                                                                                                                                                | Evidence                                                                             |
| ----------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Local Projects                      | Implemented          | A Project has one working directory plus additional canonical reference paths.                                                                                                                                                                                                                                                                                | `packages/shared/src/contracts.ts:42`, `docs/product.md:18`                          |
| Channels                            | Implemented          | Project-scoped or unbound shared rooms with explicit agent rosters, instructions, model/reasoning settings, and projected memory.                                                                                                                                                                                                                             | `packages/shared/src/contracts.ts:112`, `ui/src/CommonspaceSidebar.tsx:671`          |
| Agent DMs                           | Implemented          | Persistent one-to-one human/agent conversations with searchable agent picker. `/new` rotates the native session while preserving a visible transcript boundary.                                                                                                                                                                                               | `docs/product.md:26`, `tests/direct-messages.client.spec.tsx:59`                     |
| Group DMs                           | Missing              | The DM contract addresses one agent ID only. Multi-agent work belongs in Channels today.                                                                                                                                                                                                                                                                      | `packages/shared/src/contracts.ts:123`                                               |
| Threads                             | Implemented          | Each Channel root is a bounded unit of work with one exact native session; replies resume it. Active agents and queued/running/error state are visible.                                                                                                                                                                                                       | `ui/src/CommonspaceConversation.tsx:173`, `tests/thread-composer.client.spec.tsx:91` |
| Mentions and routing                | Implemented          | `@agent`, `@@project`, and `#channel` autocomplete exists. Valid agent mentions target an agent; unmentioned Channel messages route to the roster within a configured limit.                                                                                                                                                                                  | `ui/src/tagging.ts:18`, `docs/product.md:22`                                         |
| Cross-agent handoff                 | Implemented          | Agent-authored mentions can wake peers with bounded, newly delivered context instead of replaying hidden history.                                                                                                                                                                                                                                             | `docs/architecture.md:45`                                                            |
| Exact agent continuity              | Implemented          | Native opaque sessions are resumed exactly; `/new` creates a hard context boundary; same-session calls serialize while unrelated agents can run concurrently.                                                                                                                                                                                                 | `docs/architecture.md:41`, `docs/architecture.md:45`                                 |
| Agent reply Markdown                | Partial              | Agent messages use Streamdown in static mode. Headings, emphasis, inline code, lists, tables, and links render. Code/table copy controls are enabled. External images are withheld until explicitly opened, preventing passive URL loads. User messages remain plain text. There is no rich composer or send-time preview.                                    | `ui/src/MessageMarkdown.tsx:4`, `tests/message-markdown.client.spec.tsx:64`          |
| Agent activity/trace                | Partial              | Completed replies can expose sanitized harness reasoning summaries, plans, tool calls/results, duration, usage, and cost. Live streaming and user-facing stop controls are still roadmap items.                                                                                                                                                               | `ui/src/AgentTrace.tsx:36`, `docs/roadmap.md:18`                                     |
| Search                              | Partial              | `⌘K` opens accessible search across Channel names, instructions, authors, and Channel-message text. Terms use case-insensitive AND substring matching; message results are newest-first and capped at 24. It can open the matching Channel/thread. It does not search DMs, Projects, Agents, files, traces, or projected memory and has no filters/modifiers. | `ui/src/CommonspaceSidebar.tsx:158`, `ui/src/CommonspaceSidebar.tsx:206`             |
| Slash commands                      | Implemented          | `/help`, `/new`, `/retry`, `/status`, and `/agents` run locally and are never forwarded as prompts. Unknown commands are blocked.                                                                                                                                                                                                                             | `ui/src/slash-commands.ts:17`, `ui/src/CommonspaceConversation.tsx:235`              |
| Files                               | Missing              | Project and folder surfaces exist, but repository browsing is explicitly disabled.                                                                                                                                                                                                                                                                            | `ui/src/CommonspaceProjectView.tsx:44`, `ui/src/CommonspaceSidebar.tsx:628`          |
| Git changes and diffs               | Missing              | The Project “Changes” tab and Git tracking affordance are disabled pending Git read support.                                                                                                                                                                                                                                                                  | `ui/src/CommonspaceProjectView.tsx:48`, `ui/src/CommonspaceSidebar.tsx:636`          |
| Attachments and previews            | Missing              | Messages have text only. No upload, repository-file card, attachment list, or inline preview contract exists. Markdown images intentionally become safe placeholders.                                                                                                                                                                                         | `packages/shared/src/contracts.ts:127`, `ui/src/MessageMarkdown.tsx:19`              |
| Unread/notifications/activity inbox | Missing              | Reply lifecycle is visible in the open conversation, but there is no durable read cursor, unread badge, mention inbox, follow/mute, or notification preference model.                                                                                                                                                                                         | `packages/shared/src/contracts.ts:127`                                               |
| Reactions, save, pin, permalink     | Missing              | No message reaction, bookmark/save-for-later, pin, or stable deep-link action was found.                                                                                                                                                                                                                                                                      | `packages/shared/src/contracts.ts:127`                                               |
| Message edit/delete                 | Missing              | No message mutation exists beyond sending and DM reset.                                                                                                                                                                                                                                                                                                       | `packages/shared/src/contracts.ts:183`                                               |
| Docs/canvas/wiki                    | Missing              | Channel instructions and projected memory provide context, but there is no editable collaborative brief or knowledge surface.                                                                                                                                                                                                                                 | `packages/shared/src/contracts.ts:104`                                               |
| Runtime settings                    | Implemented          | Global and per-channel model/reasoning settings, max agents per turn, memory window, runtime type/model/status, and on-demand agent discovery are visible.                                                                                                                                                                                                    | `ui/src/CommonspaceSidebar.tsx:547`, `ui/src/CommonspaceSidebar.tsx:758`             |
| Import/export/retention             | Missing              | Explicitly listed as upcoming for non-secret Commonspace data.                                                                                                                                                                                                                                                                                                | `docs/roadmap.md:24`                                                                 |
| Multi-human roles/permissions       | Intentional non-goal | Commonspace currently has one local human owner. Adding enterprise guest/admin/role complexity would not improve the present agent collaboration loop.                                                                                                                                                                                                        | `docs/product.md:5`                                                                  |
| Task/status/assignee domain         | Intentional non-goal | The repository contract prohibits a parallel work queue unless product direction changes. Threads are the unit of work.                                                                                                                                                                                                                                       | `AGENTS.md:5`, `docs/product.md:34`                                                  |

## Baseline lessons from Slack

Slack's relevant baseline is the **attention and conversation layer**, not enterprise administration:

- Channels and DMs are first-class navigation destinations; Activity gathers mentions, thread updates, and reactions that need attention. [Slack quick-start guide](https://slack.com/help/articles/360059928654-How-to-use-Slack--your-quick-start-guide) [4]
- Threads keep detailed discussion out of the main feed, can be opened alongside another conversation, optionally echo replies back to the main conversation, and have per-thread notification controls. [Slack threads](https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions) [1]
- Search is an archive of conversations and decisions with phrase matching, exclusion, scoped `in:` modifiers, filters, and sorting. [Slack search](https://slack.com/help/articles/202528808-Search-in-Slack) [2]
- The composer gives immediate formatting feedback and supports bold, italics, underline, strikethrough, code, code blocks, quotes, and lists, while still allowing markup-oriented entry. [Slack message formatting](https://slack.com/help/articles/202288908-Format-your-messages-in-Slack) [3]
- Notifications can distinguish everything from mentions/DMs, allow conversation-specific exceptions, and vary by delivery surface. [Slack notifications](https://slack.com/help/articles/201355156-Configure-your-Slack-notifications) [5]
- A Canvas holds longer-lived, fully formatted context and can be attached as a Channel/DM tab; it supports mentions and comments. [Slack Canvas](https://slack.com/help/articles/203950418-Use-a-canvas-in-Slack) [6]
- Huddles add real-time audio/video, screen sharing, and a dedicated notes thread inside a conversation. [Slack huddles](https://slack.com/help/articles/4402059015315-Use-huddles-in-Slack) [7]

### What Commonspace should take from Slack

**Table stakes:** unread/read state, Activity/mentions, stable thread navigation, global search filters, message permalinks, message actions, composer formatting, and attachments.

**Later:** lightweight Channel/Project brief similar to Canvas.

**Defer:** audio/video huddles, broad app marketplace, enterprise directory/admin controls, and multi-human notification delivery. These do not unblock local agent collaboration.

## Baseline lessons from ClickUp

ClickUp's useful lesson is how communication stays connected to a visible work context:

- Spaces, optional Folders/Subfolders, and Lists provide a visible hierarchy; Lists hold tasks and expose location breadcrumbs across views. [ClickUp Spaces](https://help.clickup.com/hc/en-us/articles/6309466958103-Intro-to-Spaces), [ClickUp Lists](https://help.clickup.com/hc/en-us/articles/6311877646999-Intro-to-Lists) [18][19]
- Chat includes Channels and individual/group DMs, posts, save-for-later, notifications, message-to-task conversion, real-time SyncUps, AI summaries, retention, and Slack import. [ClickUp Chat](https://help.clickup.com/hc/en-us/articles/25790737416855-What-is-Chat) [20]
- Location-based Channels remain synchronized with a Space/Folder/List's name, privacy, access, and lifecycle. [ClickUp Channels](https://help.clickup.com/hc/en-us/articles/30090074843415-What-are-Channels) [21]
- Comments support threads, mentions, rich text, embeds, attachments, reactions, reminders, links, and inline comments on Docs. [ClickUp comments](https://help.clickup.com/hc/en-us/articles/6309646134295-Intro-to-comments) [22]
- An assigned comment can become a resolvable action and appears in attention views. [ClickUp assigned comments](https://help.clickup.com/hc/en-us/articles/6311126397591-Assign-comments) [23]
- Docs/wikis provide pages, history, comments, ownership, relationships, templates, privacy, import/export, and placement in the hierarchy. [ClickUp Docs](https://help.clickup.com/hc/en-us/articles/6328174371351-Intro-to-Docs) [24]
- Inbox is a personal attention queue with unread badges, Primary/Other/Later/Cleared groupings, filters, notification actions, and saved-for-later items. [ClickUp Inbox](https://help.clickup.com/hc/en-us/articles/33947959867543-What-is-the-Inbox) [25]
- Workspace search spans tasks, messages, Docs, and more, is keyboard accessible, and is permission-aware. [ClickUp search](https://help.clickup.com/hc/en-us/articles/6311703331479-Search-your-Workspace) [26]
- Attachments can be dropped into work or comments, listed centrally, previewed, renamed/downloaded, and protected with private links. [ClickUp attachments](https://help.clickup.com/hc/en-us/articles/6309666546199-Add-attachments-to-tasks) [27]
- The same tasks can be viewed as List, Board, Calendar, Gantt, or Team layouts with saved grouping/filter/sort configuration. [ClickUp task views](https://help.clickup.com/hc/en-us/articles/6310172583831-Use-Task-views) [28]
- Permissions span full edit, edit, comment, and view-only levels. [ClickUp permissions](https://help.clickup.com/hc/en-us/articles/6309225399703-Intro-to-permissions) [29]

### What Commonspace should take from ClickUp

**Take:** bind every Channel clearly to a Project; show context breadcrumbs; provide a unified personal attention view; support save-for-later; add lightweight Project/Channel briefs; make files and references visible from the conversation; preserve history and export.

**Adapt carefully:** an “assigned message” could be useful as a local follow-up marker, but it should remain a message annotation—not become a second task database.

**Do not copy:** Space/Folder/List/task hierarchy, statuses, assignees, priorities, dependencies, multiple task views, dashboards, approvals, goals, or enterprise permissions. Those would violate Commonspace's conversation-first scope.

## Baseline lessons from VS Code

VS Code supplies the missing **developer trust layer**:

- A workspace is one or more folders with workspace-scoped settings and restored UI state. Commonspace Projects already align well with this model. [VS Code workspaces](https://code.visualstudio.com/docs/editing/workspaces/workspaces) [17]
- Source Control shows changed files, side-by-side diffs, gutter changes, history, staging, commits, branches, and merge conflicts. [VS Code source control](https://code.visualstudio.com/docs/editor/versioncontrol) [13]
- Agent edits are reviewed through changed-file summaries, single- or multi-file diffs, inline feedback, reviewed state, checkpoints, and explicit integrate/discard actions. [Review agent changes](https://code.visualstudio.com/docs/agents/run/review-code-edits) [10]
- Agent sessions hold the conversation, workspace, changes, and execution state so work can pause, resume, and hand off. Multiple sessions can run in parallel or in the background. [VS Code agents](https://code.visualstudio.com/docs/agents/overview) [9]
- Chat accepts explicit file/symbol/selection/source-control/test context, slash commands, multiple concurrent sessions, and follow-up control while work runs. [VS Code chat](https://code.visualstudio.com/docs/chat/chat-overview) [11]
- While an agent runs, a new message can be queued, used to steer, or used to stop-and-send; pending messages can be reordered. [VS Code chat](https://code.visualstudio.com/docs/chat/chat-overview#_send-messages-while-a-request-is-running) [11]
- Chat renders richer technical output such as math and Mermaid and shows context-window usage. [VS Code AI feature sheet](https://code.visualstudio.com/docs/agents/reference/ai-features-cheat-sheet) [12]
- Markdown support includes source/preview, outline, path/header completions, workspace links, drag/drop file links, and preview synchronization. [VS Code Markdown](https://code.visualstudio.com/docs/languages/markdown) [14]
- The integrated terminal starts in the workspace root, supports multiple/split terminals, exposes command status, and can appear beside editors. [VS Code terminal](https://code.visualstudio.com/docs/terminal/basics) [15]

### What Commonspace should take from VS Code

**Table stakes for an agent workspace:** Project Files, Project Changes, changed-file summaries on agent replies, readable diffs, file/line deep links, explicit context attachments, stop/steer/queue, session history, and visible validation output.

**Later:** inline diff feedback, reviewed markers, checkpoints/revert, Problems/test views, and optional terminal output surfaces.

**Avoid initially:** full editor/IDE parity, staging/commit/push mutation, extension marketplace, debugger, and arbitrary shell UI. Commonspace can first be an excellent review-and-collaboration workspace that opens a file in the user's editor when editing is needed.

## Parity matrix

| Capability              | Commonspace          | Slack                   | ClickUp                         | VS Code                         | Recommendation                                                                                             |
| ----------------------- | -------------------- | ----------------------- | ------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Channels/rooms          | Implemented          | Core                    | Core Chat                       | Sessions/chat, not rooms        | Keep Commonspace semantics.                                                                                |
| One-to-one DMs          | Implemented          | Core                    | Core Chat                       | Session chat                    | Keep exact native-session behavior.                                                                        |
| Group DMs               | Missing              | Core                    | Core Chat                       | Not central                     | Low priority; Channels already cover multi-agent work.                                                     |
| Threads                 | Implemented          | Core                    | Chat/comments                   | Session turns                   | Add deep links, unread/follow controls, and optional main-feed echo—not a new task state.                  |
| Mentions/context refs   | Implemented          | People/user groups      | People/Teams/items              | Files/symbols/tools             | Extend refs to repository files, line ranges, diffs, and agent outputs.                                    |
| Markdown rendering      | Partial              | Rich composer           | Rich comments/Docs              | Rich chat + Markdown preview    | Normalize safe rendering for all authors; add composer preview/toolbar and file-aware links.               |
| Files/attachments       | Missing              | Uploads/previews        | Uploads/previews/proofing       | Explorer/editors                | Build local repository refs first, then managed message attachments.                                       |
| Diff/review             | Missing              | Via integrations        | Git integrations, not core chat | Core SCM/agent review           | Highest-priority differentiator. Start read-only.                                                          |
| Search                  | Partial              | Global + modifiers      | Workspace-wide + filters        | File/symbol/text/command search | Expand to every conversation and object with filters and deep links.                                       |
| Unread/activity         | Missing              | Activity + badges       | Inbox + Later/Cleared           | Session/status views            | Add read cursors, mentions, replies, failures, completions, and saved items.                               |
| Reactions/save/pin      | Missing              | Core                    | Core                            | Not central                     | Save/pin useful; reactions lower priority for a single-human workspace.                                    |
| Agent progress          | Partial              | App-dependent           | AI/agent activity               | Core live agent loop            | Stream traces; expose stop/steer/queue and changed files.                                                  |
| Durable brief/wiki      | Missing              | Canvas                  | Docs/wiki                       | Markdown workspace files        | Prefer a Project/Channel brief backed by local Markdown or a small first-class document—not a task system. |
| Terminal/problems/tests | Missing              | Not core                | Not core                        | Core                            | Surface agent-run commands/results and test failures before considering an interactive terminal.           |
| Permissions/admin       | Intentional non-goal | Extensive               | Extensive                       | Workspace trust/settings        | Preserve single-owner local simplicity.                                                                    |
| Task management         | Intentional non-goal | Lists/workflows adjunct | Product core                    | Tasks are commands/config       | Do not add ClickUp parity. Threads remain work units.                                                      |

## Recommended delivery order

### P0 — Make agent work inspectable and controllable

1. **Project Files (read-only)**
   - Browse Project roots and directories.
   - Open text files with size/binary guards.
   - Show line numbers, language, path breadcrumbs, and “open in editor.”
   - Keep host paths private in browser/API snapshots; use opaque Project-relative references.

2. **Project Changes and agent diffs (read-only)**
   - Show repository status: modified, added, deleted, renamed, untracked.
   - Provide single-file and multi-file diff views with inline/side-by-side modes.
   - Attach changed-file summaries to the agent reply/trace that produced them when attribution is reliable.
   - Show base branch/HEAD and clearly distinguish pre-existing changes from changes observed during a turn.
   - Do not add stage/commit/discard until read-only trust and attribution are proven.

3. **Live run control**
   - Stream trace events already represented by the ACP contract.
   - Add Stop now; then queue, steer, and stop-and-send behavior.
   - Show pending messages and per-agent activity in Channels without serializing unrelated agents.

4. **Unified search and attention**
   - Search Channels, DMs, roots, replies, authors, agent traces, Projects, Agents, and saved briefs.
   - Add filters for conversation, author, date, agent, status, and object type.
   - Add durable per-conversation read cursors and an Activity view for mentions, replies, failures, and completions.

### P1 — Improve conversation fidelity

5. **Composer and rendering parity**
   - Render the same safe Markdown subset for user and agent messages.
   - Add a formatting toolbar or preview without hiding plain-Markdown entry.
   - Preserve fenced code language, copy controls, tables, task lists, quotes, and file/line references.
   - Keep the current external-image privacy guard; allow explicit trusted local attachment preview.

6. **Message actions and navigation**
   - Stable permalink/deep link to a root or reply.
   - Copy link/text, save for later, pin to Channel/Project, edit own unsent/latest text where session semantics permit, and delete with a visible tombstone.
   - Follow/mute a thread and optionally echo selected replies into the Channel feed.

7. **Attachments and explicit context**
   - Attach Project-relative files, selected line ranges, diffs, command/test output, and managed uploads.
   - Display clear context chips before send; never silently inject broad workspace history.

### P2 — Make context durable without becoming ClickUp

8. **Project/Channel brief**
   - Lightweight Markdown content for purpose, constraints, decisions, open questions, and references.
   - Version history, comments, pins, and explicit agent-readable inclusion.
   - Consider backing it with a repository Markdown file when the user chooses, otherwise local Commonspace state.

9. **Export/import and retention**
   - Export non-secret Projects, Channels, messages, threads, and briefs with session/path sanitization.
   - Define retention and deletion semantics before moving to a relational message store.

10. **Validation surfaces**

- Summarize commands, exit status, tests, diagnostics, and browser verification from agent traces.
- Add Problems/test views only if these summaries prove insufficient.

## Product acceptance criteria for the next milestone

A user should be able to:

1. Ask an agent to change code in a Project.
2. Watch progress and stop or steer the run.
3. See exactly which files changed without leaving Commonspace.
4. Open a readable diff tied to the relevant agent reply.
5. Reference a file or line range in a follow-up message.
6. Search later for the request, reply, file, or decision.
7. Find new mentions, replies, failures, and completed agent work in one Activity view.

Meeting those criteria would give Commonspace a coherent baseline that combines Slack's conversation/attention model, ClickUp's visible context binding, and VS Code's inspect/review loop—while preserving Commonspace's distinct local-first, native-session, agent-to-agent collaboration model.

## Sources

[1] https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions
[2] https://slack.com/help/articles/202528808-Search-in-Slack
[3] https://slack.com/help/articles/202288908-Format-your-messages-in-Slack
[4] https://slack.com/help/articles/360059928654-How-to-use-Slack--your-quick-start-guide
[5] https://slack.com/help/articles/201355156-Configure-your-Slack-notifications
[6] https://slack.com/help/articles/203950418-Use-a-canvas-in-Slack
[7] https://slack.com/help/articles/4402059015315-Use-huddles-in-Slack
[9] https://code.visualstudio.com/docs/agents/overview
[10] https://code.visualstudio.com/docs/agents/run/review-code-edits
[11] https://code.visualstudio.com/docs/chat/chat-overview
[12] https://code.visualstudio.com/docs/agents/reference/ai-features-cheat-sheet
[13] https://code.visualstudio.com/docs/editor/versioncontrol
[14] https://code.visualstudio.com/docs/languages/markdown
[15] https://code.visualstudio.com/docs/terminal/basics
[17] https://code.visualstudio.com/docs/editing/workspaces/workspaces
[18] https://help.clickup.com/hc/en-us/articles/6309466958103-Intro-to-Spaces
[19] https://help.clickup.com/hc/en-us/articles/6311877646999-Intro-to-Lists
[20] https://help.clickup.com/hc/en-us/articles/25790737416855-What-is-Chat
[21] https://help.clickup.com/hc/en-us/articles/30090074843415-What-are-Channels
[22] https://help.clickup.com/hc/en-us/articles/6309646134295-Intro-to-comments
[23] https://help.clickup.com/hc/en-us/articles/6311126397591-Assign-comments
[24] https://help.clickup.com/hc/en-us/articles/6328174371351-Intro-to-Docs
[25] https://help.clickup.com/hc/en-us/articles/33947959867543-What-is-the-Inbox
[26] https://help.clickup.com/hc/en-us/articles/6311703331479-Search-your-Workspace
[27] https://help.clickup.com/hc/en-us/articles/6309666546199-Add-attachments-to-tasks
[28] https://help.clickup.com/hc/en-us/articles/6310172583831-Use-Task-views
[29] https://help.clickup.com/hc/en-us/articles/6309225399703-Intro-to-permissions
