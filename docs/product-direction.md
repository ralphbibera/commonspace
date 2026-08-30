# Commonspace product direction

This document records the current product direction and should override speculative comparator research when the two conflict.

## Positioning

**Commonspace — The workspace for the agents you already use.**

Commonspace is a fully open-source, MIT-licensed, local-first shared workspace for one human and many local agent harnesses. It is bring-your-own-agent by design: Commonspace does not replace the agent runtime, credentials, tools, memory, model, or native session. It provides the shared workspace around those agents.

Commonspace is not a company simulator, task manager, orchestration dashboard, or workflow engine. It should not introduce goals, objectives, org charts, employees, managers, budgets, tickets, or a parallel work-management domain.

Conversation is the product and the work record.

## Product boundary

Commonspace owns:

- Projects and project references.
- Channels, Direct Messages, messages, and threads.
- Agent appearance inside the workspace.
- Smart routing and message decomposition.
- Shared context, context compaction, and routing memory.
- Native-session mapping and continuity.
- Normalized harness activity exposed through ACP.
- Conversation attachments, search, unread state, notifications, and export/import.

The connected harness owns:

- The actual agent identity and behavior.
- Runtime execution and concurrency.
- Models and reasoning modes.
- Permissions and permission semantics.
- Tools and tool behavior.
- Native session internals and private compaction.
- Raw terminal/debug output.
- Runtime-specific configuration and credentials.

Hard rule: **Commonspace never invents runtime capabilities. It exposes what the harness advertises through ACP.**

## Supported agents

Commonspace supports known local agent harnesses that expose ACP. It is not a generic arbitrary-CLI wrapper.

Agent addition is always explicit:

1. The user chooses to add an agent.
2. Commonspace scans for supported harnesses only during that flow.
3. The user manually selects and adds the desired agent.
4. Commonspace may customize only workspace appearance such as display name or avatar without changing the underlying harness identity.

Commonspace should remain platform-agnostic. Distribution should support both a desktop application and a local browser/CLI experience over the same local service.

## Conversation model

### Channels

Channels are shared rooms. They may exist without a Project. `#general`-style universal channels are first-class.

Agents normally participate through smart routing or explicit mentions.

### Direct Messages

A DM means one human talking directly to one chosen agent. Smart routing does not select a different agent in a DM. Agents do not privately DM each other.

### Threads

Threads are focused continuations of conversation, not tasks. They do not require objectives, acceptance criteria, priorities, statuses, budgets, or ownership fields.

The same workspace agent can participate in many threads at once, with each thread mapped to its own native harness session. Commonspace should make those separate sessions understandable without exposing opaque native session IDs.

## Smart routing

Smart routing is always enabled for unaddressed Channel messages.

There is one Commonspace inference layer used for routing, intent splitting, project-reference resolution, context compaction, and routing-memory compaction. It should be optimized for low latency and treated as infrastructure, not as a visible workspace agent.

Routing rules:

1. Explicit `@agent` mentions are authoritative.
2. If a message mentions agents that are not yet in the channel, Commonspace immediately adds them to the channel and invokes them.
3. A message may be decomposed into separate agent-specific sub-requests.
4. Each agent receives only its assigned sub-request, not the full original message.
5. Shared thread context remains available through Commonspace context tools.
6. Without explicit mentions, inference selects the smallest useful set of agents for the request.
7. Prefer one best-fit agent when one agent is sufficient.
8. Select multiple agents when the request clearly spans distinct responsibilities.
9. Routing decisions and generated sub-requests must be inspectable.
10. Users can reroute a sub-request easily when routing is wrong.
11. Reroutes are stored as feedback and compacted into routing knowledge so future routing improves.
12. Project references and channel/thread context are inputs to routing.
13. Routing should feel effectively immediate; sub-second latency is the target where practical.

Commonspace should not impose agent concurrency or execution limits that belong to the harness.

## Agent-to-agent conversation

