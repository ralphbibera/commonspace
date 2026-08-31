# Commonspace feature-parity research

Researched 2026-08-28 against the current working tree and primary sources for Visual Studio Code, Block Buzz, Slack, ClickUp, and Paperclip AI. The two open-source comparators were also inspected at their current default branches.

## Executive conclusion

Commonspace already has the right **agent-collaboration spine**: local filesystem Projects, Channels, one-to-one agent DMs, threaded native sessions, explicit agent routing, exact session resumption, bounded cross-agent handoffs, per-channel context, and durable agent activity traces.

The deeper comparison changes the emphasis. Commonspace now implements much of the first report's read-only trust layer—Project Files, Git Changes/diffs, image attachments, an actual-replies Inbox, richer Markdown, speech playback, and native harness configuration/capability inspection. The next gaps are the surfaces that let one owner supervise several durable agent sessions without turning Commonspace into a ticketing product:

1. **Live supervision:** semantic activity and stop are implemented; steer/queue, needs-attention states, and richer completion/failure signals remain.
2. **Work/result binding:** identify what a run changed, distinguish pre-existing changes, attach validation evidence, and review a result from the conversation that caused it.
3. **Attention and retrieval:** expand the reply Inbox into mentions/failures/completions, add deep links and saved items, and search every conversation and project object.
4. **Composable agents:** expose each agent's instructions, skills, tools, knowledge, memory policy, model, permissions, and cost in one inspectable profile while preserving native-harness ownership.
5. **Durable context:** lightweight Project/Channel briefs, pinned decisions, workflow triggers, and sanitized import/export.

Buzz is the closest product-shape comparator: people and agents share rooms, repositories, workflows, and an audit substrate. VS Code is the strongest execution/review comparator. Slack is strongest at attention, retrieval, and multiplayer agent sessions. ClickUp is strongest at configurable agent profiles and operational analytics. Paperclip is strongest at autonomous-run governance, but its company/org-chart/task hierarchy is intentionally outside Commonspace's scope.

ClickUp's task hierarchy, assignees, statuses, dashboards, and approval/work-queue model should remain comparator context, not parity targets. Commonspace's product contract says conversation is the work record and explicitly excludes a parallel task domain.

## Full capability map: top-level first

The product should be planned as an **agent collaboration workspace**, not as chat with a few AI buttons. The complete opportunity breaks into twelve top-level capability pillars. The order below reflects product importance, not implementation difficulty.

| Pillar                               | Product outcome                                                                             | Priority   |
| ------------------------------------ | ------------------------------------------------------------------------------------------- | ---------- |
| 1. Workspace and context topology    | Every conversation and agent run has a visible, bounded home.                               | Foundation |
| 2. Agent roster and configuration    | Agents are understandable, reusable teammates with explicit capabilities and limits.        | Foundation |
| 3. Conversation and collaboration    | Humans and agents can communicate naturally without losing thread or context.               | Foundation |
| 4. Agent coordination and delegation | Multiple agents can divide, hand off, review, and synthesize work safely.                   | Foundation |
| 5. Sessions, execution, and control  | Agent work can run concurrently while remaining steerable, interruptible, and recoverable.  | Foundation |
| 6. Files, changes, and evidence      | Results are inspectable through artifacts, diffs, tests, and source links.                  | Foundation |
| 7. Knowledge and memory              | Durable facts, decisions, instructions, and references remain visible and governable.       | Next       |
| 8. Attention and rediscovery         | Replies and decisions are easy to find without mixing thinking/status noise into the Inbox. | Next       |
| 9. Coordination rhythms              | Recurring standups, reviews, and summaries keep autonomous work aligned.                    | Next       |
| 10. Templates and automation         | Proven collaboration patterns can be reused without creating a task bureaucracy.            | Later      |
| 11. Trust, safety, and governance    | Tool access, data scope, approvals, and audit evidence are explicit.                        | Continuous |
| 12. Observability and improvement    | Cost, quality, failures, and agent effectiveness can be understood over time.               | Later      |

### 1. Workspace and context topology

**Top-level feature:** make context boundaries visible and navigable.

Detailed opportunities:

- Projects with one working directory and optional reference directories.
- Project overview showing conversations, agents, briefs, files, changes, and recent decisions.
- Project-relative references instead of exposing absolute host paths.
- Project-scoped and workspace-wide Channels.
- Persistent one-to-one agent DMs.
- Optional temporary rooms for short-lived multi-agent collaboration.
- Visible breadcrumb on every message, thread, artifact, and run.
- Explicit context manifest showing what directories, files, instructions, memory, tools, and prior messages an agent can access.
- Context preview before send, with removable context chips.
- Context-size estimate and warnings when a request will truncate or summarize material.
- Hard `/new` boundaries and visible session separators.
- Import/export of non-secret workspace structure and conversation history.
- Retention, archive, restore, and permanent-delete controls.

VS Code treats a session as an independent unit of work with its own conversation and context, supports multiple concurrent sessions, forks, checkpoints, and cross-surface continuation. [34] Commonspace should keep its stricter native-session boundaries while making the same unit of work easier to inspect.

### 2. Agent roster and configuration

**Top-level feature:** give each agent a profile that answers _who is this, what can it do, what can it see, and when will it act?_

#### Identity and purpose

- Display name, avatar/color, concise description, and role.
- Example requests and clear “best used for” guidance.
- Runtime/harness identity separated from the human-facing role.
- Owner/manager field for who may edit the configuration, even in a single-owner workspace.
- Availability, authentication health, last successful run, and current status.
- Duplicate/clone agent and export/import configuration.

#### Runtime configuration

- Harness/profile selection: Hermes, Codex, or future adapters.
- Default model and reasoning effort.
- Per-Project, per-Channel, and per-run overrides with a clear inheritance preview.
- Timeout, retry policy, fallback model, maximum parallel work, and context budget.
- Cost/token ceiling per run and optional daily ceiling.
- Working directory and additional read-only reference roots.
- Environment/runtime health without revealing credentials.
- Versioned configuration history, diff, restore, and “last changed by.”

#### Instructions and behavior

- Required role/objective instructions.
- Workspace-wide, Project-specific, Channel-specific, and file-pattern-specific instructions.
- Explicit precedence view showing which instructions win.
- Starter prompts, output style, response schema, definition of done, and required verification.
- Routing policy: mention-only, seated Channel participant, scheduled, or trigger-based.
- Collaboration policy: may mention peers, may delegate, may review, maximum handoff depth, and loop budget.
- Escalation rules: when to stop, ask the human, request review, or report a blocker.

VS Code custom agents combine instructions, tools, model choice, and handoff targets in reusable workspace- or user-scoped profiles; read-only planning agents demonstrate least-privilege configuration. [30] Its instruction model separates always-on workspace rules from file/task-specific rules and exposes diagnostics for loaded sources. [32]

