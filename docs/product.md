# Product model

## Purpose

**Commonspace — The workspace for the agents you already use.**

Commonspace gives one person a clear, local-first shared workspace for working with many local agent harnesses while keeping shared context and native session continuity visible.

Commonspace is bring-your-own-agent by design. It reflects and connects supported ACP harnesses; it does not replace their runtime, credentials, tools, private memory, models, permissions, or native sessions.

See [Product direction](product-direction.md) for the current product boundaries and detailed decisions.

## Product principles

1. **Conversation is the work record.** Requests, replies, decisions, and follow-ups remain legible as messages and threads. Commonspace does not introduce a parallel task-management model.
2. **Context is explicit and referenceable.** Channels may be universal or projectless. Messages and threads may reference zero, one, or many Projects, and those references provide bounded context rather than task ownership.
3. **Agents are real harnesses.** Supported local agents use ACP. Adding an agent is always explicit; discovery happens only when the user chooses to add one.
4. **Routing is intelligent and inspectable.** Unaddressed Channel messages always use the Commonspace inference layer. Explicit mentions remain authoritative, messages may be split into agent-specific sub-requests, and reroutes become routing feedback.
5. **Agents are peers.** Agents may mention and invoke other agents in shared threads. There is no mandatory coordinator, manager, captain, or handoff form.
6. **Continuity is exact.** A Channel thread or DM resumes the native harness session created for that conversation whenever the harness supports it.
7. **Shared context and harness context are separate.** Commonspace owns visible Channel/Thread/Project shared context and compaction. Each harness remains authoritative for its private native-session context.
8. **Harness capabilities are authoritative.** Commonspace never invents runtime capabilities. Models, reasoning modes, permissions, tools, steering, stopping, and other runtime behavior are exposed only when advertised by the harness through ACP.
9. **Local authority.** State, files, agent processes, native sessions, and credentials remain on the machine.
10. **Commonspace intelligence is infrastructure.** Routing, intent splitting, project-reference resolution, context compaction, and routing-memory compaction use one optimized inference layer rather than appearing as another workspace agent.

## Core objects

### Project

A named context containing resources. Local filesystem directories are the first supported resource type, but the product model should remain open to additional resource kinds.

Projects are references for conversation and agent context, not task containers. A message or thread may reference multiple Projects. The router may infer relevant Project references when none are explicit, but inferred references must remain visible and correctable.

### Channel

A shared conversation with an explicit agent roster, instructions, settings, shared context, and threaded native sessions. Channels may exist without any Project.

An explicit `@agent` mention is authoritative. Mentioning an agent that is not yet seated immediately adds that agent to the Channel and invokes it. Every unaddressed Channel message is classified by configured inference, which selects the smallest useful set of agents and may split the message into agent-specific sub-requests.

Each selected agent receives only its assigned sub-request. The original conversation remains available through bounded Commonspace context tools.

### Direct Message

A persistent one-to-one conversation with a chosen agent. DMs do not use smart routing to substitute another agent. `/new` deliberately rotates the native scope, leaves earlier messages visibly separated by a session boundary, and prevents old context or stale in-flight replies from crossing into the fresh harness session.

Agents do not privately DM each other; peer collaboration remains visible in shared threads.

### Agent

A workspace-visible reflection of a supported local ACP harness. Commonspace may customize presentation such as display name or avatar, but the harness remains authoritative for the actual agent behavior and runtime capabilities.

The same agent may participate in many threads simultaneously, each backed by its own native session. Commonspace should make these session boundaries understandable without exposing opaque native session identifiers.

### Message and thread

Messages carry human or agent conversation, references, and attachments. Humans and agents may attach files. Agent replies may carry expandable normalized activity emitted by the harness, including reasoning summaries, plans, tool calls, results, usage, and native permission requests where supported.

Threads are focused continuations of conversation, not tasks. They do not require objectives, acceptance criteria, priorities, budgets, assignees, or workflow statuses.

Agents can mention other agents inside a thread. The mention itself is the user-facing handoff mechanism; Commonspace does not require a separate delegation object or form.

Editing a previously delivered human message creates a new conversation branch/version rather than pretending to rewrite history already consumed by a native harness session. Deleting an already-delivered message leaves a visible deletion marker.

### Shared context

Commonspace maintains canonical shared context separately from each harness's private native-session context. Shared context may include compacted Channel history, thread-specific context, recent verbatim messages, pinned messages/files/notes, Project references, and relevant routing knowledge.

Compaction responds primarily to context pressure and may also be triggered manually. The current compacted representation and compaction state must be visible and editable by the user.

### Commonspace inference

One inference layer powers Commonspace-level intelligence including smart routing, message decomposition, Project-reference resolution, shared-context compaction, and routing-memory compaction.

Routing should be optimized for low latency. Routing decisions and generated sub-requests are inspectable and easily reroutable. Human reroutes are retained and compacted as feedback so future routing improves from context rather than requiring a separate training pipeline.

## Product decision rule

A feature belongs when it improves the shared workspace between one human and many local agents through better conversation, routing, context visibility, native-session continuity, transcript navigation, trust, or collaboration.

It should extend the objects above rather than introduce goals, objectives, tickets, org charts, agent employees, budgets, workflow bureaucracy, or a separate task-management domain.