Agents are peers. An agent can mention another agent in a shared thread, which invokes that agent in the same thread. There is no mandatory coordinator, captain, manager, or handoff form.

A visible `@agent` mention is the user-facing handoff mechanism.

Commonspace may protect the workspace against pathological repeated message cycles, but it should not pretend to own the harness's execution policy.

## Projects

Projects are references and context containers, not task containers.

A Project may contain abstract resources. Local filesystem folders are the first supported resource type, but the model should allow additional resource kinds later.

Channels do not need to belong permanently to one Project. A message or thread may reference zero, one, or many Projects. Project references are context for the conversation.

The router may infer Project references from conversation context when none are explicit. Inferred Project references must remain visible and correctable.

When one message is split across agents, the router decides which Project references are relevant to each sub-request.

## Shared context

Commonspace owns a canonical shared-context layer that is separate from each harness's private native-session context.

Shared context may include:

- Compacted Channel history.
- Thread-specific context.
- Recent verbatim messages.
- Pinned messages, files, and notes.
- Project references.
- Relevant routing knowledge.

Each thread inherits the current Channel shared context when it begins and then maintains thread-specific context while still being able to inspect newer shared context when needed.

### Context compaction

Compaction should primarily respond to context/token pressure rather than arbitrary message counts. Users can also trigger compaction manually.

The same Commonspace inference layer used for routing performs compaction.

Context state must be visible. Users should be able to inspect the current compacted representation, understand its compaction state, and manually edit it.

The UI should make it possible to inspect what Commonspace-level Project, Channel, and Thread context is available to an agent.

Agent-suggested durable context is not a v0.1 requirement.

## Messages and attachments

Humans and agents can attach files to messages. Supported harness-generated files should render as normal Commonspace attachments.

Message editing should behave like ChatGPT-style branching/versioning. Editing a message after delivery must not pretend to rewrite an already-consumed native harness turn. The edited version creates a new conversation branch from that point and may be routed again.

If a delivered message is deleted, Commonspace should preserve a visible deletion marker rather than pretending the harness never saw it.

Reactions are not required for v0.1.

## Harness activity and controls

Commonspace presents normalized ACP activity, not raw harness terminal output. Raw debugging remains in the harness itself.

Where the harness exposes them through ACP, Commonspace should render:

- Reasoning summaries.
- Plans.
- Tool calls and results.
- Usage.
- Model/reasoning information.
- Permission requests and the harness-provided permission choices.
- Session stopping/steering or related controls.

Activity may stream live but should remain compact/collapsed by default.

## Workspace UX

Near-term collaboration fundamentals include:

- Unread state.
- Mentions/relevant-activity inbox.
- Global search across messages, threads, channels, agents, and Projects.
- Pinned shared context.
- Context inspector and compaction state.
- Desktop notifications for replies, mentions, permission requests, and failures.
- Background local service so closing the UI does not terminate active sessions.
- Exact native-session resumption after Commonspace or machine restart whenever the harness supports it.
- Open export/import of workspace data.

Do not add an agent-management dashboard or standalone agent profile pages merely because agents exist. Agent identity should remain natural through DMs, channel membership, mentions, and session indicators.

## Files and code surfaces

Commonspace may expose Project files and Git changes as context/review surfaces, but it should not become a Git client or execution manager. Tests and verification results are useful to surface when the harness emits them. Runtime debugging belongs in the harness.

## Extensibility

Do not build a generic plugin system yet. Support known ACP harnesses through first-party integrations and stabilize the internal harness interface first.

## License

Commonspace remains MIT licensed.

## Decision filter

A feature belongs when it makes the shared workspace between one human and many local agents better by improving conversation, routing, shared context, session continuity, discoverability, trust, or collaboration.

A feature does not belong merely because Paperclip, ClickUp, Slack, Buzz, or another comparator has it.

When in doubt, ask:

> Does this make Commonspace a better shared workspace for the agents the user already uses, or does it turn Commonspace into a manager for those agents?

Prefer the former.