#### Tools and capabilities

- Explicit allowlist of built-in, MCP, and harness tools.
- Tool groups such as read, search, edit, test, browser, messaging, and deployment.
- Read-only versus mutating capability badges.
- Per-tool approval policy: always allow, ask, or deny.
- Project-specific tool overrides.
- Network policy and domain allowlist.
- Secret references by runtime handle only—never copied into Commonspace messages or configuration text.
- Tool health check and last error.
- Dry-run/simulation mode for risky agents.

#### Skills and reusable procedures

- Discover Project and personal skills.
- Show skill source, description, trigger conditions, and required resources.
- Enable/disable skills per agent or Project.
- Manual-only versus automatically selected skills.
- Generate a skill from a successful conversation with human review.
- Version, validate, share, and diagnose skill-loading errors.

VS Code distinguishes always-applied instructions from on-demand Agent Skills containing instructions, scripts, examples, and resources; skills may be Project- or user-scoped and can be manually invocable or automatically selected. [31]

#### Knowledge and memory

- Selectable knowledge sources: Project files, specific directories, briefs, conversation history, connected sources, or web.
- Visible read scope and freshness timestamp for each source.
- Short-term session memory separated from durable agent preferences and Project facts.
- Human approval before durable preference storage.
- Memory browser with source, date, confidence, edit, and delete actions.
- Per-agent versus shared Project/Channel memory.
- “What this agent knows” preview before invoking it.
- Data-leak warning when an agent can combine private and broadly visible sources.

ClickUp's Super Agent profile groups **Instructions, Triggers, Skills, Knowledge, and Memory**, supports natural-language or manual configuration, and makes the profile available from messages and DMs. [36] This is the clearest high-level configuration pattern for Commonspace to adapt, while keeping memory finite, source-visible, and local.

#### Triggers and activation

- Direct human message.
- `@mention` in a Channel or thread.
- Channel-roster fan-out when no valid mention is supplied.
- Agent-to-agent bounded mention handoff.
- Manual “Run agent” action with a scoped prompt.
- Scheduled trigger for standups or maintenance summaries.
- Event trigger: new message, file/change event, test failure, or external webhook.
- Trigger conditions, cooldown, deduplication key, and maximum invocations.
- Preview of what event data will be sent.
- Trigger history with success, skipped, failed, and disabled reasons.

ClickUp distinguishes conversational Super Agents from trigger-driven Autopilot Agents; Chat activation can happen through a DM, `@mention`, message-posted event, or Channel automation. [37]

#### Configuration quality and lifecycle

- Setup wizard with identity → runtime → instructions → tools → knowledge → triggers → test.
- Test console using a synthetic prompt and read-only mode.
- Configuration lint: missing role, conflicting instructions, unavailable tool, invalid path, excess privilege, or unreachable runtime.
- Readiness score based on concrete checks rather than model judgment.
- Draft/published state for configuration changes.
- Rollback to last known-good version.
- Archive agent while preserving conversations and native session references.

### 3. Conversation and collaboration

**Top-level feature:** make conversation the legible work record.

Detailed opportunities:

- Channels, DMs, roots, replies, and optional group DMs.
- Rich safe Markdown for both human and agent messages.
- Formatting preview or toolbar without hiding plain-Markdown entry.
- Code blocks, tables, task lists, Mermaid, math, quotes, and syntax-aware copy.
- File, symbol, line-range, diff, test, command-output, and session references.
- Attach local files and managed uploads with explicit privacy behavior.
- Message permalinks and stable deep links to roots/replies.
- Copy, edit, delete-with-tombstone, pin, and save actions.
- Reactions for lightweight acknowledgment, but not as a prerequisite for agent execution.
- Thread follow/mute and optional “also post to Channel.”
- Drafts, send-later, and queued follow-up messages.
- Reply provenance showing which prompt, context manifest, model, and agent configuration produced it.
- Clear separation between the **reply** and optional expandable thinking/tool trace.

### 4. Agent coordination and delegation

**Top-level feature:** let agents collaborate without hidden fan-out or accidental loops.

Detailed opportunities:

- Explicit Channel roster and per-turn routing preview.
- Targeted mentions and bounded unmentioned fan-out.
- Human-selected lead agent or automatic coordinator.
- Parallel independent work with one consolidated response.
- Sequential handoffs such as Research → Plan → Implement → Review.
- Suggested handoff buttons with prefilled prompts and human approval.
- Reviewer/critic agents with read-only tools.
- Multi-perspective reviews: security, accessibility, performance, and tests.
- Consensus mode showing agreement, disagreement, and unresolved evidence.
- Parent/child subagent tree with scope, prompt, model, elapsed time, and active tool.
- Read-only peer transcript for each delegated subagent.
- Bounded context passed to peers; child returns a summary rather than contaminating the parent context.
- No recursive delegation by default; explicit depth and fan-out limits.
- Loop detection for repeated mentions/handoffs.
- Single-writer declaration for shared artifacts and collision warnings when another session edits them.
- Merge/reconciliation workflow when parallel agents touch overlapping files.
- Human checkpoint between planning, mutation, and review stages.

VS Code handoffs create guided transitions between specialized agents with a target, label, prefilled prompt, optional automatic send, and model choice. [30] Subagents isolate context, can run parallel research/review, appear as inspectable peer chats, and return focused results to a parent agent. [33]

### 5. Sessions, execution, and control

**Top-level feature:** make every run controllable and recoverable.

Detailed opportunities:

- Queued, running, waiting, complete, failed, cancelled, and interrupted states.
- Live response and tool-event streaming inside the active conversation.
- Stop, pause, resume, retry, and retry-with-different-model.
- Send while running: queue, steer immediately, or stop-and-send.
- Reorder or remove queued messages.
- Per-agent and per-native-session concurrency visibility.
- Background execution when navigating away.
- Session list with Project, conversation, agent, status, start time, duration, and changed files.
- Fork a session to explore an alternative while preserving the original.
- Checkpoint and rollback for agent-created changes.
- Stale-session recovery with clear missing-versus-transient errors.
- Cancellation propagation to tools/subagents.
- Run budget: maximum time, tools, tokens, cost, handoffs, and retries.
- Collision detection for files changed before/during a run.
- Recovery after host restart with interrupted-state markers.
- Optional remote session support later, without weakening local-first defaults.

### 6. Files, changes, and evidence

**Top-level feature:** make results verifiable without leaving the workspace.

Detailed opportunities:

- Read-only Project file explorer with multiple roots.
- Text, image, audio/video, PDF, and structured-data previews with size guards.
- Search within Project files and open-in-editor action.
- Git status grouped by modified, added, deleted, renamed, and untracked.
- Unified and side-by-side diffs.
- Changed-file summary attached to the producing agent reply.
- Distinguish pre-existing changes from changes observed during a run.
- Line comments and “send feedback to agent” from a diff.
- Reviewed/unreviewed markers.
- Test, lint, typecheck, build, and browser-verification evidence.
- Command, exit code, duration, and bounded output.
- Problems view derived from diagnostics and failed checks.
- Artifact provenance linking evidence back to agent, session, message, and configuration version.
- Later: checkpoint restore, selective discard, staging, and commit only after read-only review is trusted.

### 7. Knowledge and memory

**Top-level feature:** preserve shared understanding without creating hidden context.

Detailed opportunities:

- Project brief: purpose, architecture, constraints, vocabulary, and definition of done.
- Channel brief: scope, participants, instructions, recurring rituals, and relevant references.
- Decision records linked to source messages and diffs.
- Pinned messages and curated reference collections.
- Open questions and known blockers derived from explicit conversation markers.
- Bounded Channel memory with visible source threads.
- Automatic summary suggestions that require human confirmation before becoming durable facts.
- Freshness and stale-content warnings.
- Conflict detection when two memories/instructions disagree.
- Search across briefs, decisions, messages, files, traces, and artifacts.
- Exportable Markdown representation and optional repository-backed storage.

### 8. Attention and rediscovery

**Top-level feature:** help the owner find real communication and decisions without turning agent internals into notification noise.

Detailed opportunities:

- Reply-focused Inbox containing actual agent replies only.
- All/Unread filters and durable read cursor.
- Exact navigation to the DM or Channel thread.
- Separate Activity/Runtime surface for failures, completions, tool activity, and system events.
- Saved for later and pinned references.
- Conversation-level unread counts and last-read position.
- Global search across DMs, Channels, roots, replies, Projects, agents, briefs, files, diffs, and decisions.
- Filters by author, agent, Project, Channel, date, message type, and artifact type.
- Search snippets with highlighted matches and stable deep links.
- Recent conversations and recently changed artifacts.
- Optional digest rather than interruptive desktop notifications.

This separation is important: **Inbox means replies; Activity means runtime/system state; traces remain inside the relevant reply.**

### 9. Coordination rhythms and agent standups

**Top-level feature:** turn autonomous work into a concise, source-linked recurring update.

#### Standup definition

- Name, Project/Channel scope, participants, schedule, timezone, and destination.
- Manual “Run standup now” and scheduled execution.
- Lookback window such as since last standup, last 24 hours, or custom range.
- Optional lead/facilitator agent responsible only for synthesis.
- Configurable sections with sensible defaults.

#### Recommended default standup sections

1. **Completed:** concrete work finished since the previous standup.
2. **In progress:** active sessions and expected next result.
3. **Blockers:** failed checks, missing decisions, unavailable tools, conflicts, or human input needed.
4. **Next:** intended next action for each participating agent.
5. **Changes:** files/diffs and validation evidence produced.
6. **Decisions:** newly recorded decisions and unresolved questions.

#### Collection and synthesis

- Ask each participating agent for a structured update from its own recent sessions.
- Prefer persisted messages, session outcomes, diffs, and verification evidence over model recollection.
- Require source links from every material bullet to a message, thread, session, file, diff, or test result.
- Collapse duplicate reports about the same thread or artifact.
- Distinguish observed evidence from agent-reported intention.
- Flag stale agents with no recent activity rather than inventing an update.
- Preserve failures and blockers even when an agent produced no final reply.
- Compare with the previous standup to identify carried blockers and changed commitments.

#### Presentation and follow-up

- Post one compact standup message into the selected Channel.
- Expand per-agent details on demand.
- Show generated-at time, lookback window, and source coverage.
- Reply in the standup thread to ask an agent for clarification.
- Mention only the human or agent that must act next.
- “Run again,” “change window,” and “exclude this item” controls.
- Mark a blocker resolved by linking the resolving reply—not by adding task status.
- Weekly rollup based on standup history and explicit decisions.

ClickUp's AI StandUp is designed to summarize progress, blockers, risks, and priorities for selected people over a selected time period. [35] Commonspace should adapt the ritual around **agent sessions, replies, diffs, and verification evidence**, not ClickUp tasks.

#### Standup guardrails

- Never auto-edit code or dispatch new work as part of standup generation.
- Never treat plans as completed work.
- Never expose hidden reasoning; summarize observable outcomes and source evidence.
- Never create acknowledgment ping-pong among agents.
- Maximum one synthesized standup post per scheduled run.
- If evidence coverage is weak, say so explicitly.

### 10. Templates and automation

**Top-level feature:** reuse collaboration structure, not task bureaucracy.

Detailed opportunities:

- Project template: directory expectations, default agents, instructions, skills, and brief skeleton.
- Channel template: roster, Channel purpose, instructions, pinned brief, slash commands, and standup schedule.
- Agent template: role, instructions, tools, knowledge scope, trigger defaults, and verification policy.
- Workflow template: explicit sequence of prompts/handoffs with human checkpoints.
- Templates for research, implementation, code review, incident investigation, release readiness, and weekly review.
- Natural-language template builder that produces a reviewable configuration diff.
- Manual, schedule, message, mention, file-change, failed-check, and webhook triggers.
- Conditional branches and cooldown/deduplication.
- Run history with inputs, outputs, errors, and who/what triggered it.
- Draft, publish, disable, clone, export, and rollback.
- Permission/approval for mutating tools and external connectors.

Slack Workflow Builder combines templates or custom flows, triggers, steps, conditional branches, connectors, activity/error logs, and access management. [38] Slack Channel templates bundle a Channel with reusable context and workflows; Commonspace can adapt this idea as a bundle of **roster + brief + agent configuration + recurring ritual** while omitting lists/tasks. [39]

### 11. Trust, safety, and governance

**Top-level feature:** make autonomy bounded and explainable.

Detailed opportunities:

- Loopback/local-only authority by default.
- Per-agent tool allowlists and least-privilege defaults.
- Read-only, workspace-write, and explicitly elevated execution modes.
- Project-root path containment and symlink/canonical-path checks.
- Same-origin mutation guards and authenticated local tool endpoints.
- Secret handles rather than raw credential fields.
- Approval checkpoints for destructive file, Git, deployment, messaging, or external-data actions.
- Human-readable execution preview for risky actions.
- Audit trail of prompts, context manifest, tools, outputs, configuration version, and approvals.
- Redaction of host paths, credentials, native session IDs, and oversized tool output.
- Configurable retention and secure deletion.
- Trigger loop limits, mention fan-out limits, and rate limits.
- Safe rollback instructions for persisted-state migrations.
- Health center for runtime auth, unavailable models/tools, and configuration errors.

### 12. Observability and improvement

**Top-level feature:** improve agents from evidence rather than vibes.

Detailed opportunities:

- Per-run model, reasoning, tokens, cost, duration, tool calls, retries, and outcome.
- Success criteria recorded before execution and verification evidence afterward.
- Failure taxonomy: auth, timeout, unavailable tool, invalid context, test failure, cancellation, or collision.
- Agent reliability over time without ranking agents on superficial message volume.
- Cost and latency by agent, Project, workflow, and model.
- Standup source-coverage and stale-item rate.
- Handoff count, loop prevention, and unresolved blocker age.
- Configuration change versus outcome comparison.
- Human feedback on replies and artifacts.
- Exportable diagnostics bundle with secrets and host-private data removed.
- Separate operational dashboards from the reply-focused Inbox.

## Recommended product hierarchy

The feature set should appear in the UI in this order:

1. **Workspace:** Inbox, Projects, Channels, DMs, Agents, Search.
2. **Project:** Overview, Conversations, Files, Changes, Brief, Standups.
3. **Channel/DM:** Messages, threads, composer, participants, context, pins.
4. **Agent:** Profile, Instructions, Tools, Skills, Knowledge, Memory, Triggers, Runtime, History.
5. **Session/run:** Reply, live activity, controls, context manifest, changed files, evidence, trace.
6. **Automation:** Templates, schedules, triggers, run history.
7. **System:** Runtime health, auth, safety, storage, import/export, diagnostics.

This hierarchy keeps top-level concepts stable while allowing fine-grained configuration to live in the object it governs.

## Prioritized product sequence

### Foundation: make the workspace trustworthy

1. Finish reply-focused Inbox and exact navigation.
2. Project Files, Changes, and readable diffs.
3. Live Stop/steer/queue controls and session list.
4. ACP-advertised runtime readiness and capability signals in conversation/session surfaces, without a standalone Agent profile/configuration center.
5. Explicit context attachments and context manifest.
6. Unified search and stable deep links.

### Next: make agents collaborate deliberately

7. Agent tools/skills/knowledge configuration.
8. Guided handoffs and reviewer agents.
9. Single-writer/collision visibility.
10. Project/Channel briefs and decision records.
11. Evidence-backed manual agent standup.
12. Scheduled standups after the manual output is trusted.

### Later: make successful patterns reusable

13. Agent, Channel, and Project templates.
14. Triggered automations with strict limits and run history.
15. Fork/checkpoint/rollback.
16. Evaluation, cost, and reliability analytics.
17. Optional remote/synced sessions and external connectors.

### Continue to avoid

- A second hidden task/work-queue system.
- Agent thinking or tool noise in the reply Inbox.
- Unbounded recursive delegation or automatic mention loops.
- Credentials copied into prompts, profiles, messages, or exports.
- Full IDE/editor parity before review and collaboration surfaces are excellent.
- Multi-human enterprise administration before Commonspace's single-owner product loop is proven.

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
| Agent reply Markdown                | Partial              | Agent messages use Streamdown in static mode with headings, emphasis, code, lists, tables, links, copy controls, safe external-image handling, and asynchronous placeholder behavior. User messages remain plain text; no rich composer or send-time preview exists.                                                                                          | `ui/src/MessageMarkdown.tsx:4`, `tests/message-markdown.client.spec.tsx:60`          |
| Agent activity/trace                | Partial              | Running turns stream semantic activity and expose per-run and `/stop` cancellation; completed replies preserve sanitized reasoning summaries, plans, tool calls/results, duration, usage, and cost. Steering, queued follow-ups, and stronger attention states remain.                                                                                          | `ui/src/CommonspaceConversation.tsx:241`, `docs/roadmap.md:18`                                     |
| Search                              | Partial              | `⌘K` opens accessible search across Channel names, instructions, authors, and Channel-message text. Terms use case-insensitive AND substring matching; message results are newest-first and capped at 24. It can open the matching Channel/thread. It does not search DMs, Projects, Agents, files, traces, or projected memory and has no filters/modifiers. | `ui/src/CommonspaceSidebar.tsx:158`, `ui/src/CommonspaceSidebar.tsx:206`             |
| Slash commands                      | Implemented          | `/help`, `/new`, `/retry`, `/status`, and `/agents` run locally and are never forwarded as prompts. Unknown commands are blocked.                                                                                                                                                                                                                             | `ui/src/slash-commands.ts:17`, `ui/src/CommonspaceConversation.tsx:235`              |
| Files                               | Implemented          | A read-only Project browser traverses configured roots, keeps path handling server-side, and previews guarded text, image, and video files. It does not edit files, expose symbols, or attach a repository reference to a prompt.                                                                                                                             | `ui/src/CommonspaceProjectFiles.tsx:18`, `tests/project-files.client.spec.tsx:49`    |
| Git changes and diffs               | Partial              | The Project Changes view shows branch/status counts and unified per-file diffs. It is not yet attributed to a particular run, does not distinguish pre-existing changes, and lacks side-by-side/inline review, checkpoints, or integrate/discard actions.                                                                                                     | `ui/src/CommonspaceProjectChanges.tsx:40`, `tests/project-files.client.spec.tsx:96`  |
| Attachments and previews            | Partial              | The message contract and composer support image attachments, including paste flows. Repository references, arbitrary files, diffs, command output, frame comments, and a centralized attachment browser remain missing.                                                                                                                                       | `packages/shared/src/contracts.ts:170`, `ui/src/commonspace-store.ts:194`            |
| Unread/notifications/activity inbox | Partial              | Inbox persists per-message read state and shows actual unread agent replies without duplicating thinking/status noise. It is not yet a full attention view for mentions, failures, requests for input, saved items, thread follows, or notification preferences.                                                                                              | `packages/shared/src/contracts.ts:163`, `tests/inbox-items.spec.ts:91`               |
| Reactions, save, pin, permalink     | Missing              | No message reaction, bookmark/save-for-later, pin, or stable deep-link action was found.                                                                                                                                                                                                                                                                      | `packages/shared/src/contracts.ts:127`                                               |
| Message edit/delete                 | Missing              | No message mutation exists beyond sending and DM reset.                                                                                                                                                                                                                                                                                                       | `packages/shared/src/contracts.ts:183`                                               |
| Docs/canvas/wiki                    | Missing              | Channel instructions and projected memory provide context, but there is no editable collaborative brief or knowledge surface.                                                                                                                                                                                                                                 | `packages/shared/src/contracts.ts:104`                                               |
| Runtime settings                    | Partial              | Commonspace-level routing and Channel run settings remain visible. Runtime-specific profile inspection/mutation was removed because capabilities and controls must come from ACP; readiness and capability presentation remain incremental work.                                                                                                                      | `docs/product-spec.md:241`, `ui/src/CommonspaceSidebar.tsx`                          |
| Speech playback                     | Implemented          | Agent message text can be read aloud through the browser speech surface. This is accessibility/output convenience, not a voice-room or huddle implementation.                                                                                                                                                                                                 | `ui/src/message-speech.ts:1`                                                         |
| Import/export/retention             | Missing              | Explicitly listed as upcoming for non-secret Commonspace data.                                                                                                                                                                                                                                                                                                | `docs/roadmap.md:24`                                                                 |
| Multi-human roles/permissions       | Intentional non-goal | Commonspace currently has one local human owner. Adding enterprise guest/admin/role complexity would not improve the present agent collaboration loop.                                                                                                                                                                                                        | `docs/product.md:5`                                                                  |
| Task/status/assignee domain         | Intentional non-goal | The repository contract prohibits a parallel work queue unless product direction changes. Threads are the unit of work.                                                                                                                                                                                                                                       | `AGENTS.md:5`, `docs/product.md:34`                                                  |

