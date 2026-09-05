# Commonspace product direction

Commonspace helps one person work with several local agents in a shared conversation. This document explains what belongs in the product and who controls each part of the experience.

Read the [Product model](product.md) for the main concepts and the [Product specification](product-spec.md) for exact behavior and acceptance requirements. The [Roadmap](roadmap.md) separates implemented capabilities from release work and later ideas.

## Positioning

**Commonspace — The workspace for the agents you already use.**

Commonspace is an MIT-licensed, local-first workspace for the agents a person already uses.

An **agent runtime**, also called a **harness**, is the local software that runs an agent and manages its tools, credentials, model, private context, and sessions. Commonspace connects supported runtimes and provides the conversation around them. The runtime continues to control how the agent works.

Conversation is the work record. Requests, replies, decisions, and follow-ups belong in messages and threads. Goals, objectives, org charts, employees, managers, budgets, tickets, and separate task or workflow systems are outside the product boundary.


## Product boundary

Commonspace owns:

- Projects and project references.
- Channels, Direct Messages, messages, and threads.
- Agent appearance inside the workspace.
- Routing: choosing agents and dividing a request into the parts each agent needs.
- Shared context, summaries of that context, and knowledge learned from routing corrections.
- Native-session mapping and continuity.
- A consistent presentation of activity exposed through the Agent Client Protocol (ACP).
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

ACP is the protocol Commonspace uses to communicate with supported local runtimes. **Commonspace exposes only the capabilities a runtime advertises through ACP.** A control must not imply that an agent can do something its runtime does not support.

## Supported agents

Commonspace supports known local agent runtimes that expose ACP. Supporting a command-line program requires a first-party integration; being installed on the machine is not enough.

Agent addition is always explicit:

1. The user chooses to add an agent.
2. Commonspace scans for the supported Codex installation and existing Hermes profiles only during that flow.
3. The user manually selects and adds the desired agent.
4. The user can customize workspace appearance, such as display name or avatar, without changing the underlying runtime identity.

