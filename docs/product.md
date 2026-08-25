# Product model

## Purpose

Commonspace is a local-first place for one human to work with reusable coding agents without leaving DeepSeek Harness Web. It turns filesystem context, agent identity, and conversation history into four understandable objects instead of exposing raw CLI sessions.

## Product principles

1. **Local authority.** Files, state, credentials, and agent processes stay on the local machine.
2. **Real agents, not decorative personas.** Hermes profiles are discovered; Codex CLI and Claude Code agents are added explicitly.
3. **Context is visible.** Projects, channel membership, model overrides, reasoning, and memory are inspectable in the interface.
4. **Threads are execution boundaries.** Every Channel root creates one native agent session; its replies resume that exact session.
5. **Direct means persistent.** A DM resumes one native scope until the user deliberately runs `/new`.
6. **Native, reversible integration.** Commonspace occupies public DSH slots and reveals untouched Workspaces when switched off.

## Core objects

### Project

A named set of one or more canonical filesystem directories. The first directory is the process working directory; the rest are additional writable context where the adapter supports it.

### Channel

A Project-scoped room with explicit agent membership, instructions, model/reasoning overrides, and projected memory. A valid `@agent-id` targets seated agents. Without a valid mention, the root is routed to the roster, bounded by the configured per-turn limit.

### Direct Message

A one-to-one conversation with an agent. The current DM scope is host-private. `/new` clears only that transcript, rotates the scope, and prevents an old in-flight reply from appearing in the new chat.

### Agent

Either a discovered Hermes profile or an explicit Codex CLI/Claude Code definition. Identity is stable and namespaced; adapter, model, availability, and display name remain visible presentation metadata.

## Primary journeys

### Start shared work

1. Add a Project and one or more workspace paths.
2. Create a Channel and choose its agents.
3. Add Channel instructions and optional model/reasoning overrides.
4. Post a root task.
5. Open its thread to inspect or continue the exact native session.

### Start a private conversation

1. Use **+** beside Direct Messages.
2. Search by agent name, ID, adapter, or model.
3. Select an agent and send a message.
4. Use `/status`, `/retry`, or `/new` without forwarding those commands to the model.

### Add another runtime

1. Use **+** beside Agents.
2. Pick Codex CLI or Claude Code.
3. Give the agent a name and optional model.
4. Seat it in a Channel or open a DM.

## Command behavior

Commands are local control operations. Unknown slash commands are rejected rather than sent as prompts.

- `/help` — context-aware command list.
- `/new` — DM-only fresh transcript and native scope.
- `/retry` — resend the latest user turn in the current conversation/thread.
- `/status` — local runtime, model, and context summary.
- `/agents` — visible local roster.

Aliases are documented in the README and resolved case-insensitively.

## Current product boundary

Commonspace is single-user, local-only, and non-streaming. It does not add federation, voice, multi-user authentication, hosted agent runtimes, GitHub workflow management, or another web application. Those omissions are deliberate, not placeholders hidden behind inactive controls.