## Deeper parity lens

This report separates four layers that are often bundled together under “agent workspace”:

1. **Conversation substrate:** rooms, DMs, threads, references, media, search, unread state, and durable history.
2. **Execution substrate:** native sessions, workspaces, isolation, tools, skills, handoffs, scheduling, concurrency, and cancellation.
3. **Trust substrate:** semantic activity, file attribution, diffs, tests, permissions, approvals, audit, cost, and rollback.
4. **Coordination model:** conversation-led work, session-led work, temporary project rooms, or explicit tasks/goals/org charts.

Feature parity should be sought within the first three layers. The fourth is a product choice. Commonspace should not adopt a task/company hierarchy merely because Paperclip or ClickUp uses one.

## Deep comparison: Block Buzz

### Product model

Buzz is the nearest direct comparator. It is a self-hostable workspace where humans and agents occupy the same rooms. Its protocol model makes messages, reactions, workflow steps, review approvals, and Git events signed entries in one Nostr-backed log. Agents use their own keys and channel memberships rather than appearing only as bot responses. [40][41]

The current repository explicitly marks channels, threads, DMs, canvases, media, search, audit log, desktop app, agent-first CLI, ACP harnesses, YAML workflows, Git events, and Git hosting as working today. Mobile, workflow approval glue, and huddle lifecycle are described as still being wired up; push notifications remain pending. [40]

### High-value capabilities

- **Unified event substrate:** conversation, repository, workflow, approval, and audit events share an identity and search model. This reduces the integration gap between “what was asked,” “what changed,” and “who approved it.” [40]
- **Agent/member symmetry:** agents can create channels, edit canvases, run workflows, use repositories, send patches, review code, orchestrate peers, and participate in huddles through the same workspace identity surface as humans. [40][41]
- **Branch-as-room:** the documented design binds a feature branch to a room where patches, CI, review, and merge decisions remain together. This is stronger than Commonspace's current loose relationship between a conversation and the Project-wide Changes tab. [40]
- **Automation:** YAML workflows support message, reaction, schedule, and webhook triggers. That is a useful model for ambient agent behavior without requiring a task board. [40]
- **Media collaboration:** Buzz supports media and demonstrates comments anchored to video frames. Commonspace previews media in Project Files and can attach images, but has no annotation model. [40]
- **Semantic supervision:** Buzz's activity design normalizes agent actions into verb/object/outcome cards, mutates running actions in place, surfaces failures, keeps raw detail behind disclosure, and renders silence/timeouts instead of going dark. [42]
- **Portable/self-owned identity:** signed identities and a relay owned by the operator create a different portability and multi-user trust model from Commonspace's local aliases over native harness identities. [40][41]

### What Commonspace should copy, adapt, or reject

**Copy:** result-linked rooms; semantic activity cards; changed-file/CI/review events in the causative thread; message/reaction/schedule/webhook triggers; a searchable audit timeline; richer local-media references.

**Adapt:** agent/member symmetry should mean equal conversational and reference affordances, not permission to mutate every workspace object. Commonspace should keep host paths and native session identifiers private and preserve harness-owned credentials.

**Reject for now:** Nostr migration, cryptographic social identity, multi-community hosting, Git hosting, voice huddles, and multi-human access control. These solve different deployment and trust problems than a single-owner local-first workspace.

## Deep comparison: Visual Studio Code

### Product model

VS Code treats an agent session—not a channel or task—as the primary unit of agent work. A session holds prompts, replies, tool calls, accumulated context, workspace, execution state, and changes. Sessions are isolated, can run concurrently, can contain multiple chats sharing one workspace/isolation boundary, and can hand off between local, background, cloud, and third-party harnesses. [34][53][54]

### High-value capabilities

- **Central session control plane:** the Agents view/window organizes local and remote sessions, status, history, archive, resume, and handoff rather than requiring users to rediscover work inside chat history. [53]
- **Harness choice and isolation:** sessions can run locally, in background worktrees, remotely, or in cloud environments. The execution location and isolation strategy are explicit. [54]
- **Review loop:** agent edits are grouped by changed file and reviewed as diffs; users can accept/integrate, discard, comment inline, mark reviewed, or return to checkpoints. [10]
- **Live steering:** a user can queue follow-ups, steer a running agent, stop-and-send, reorder pending messages, or stop the run. [11]
- **Custom agents and handoffs:** role-specific agent files can define instructions, tools, model and handoff buttons. Workspace/repository instructions complement those profiles, and handoff preserves relevant context while changing specialization. [30][32]
- **Portable skills:** skills package instructions, scripts, examples, and resources and load only when relevant. The format is shared across compatible agents. [31]
- **Subagents:** focused subagents run with isolated context and return bounded results, including parallel research/review patterns; independent full sessions can also run concurrently. [33][55]
- **Explicit context:** files, symbols, selections, source-control state, test failures, and other resources are attached deliberately rather than inferred from unlimited history. [11][12]
- **Context lifecycle:** independent sessions prevent leakage; context usage is visible; compaction and an explicit new session address context pressure without pretending old and new work are one conversation. [34][53]

### What Commonspace should copy, adapt, or reject

**Copy:** a session-centric supervision view; stop/steer/queue; explicit context chips; run-linked diffs and validation; needs-attention state; checkpoints or at least safe snapshots; context-window visibility; archive/resume affordances.

**Adapt:** Commonspace threads already map well to sessions, but Channels must continue to support multiple agents and non-blocking peer mentions. A handoff should remain a visible message/context transfer, not silent session identity substitution.

**Reject for now:** becoming a full editor, source-control client, debugger, terminal multiplexer, or extension marketplace. “Open in editor” plus an excellent inspect/review loop is enough.

## Deep comparison: Slack

### Product model

Slack's differentiator is no longer only channels and notifications. Its Agents & tools surface collects installed agents, session history, status, and multiplayer conversations. Agents can be DMed, added to channels, mentioned publicly or privately, resumed in split view, and installed subject to app approval and scopes. [49]