The local service is the foundation for distribution. A browser/CLI experience and a future desktop application should use that same service and data model. See the [Product specification](product-spec.md#61-workspace-and-lifecycle) for release targets.

## Conversation model

### Channels

Channels are shared rooms with a chosen set of agents. A Channel may have no Project; for example, a general discussion Channel can span several codebases or none.

Agents normally participate through smart routing or explicit mentions.

### Direct Messages

A DM means one human talking directly to one chosen agent. Smart routing does not select a different agent in a DM. Agents do not privately DM each other.

### Threads

Threads are focused continuations of conversation, not tasks. They do not require objectives, acceptance criteria, priorities, statuses, budgets, or ownership fields.

The same workspace agent can participate in many threads at once. Each thread uses a separate session owned by the runtime, called a **native session**. Commonspace should explain those boundaries without showing the private session identifiers.

## Smart routing

Smart routing is always enabled for unaddressed Channel messages.

Commonspace uses one configured inference provider to choose agents, divide requests, identify relevant Projects, and summarize shared context and routing corrections. This is an internal service function; it does not appear as another agent in the workspace.

For example, a request to review an API change and update its user guide may produce two assignments. Each agent receives the relevant part of the request, and both replies appear in the same thread.

Routing rules:

1. Explicit `@agent` mentions are authoritative.
2. If a message mentions agents that are not yet in the channel, Commonspace immediately adds them to the channel and invokes them.
3. A message may be decomposed into separate agent-specific sub-requests.
4. Each agent's new turn receives only its assigned sub-request. The full original message remains in the conversation.
5. Shared thread context remains available through Commonspace context tools.
6. Without explicit mentions, inference selects the smallest useful set of agents for the request.
7. Prefer one best-fit agent when one agent is sufficient.
8. Select multiple agents when the request clearly spans distinct responsibilities.
9. The service stores routing decisions and sub-requests so it can dispatch work, attach replies to the correct assignment, diagnose problems, and retain corrections.
10. The service can correct one assignment without resending the others. Completed routing details and inline correction controls are deferred from the conversation UI; pending and failed routing remain visible.
11. Corrections are stored as feedback and summarized into routing knowledge for later decisions.
12. Project references and channel/thread context are inputs to routing.
13. Routing should feel effectively immediate; sub-second latency is the target where practical.

Different native sessions may run concurrently. Commonspace serializes calls to the same native session and leaves the runtime's execution policy to the runtime.

## Agent-to-agent conversation

Agents are peers. An agent can mention another agent in a shared thread to invoke it there. This does not require a coordinator, captain, manager, or handoff form.

A visible `@agent` mention is the user-facing handoff mechanism.

Commonspace may stop repeated mention cycles that would otherwise loop indefinitely. Those safeguards do not give Commonspace control over the runtime's execution policy.

## Projects

Projects are references and context containers, not task containers.

A Project identifies resources the agents can use as context. v0.0.1 supports local folders. The model should leave room for other resource types later.

Channels do not need to belong permanently to one Project. A message or thread may reference zero, one, or many Projects. Project references are context for the conversation.

The router may infer Project references from conversation context when none are explicit. Inferred Project references must remain visible and correctable.

When one message is split across agents, the router decides which Project references are relevant to each sub-request.

## Shared context

Shared context is the information Commonspace makes available to participants in a conversation. It is stored separately from each runtime's private session context.

Shared context may include:

- Summarized Channel history.
- Thread-specific context.
- Recent verbatim messages.
- Pinned messages, files, and notes.
- Project references.
- Relevant routing knowledge.

Each thread records the Channel context available when it begins and then maintains its own context. Agents can inspect newer Channel context separately; later Channel changes must not rewrite the thread's starting snapshot.

### Context compaction

**Compaction** summarizes context so it fits within an agent's input limits. It should respond primarily to estimated token pressure rather than an arbitrary message count. Users can also run compaction manually.

The same Commonspace inference layer used for routing performs compaction.

Users must be able to read and edit the summary, see which source messages it covers, and tell whether it is current, stale, being compacted, or failed. Automatic updates must preserve human edits.

The UI should make it possible to inspect what Commonspace-level Project, Channel, and Thread context is available to an agent.

Agent-suggested durable context is not a v0.0.1 requirement.

## Messages and attachments

Humans and agents can attach files to messages. Supported harness-generated files should render as normal Commonspace attachments.

Editing a delivered human message creates a visible conversation branch from that point and may route the corrected request again. The original message and its replies remain available because the runtime has already received them. Agent replies remain immutable.

Deleting a delivered message should leave a visible deletion marker because the runtime has already received it.

Reactions are not required for v0.0.1.

## Harness activity and controls

Commonspace translates ACP events into a consistent activity view. Raw terminal output and runtime debugging remain in the runtime itself.

Where the harness exposes them through ACP, Commonspace should render:

- Reasoning summaries.
- Plans.
- Tool calls and results.
- Usage.
- Model/reasoning information.
- Permission requests and the harness-provided permission choices.
- Controls for stopping a session or sending guidance while it runs.

Activity may stream live but should remain compact/collapsed by default.

## Workspace UX

The workspace should provide:

- Unread state.
- Mentions/relevant-activity inbox.
- Global search across messages, threads, channels, agents, and Projects.
- Pinned shared context.
- Context inspector and compaction state.
- Desktop notifications for replies, mentions, permission requests, and failures.
- Background local service so closing the UI does not terminate active sessions.
- Exact native-session resumption after Commonspace or machine restart whenever the harness supports it.
- Open export/import of workspace data.

People should find and understand agents through DMs, Channel membership, mentions, and session indicators. A separate agent-management dashboard or standalone profile page is outside the current scope.

## Files and code surfaces

Commonspace may show Project files and Git changes to help people review agent work. It may also show test and verification results emitted by the runtime. Git operations, command execution, and runtime debugging remain outside these read-oriented views.

## Extensibility

Support known ACP runtimes through first-party integrations and stabilize the internal runtime interface before considering a generic plugin system.

## License

Commonspace remains MIT licensed.

## Decision filter

A feature belongs when it improves conversation, routing, shared context, session continuity, discoverability, trust, or collaboration between one person and their local agents.

Before adding a feature, identify the user problem, the existing Commonspace object that owns it, and the behavior that would prove it solved. Changes to the product boundary require an explicit product decision.
