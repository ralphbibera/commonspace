# Commonspace product direction

Commonspace is a local-first workspace for one person working with local agent runtimes. This page defines the product boundary. Read the [Product model](product.md) for concepts, the [Product specification](product-spec.md) for exact behavior, and the [Roadmap](../../ROADMAP.md) for current work.

## Positioning

**Commonspace — The workspace for the agents you already use.**

Commonspace puts several local coding agents around one visible conversation. Conversation is the work record; Commonspace supplies shared context, routing, continuity, and review surfaces around the runtimes.

An **agent runtime**, or **harness**, is the local software that runs an agent. It owns the agent's tools, credentials, models, permissions, private context, and native sessions. Commonspace connects supported runtimes through the **Agent Client Protocol (ACP)**. Read-only capability browsing also uses native inventory sources, with explicit provenance and coverage limits; native configuration and memory contents remain private.

## Commonspace owns

- Projects and visible Project references.
- Channels, Direct Messages, messages, and Threads.
- Agent membership, workspace presentation, and conversation state.
- Routing, shared context, native-session mapping, and continuity.
- Attachments, search, Inbox state, notifications, and workspace export/import.

## The harness owns

- Native identity and execution behavior.
- Models, reasoning modes, tools, and permission semantics.
- Native session internals, private context, and transcripts.
- Runtime-specific configuration, credentials, and raw debug output.

Commonspace must not invent a runtime capability, copy private runtime data, or turn a harness feature into a new product object without an explicit product decision.

## Product boundary

- Local service and desktop-browser experience are the current product surface.
- Agent addition is explicit. Commonspace supports only first-party integrations for known ACP runtimes; see the [support matrix](../start/support.md).
- Agents are peers in shared conversations. There is no coordinator, org chart, task hierarchy, or separate handoff system.
- Projects provide context; they do not own tasks, Channels, or agent copies.
- Desktop is the current UI target. Mobile and narrow-layout support require a separate product decision.
- Commonspace is not a hosted team service, model provider, IDE, or Git client.

## Decision filter

A feature belongs when it improves conversation, routing, shared context, session continuity, discoverability, trust, or collaboration between one person and their local agents.

Before adding one, identify the user problem, the existing Commonspace object that owns it, and the behavior that proves it solved. Changes to this boundary require an explicit product decision.