Slack Code creates temporary public or private code channels around an agent task. Teams follow progress, give feedback, review previews/diffs, approve the result, and retain searchable context after automatic archival. The agent does background work without flooding the parent conversation and exposes when it needs attention. [49][51]

### High-value capabilities

- **Attention architecture:** Activity, unread state, thread following, conversation-specific notifications, and agent needs-attention/completion status let users supervise asynchronously. [1][5][49]
- **Retrieval with receipts:** AI search and summaries cite source messages/files. Enterprise search extends this across connected tools while enforcing the current user's permissions. [50][52]
- **Catch-up:** channel/DM/thread summaries, daily recaps, file summaries, and huddle notes compress ambient conversation into evidence-linked updates. [50]
- **Agent discovery and governance:** Agents & tools acts as catalog, session sidebar, and status surface; admins can approve apps and inspect scopes. [49]
- **Workflow Builder:** message-adjacent automation supports templates, external starts, connector steps, conditional branches, schedules, reactions, channel events, managers, permissions, and activity/error logs. [38]
- **Durable context objects:** canvases hold long-form context while lists/workflows can be composed into channel templates. [6][39]

### What Commonspace should copy, adapt, or reject

**Copy:** an attention model beyond “new reply”; source-linked summaries; agent session status/needs-attention; temporary result rooms or explicit thread archival; permission-like visibility of native capabilities; scheduled/reaction/message triggers; stable links and saved items.

**Adapt:** Commonspace's single owner does not need notification delivery matrices or app-install governance, but it does need mute/follow, clear unread semantics, and a way to see which agent can access which tools/services before invoking it.

**Reject for now:** enterprise search connectors, marketplace economics, multi-organization administration, calls/huddles, guest roles, and broad workflow integrations.

## Deep comparison: ClickUp

### Product model

ClickUp combines chat and documents with a task hierarchy. Its newer Super Agents expose a centralized AI Hub, searchable agent catalog, profile builder, DMs, memory, triggers, skills, knowledge, tools, model choice, sharing, privacy, usage, and activity. [36][37][58]

### High-value capabilities

- **Agent profile as control surface:** one profile exposes instructions, triggers, skills, knowledge, memory, model, permissions, status, activity, and cost rather than scattering configuration across settings. [57]
- **Discoverability:** AI Hub supports all/my/recent agents, gallery/list views, search, filters for status/model/creator/manager/tool, sortable columns, cloning, activation/deactivation, and direct chat. [58]
- **Operational analytics:** per-agent average/last/total cost, run count, in-progress runs, and workspace-level usage make spend and throughput inspectable. [57][58]
- **Audit:** run tables record time, agent, location, trigger, initiator, completed/skipped/failed status, tools, and selected agent explanations; rows and filters support troubleshooting. [56]
- **Ambient triggers:** Super Agents can run from assignment, mentions, schedules, location events, or direct interaction and can refine themselves through conversation. [36][37][57]
- **Knowledge and memory:** configuration distinguishes durable instructions, selected knowledge, skills, and memory behavior. This is more legible than one generic prompt or opaque native profile. [36][57]
- **Standups and summaries:** ClickUp can generate recurring standups from work activity, showing the value of scheduled evidence-based digests. [35]

### What Commonspace should copy, adapt, or reject

**Copy:** unified agent profile; run/activity filters; cost/usage visibility; activate/deactivate control; explicit trigger/skill/knowledge/memory categories; cloneable profile presets; scheduled evidence-based digests.

**Adapt:** configuration must read from and write through supported native harness APIs. Commonspace-local aliases and appearance must remain separate from native profile identity and credentials. “Permissions” can begin as a truthful capability matrix and Project/Channel participation scope for one owner.

**Reject:** Spaces/Folders/Lists/tasks, assigned comments, dashboards, goals, and approval queues as product domains. They would create a parallel work record contrary to Commonspace's contract.

## Deep comparison: Paperclip AI

### Product model

Paperclip is an agent-company control plane. Companies have a goal, hierarchical agent employees, monthly budgets, projects, and a task tree. Issues are atomically checked out to one agent and move through explicit statuses. Managers delegate down a strict reporting tree; agents wake in bounded heartbeats from schedules, assignments, mentions, manual invocation, or approval resolution. [43][44]

This is deliberately unlike Commonspace's non-blocking rooms and same-session continuity. Paperclip's issue is the durable work record; Commonspace's conversation/thread is. That difference is architectural, not a missing feature.

### High-value capabilities

- **Heartbeat contract:** every wake has identity, trigger, assignments, context, checkout, concrete action, durable update, delegation, and status semantics. Run liveness is distinct from task status, preventing process noise from corrupting work state. [44]
- **Cost containment:** provider/model/token/cost events roll up by agent and company; 80% warns and 100% auto-pauses. [47]
- **Human governance:** strategy and optional hiring actions can require approval; the operator can pause/resume/terminate agents, reassign work, and override budgets. [46]
- **Operations dashboard:** agent state, task breakdown, stale work, cost/burn, and recent activity update in real time. [45]
- **Runtime adapters:** local Codex supports ACP or CLI, persistent session state, structured live transcripts, inactivity timeout, worktree strategy, model profiles, managed per-company homes, skill injection, environment tests, and controlled sandbox credential sync. [48]
- **Extensibility:** official documentation exposes adapter, skill, plugin, CLI, API, secret, deployment, and external-task-protocol surfaces. [43]

### What Commonspace should copy, adapt, or reject

**Copy:** bounded run wake reasons; separate run liveness from conversation semantics; inactivity/timeout detection; per-agent and per-run cost; pause/resume; environment tests; persistent adapter state; structured transcript folding; explicit execution workspace/isolation metadata.

**Adapt:** approvals should be narrow, consequence-based run gates (for example destructive shell or external publication), not a generic approval queue. Schedules should post to the owning conversation and wake a native agent session without creating hidden tasks.

