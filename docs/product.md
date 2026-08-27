# Product model

## Purpose

Commonspace gives one person a clear, local place to converse with reusable coding agents while keeping project context and native session continuity visible.

## Product principles

1. **Conversation is the work record.** Requests, replies, decisions, and follow-ups remain legible as messages and threads.
2. **Context has a visible home.** Every shared conversation belongs to a Project and every Project identifies its filesystem context.
3. **Agents are real runtimes.** Discovery finds installed Hermes profiles, but only profiles the user explicitly adds become Commonspace agents. Hermes and Codex run through native ACP sessions.
4. **Continuity is exact.** A Channel thread or DM resumes the native session created for that conversation.
5. **Local authority.** State, files, agent processes, and credentials remain on the machine.
6. **Control operations stay local.** Slash commands change Commonspace state and are never forwarded as prompts.

## Core objects

### Project

A named context containing one or more canonical filesystem directories. The first directory is the working directory; supported agents receive the others as additional context.

### Channel

A Project-scoped shared conversation with an explicit agent roster, instructions, settings, and projected memory. An `@agent-id` mention targets a seated agent. A message without a valid mention routes to the Channel roster within the configured limit.

### Direct Message

A persistent one-to-one conversation with an agent. `/new` deliberately rotates the native scope, leaves earlier messages visibly separated by a session boundary, and prevents both old context and stale in-flight replies from crossing into the fresh harness session.

### Agent

A stable identity backed by Hermes or Codex. Discovered Hermes profiles remain candidates until the user adds them. Runtime, display name, model, reasoning, and availability remain visible. Every runtime receives only the new message; bounded shared context remains available through native Commonspace tools.

### Message and thread

Messages carry user intent and agent results. Agent replies may also carry an expandable audit of the reasoning summaries, plans, tool calls, results, and usage emitted by their native harness. Commonspace preserves this activity without pretending to own or replace the harness. A Channel root creates one native session; replies continue it. This is the product's unit of work and context handoff.

## Product decision rule

A feature belongs when it improves conversation continuity, context visibility, agent routing, transcript navigation, or safe local execution. It should extend the objects above rather than introduce a separate task-management model.