**Reject:** companies, CEOs, org charts, goals, issues, assignees, priority/status workflow, atomic task checkout, manager-only delegation, stale-task dashboards, and the “zero-human company” framing.

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
- Inbox is a personal attention queue with unread badges, Primary/Other/Later/Cleared groupings, filters, configurable notification actions, and saved-for-later items. [ClickUp Inbox](https://help.clickup.com/hc/en-us/articles/33947959867543-What-is-the-Inbox) [8][25]
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

- A workspace is one or more folders with workspace-scoped settings and restored UI state; the editor's file, symbol, and navigation affordances operate inside that context. Commonspace Projects already align well with this model. [VS Code editing basics](https://code.visualstudio.com/docs/editor/codebasics), [VS Code workspaces](https://code.visualstudio.com/docs/editing/workspaces/workspaces) [16][17]
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

| Capability                   | Commonspace                                | VS Code                         | Block Buzz                         | Slack                               | ClickUp                           | Paperclip AI                  | Direction                                                                                                    |
| ---------------------------- | ------------------------------------------ | ------------------------------- | ---------------------------------- | ----------------------------------- | --------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Shared agent rooms           | Core                                       | No                              | Core                               | Core                                | Chat                              | No                            | Keep Channels as the differentiating center.                                                                 |
| Exact persistent sessions    | Core                                       | Core                            | ACP/harness-backed                 | Agent/app dependent                 | Agent DMs                         | Adapter-backed                | Preserve native session identity and hard `/new` boundaries.                                                 |
| Multi-agent concurrency      | Core, bounded                              | Parallel sessions/subagents     | Agent orchestration                | Multiplayer agent channels          | Multiple runs                     | Delegated agents              | Preserve non-blocking rooms; add supervision rather than global serialization.                               |
| Live stop/steer/queue        | Missing                                    | Core                            | Activity/permission model          | Needs-attention sessions            | Activate/deactivate, run controls | Pause/resume and run controls | P0. Implement through each native adapter's supported path.                                                  |
| Semantic activity            | Completed trace                            | Rich tool/session UI            | Verb/object/outcome feed           | Agent status, quiet background work | Filtered audit rows               | Run/activity log              | P0. Fold repeated updates in place; keep raw output available.                                               |
| Files and media              | Read-only files + image attach             | Explorer/editor                 | Repos + media + frame comments     | Uploads/previews                    | Attachments/proofing              | Work products/workspaces      | Add explicit Project-file, line, diff, output, and local-media references.                                   |
| Git changes/review           | Unified read-only diff                     | Best-in-class                   | Native Git events/patch/review     | Code channels/integrations          | Integration                       | Workspace/commit evidence     | Bind snapshots and validation to the causative run before adding mutation.                                   |
| Search with receipts         | Channel-only, no citations                 | Code/file/symbol search         | Unified event search               | Global/AI/enterprise citations      | Workspace search                  | Task/activity APIs            | Search DMs, traces, files, decisions, runs; deep-link every hit.                                             |
| Inbox/attention              | Unread replies                             | Session/status view             | Unread/audit substrate             | Activity/recap/needs attention      | Inbox + activity                  | Dashboard/blocked/stale       | Expand Inbox without creating task status.                                                                   |
| Agent profile/catalog        | Native capabilities + basic settings       | Custom agents/skills            | Persona/identity                   | Agents & tools                      | AI Hub is strongest               | Agent/org/adapters            | Build one truthful profile for identity, instructions, tools, skills, services, memory, model, status, cost. |
| Automation/triggers          | Missing                                    | Commands/tasks/extensions       | Message/reaction/schedule/webhook  | Workflow Builder                    | Rich Super Agent triggers         | Heartbeats/routines           | Add conversation-owned schedules and event triggers, not hidden tasks.                                       |
| Cost/budget                  | Trace-level where provider reports         | Usage/context indicators        | Audit-oriented                     | Plan/admin dependent                | Per-agent analytics               | Strong caps/auto-pause        | Add per-run/agent/project cost first; optional guardrails later.                                             |
| Durable context              | Project paths, channel instructions/memory | Workspace Markdown/instructions | Canvases/event history             | Canvas                              | Docs/knowledge/memory             | Goals/projects/docs/issues    | Add lightweight briefs and pinned decisions, optionally repository-backed.                                   |
| Approvals                    | None                                       | Edit/tool confirmations         | Workflow/review approvals evolving | Code sign-off/app approval          | Product/task approvals            | Core governance               | Only consequence-based runtime gates fit Commonspace.                                                        |
| Task/org hierarchy           | Intentional non-goal                       | Not central                     | Not central                        | Adjunct lists/workflows             | Product core                      | Product core                  | Do not copy. Conversation/thread remains the work record.                                                    |
| Multi-human enterprise admin | Intentional non-goal                       | Workspace trust                 | Identity/community model           | Extensive                           | Extensive                         | Multi-user/operator roles     | Defer unless product direction changes.                                                                      |

## Recommended delivery order

### P0 — Supervise and verify live work

1. **Live run control and semantic activity**
   - Stream provider activity into stable verb/object/outcome rows instead of appending duplicate status noise.
   - Add Stop through each adapter's supported cancellation path; then queue, steer, stop-and-send, and pending-message reorder.
   - Show running, silent, timed-out, failed, completed, and needs-input states. Keep unrelated agent sessions concurrent.
   - Preserve raw provider events behind progressive disclosure and never expose native session IDs or secrets.

2. **Run-linked change and validation snapshots**
   - Snapshot repository state at turn start and completion so pre-existing and observed changes are distinct.
   - Attach changed-file counts, unified diffs, branch/base information, commands, exit status, tests, diagnostics, and browser evidence to the reply that caused them.
   - Add file/line deep links and “open in editor.” Do not add stage/commit/discard until attribution is trustworthy.
   - **Implemented:** Agent replies now persist bounded per-root before/after Git attribution with separate pre-existing and observed files, exact run-only patches, branch/base receipts, stable diff anchors, and validated “open in editor” targets. Provider command, test, diagnostic, and browser receipts remain bound to the same reply through its native trace.

3. **Session supervision and attention**
   - Expand Inbox from unread replies to mentions, failures, completions, timeouts, and requests for input.
   - Add a compact session view filtered by running/needs-attention/completed and grouped by Project/Channel/agent.
   - Add stable links to root messages, replies, runs, files, and diff anchors; support follow/mute and save-for-later.
   - **Implemented:** Inbox now classifies those attention events, provides persisted save-for-later, and includes a session supervisor grouped by Project/Channel/agent with running, needs-attention, and completed filters plus persisted follow/mute controls. Session rows and attention items deep-link to their source message or thread; file and diff anchors remain part of run-linked snapshots above.

### P1 — Make context explicit and agents legible

4. **Unified search with receipts**
   - Search Channels, DMs, Projects, Agents, replies, traces, files, briefs, and decisions.
   - Filter by conversation, author, date, agent, run status, and object type.
   - Return highlighted snippets and stable source links; summaries must cite the messages/files they used.

5. **Tag-first context references**
   - Use visible conversation tags as the primary context language: `@agent`, `@@project`, and `#channel`.
   - A valid `@@project` tag authoritatively selects the Project context for a new message or thread; existing thread context remains immutable.
   - Files, diffs, validation receipts, and prior results should become taggable conversation artifacts rather than path-entry forms or a parallel attachment workflow.
   - **Implemented:** Composer autocomplete, rendered references, persistent tag text, explicit agent routing, and authoritative Project context selection from `@@project`. The composer visibly teaches the tag grammar. Artifact-level tagging remains incremental work.

6. **Unified agent profile**
   - Present Commonspace alias/appearance separately from native identity.
   - Show native instructions, model/reasoning, tools, MCP, skills, services, memory policy, session/context status, last runs, and reported cost.
   - Add environment/capability health checks and activate/deactivate controls only where the harness supports them.
   - Write settings through official native mechanisms and verify every write; never copy credentials into Commonspace state.
   - **Implemented:** Profiles expose alias/appearance, native model/reasoning/fast mode, unified instructions, tool controls, MCP, skills, services, memory and permission policy, session health, recent runs, token usage, and reported cost. Hermes writes use supported CLI/config mechanisms with readback and rollback; unsupported Codex-native controls remain visibly read-only.

### P2 — Add conversation-native automation and durable knowledge

7. **Conversation-owned schedules and triggers**
   - Support manual, schedule, message, mention, reaction, and webhook wake reasons incrementally.
   - Every trigger belongs to a visible Project/Channel/DM, posts an auditable event, and resumes or creates an explicit native session according to clear rules.
   - Add bounded inactivity handling and optional cost/run limits; avoid hidden polling and hidden task queues.

8. **Project/Channel brief and pins**
   - Lightweight Markdown for purpose, constraints, decisions, open questions, and references.
   - Version history, pins, comments, source links, and explicit agent-readable inclusion.
   - Allow opt-in repository backing; otherwise keep it in sanitized Commonspace state.

9. **Composer and message actions**
   - Render the same safe Markdown subset for user and agent messages; add preview/formatting help without hiding Markdown.
   - Add copy link/text, save, pin, thread follow/mute, and conservative edit/delete semantics with visible history or tombstones.

10. **Export/import and retention**
    - Export non-secret Projects, Channels, DMs, messages, threads, briefs, triggers, and run summaries.
    - Sanitize host paths and native sessions; define deletion and retention semantics before changing storage architecture.

### Explicitly out of scope

- A ClickUp/Paperclip-style company, goal, issue, assignee, priority, status, approval-queue, or org-chart domain.
- Buzz's Nostr/cryptographic identity and Git hosting.
- Slack's marketplace, calls, enterprise directory, and multi-human administration.
- VS Code editor/debugger/terminal/source-control mutation parity.

## Product acceptance criteria for the next milestone

A user should be able to:

1. Start two independent agent sessions and see both without one blocking the other.
2. Watch meaningful live activity, distinguish silence from work, and stop or steer either run.
3. See exactly which files and validation results belong to each run, separate from pre-existing worktree changes.
4. Open a diff tied to the causative reply, then reference a file, line range, diff, or test result in a follow-up.
5. Leave the conversation and later find the session by agent, Project, status, message text, file, or decision.
6. Find new replies, mentions, failures, timeouts, completions, and input requests in one attention surface.
7. Inspect an agent before invoking it and understand its native model, tools, skills, integrations, memory policy, session state, and reported cost without exposing credentials.

Meeting those criteria would combine Buzz's shared human-agent rooms and unified work record, VS Code's session/review loop, Slack's attention and retrieval, ClickUp's legible agent profiles, and Paperclip's runtime governance—without abandoning Commonspace's local-first, conversation-primary, native-session model.

## Sources

[1] https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions
[2] https://slack.com/help/articles/202528808-Search-in-Slack
[3] https://slack.com/help/articles/202288908-Format-your-messages-in-Slack
[4] https://slack.com/help/articles/360059928654-How-to-use-Slack--your-quick-start-guide
[5] https://slack.com/help/articles/201355156-Configure-your-Slack-notifications
[6] https://slack.com/help/articles/203950418-Use-a-canvas-in-Slack
[7] https://slack.com/help/articles/4402059015315-Use-huddles-in-Slack
[8] https://help.clickup.com/hc/en-us/articles/6325918957335-Notification-settings
[9] https://code.visualstudio.com/docs/agents/overview
[10] https://code.visualstudio.com/docs/agents/run/review-code-edits
[11] https://code.visualstudio.com/docs/chat/chat-overview
[12] https://code.visualstudio.com/docs/agents/reference/ai-features-cheat-sheet
[13] https://code.visualstudio.com/docs/editor/versioncontrol
[14] https://code.visualstudio.com/docs/languages/markdown
[15] https://code.visualstudio.com/docs/terminal/basics
[16] https://code.visualstudio.com/docs/editor/codebasics
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
[30] https://code.visualstudio.com/docs/agent-customization/custom-agents
[31] https://code.visualstudio.com/docs/agent-customization/agent-skills
[32] https://code.visualstudio.com/docs/agent-customization/custom-instructions
[33] https://code.visualstudio.com/docs/agents/run/subagents
[34] https://code.visualstudio.com/docs/agents/concepts/sessions
[35] https://help.clickup.com/hc/en-us/articles/20011540694551-Automate-StandUps-with-Brain-AI
[36] https://help.clickup.com/hc/en-us/articles/37092796379927-Super-Agent-instructions-triggers-skills-knowledge-and-memory
[37] https://help.clickup.com/hc/en-us/articles/37131966192151-Use-ClickUp-Agents-in-Chat
[38] https://slack.com/help/articles/360035692513-Guide-to-Slack-Workflow-Builder
[39] https://slack.com/help/articles/33777191777043-Create-and-share-custom-channel-templates
[40] https://github.com/block/buzz
[41] https://block.xyz/inside/introducing-buzz-where-humans-and-agents-work-together
[42] https://github.com/block/buzz/blob/main/VISION_ACTIVITY.md
[43] https://paperclip.ing/docs
[44] https://github.com/paperclipai/paperclip/blob/master/docs/start/core-concepts.md
[45] https://github.com/paperclipai/paperclip/blob/master/docs/guides/board-operator/dashboard.md
[46] https://github.com/paperclipai/paperclip/blob/master/docs/guides/board-operator/approvals.md
[47] https://github.com/paperclipai/paperclip/blob/master/docs/guides/board-operator/costs-and-budgets.md
[48] https://paperclip.ing/docs/adapters/codex-local
[49] https://slack.com/help/articles/33076000248851-Work-with-AI-agents-in-Slack
[50] https://slack.com/help/articles/25076892548883-Guide-to-AI-features-in-Slack
[51] https://slack.com/features/code-channels
[52] https://slack.com/features/enterprise-search
[53] https://code.visualstudio.com/docs/agents/run/sessions/manage-sessions
[54] https://code.visualstudio.com/docs/agents/run/agent-harnesses
[55] https://code.visualstudio.com/docs/agents/best-practices
[56] https://help.clickup.com/hc/en-us/articles/36455020912919-Super-Agents-Activity
[57] https://help.clickup.com/hc/en-us/articles/36960637050135-Manage-and-edit-Super-Agent-profiles
[58] https://help.clickup.com/hc/en-us/articles/36954958035863-AI-Hub
