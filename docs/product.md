# Product model

## Purpose

Commonspace gives one person a clear, local place to converse with reusable coding agents while keeping project context and native session continuity visible.

## Product principles

1. **Conversation is the work record.** Requests, replies, decisions, and follow-ups remain legible as messages and threads.
2. **Context has a visible home.** Every shared conversation belongs to a Project and every Project identifies its filesystem context.
3. **Agents are real runtimes.** Agent identity maps to an installed Hermes profile or an explicitly configured Codex CLI or Claude Code adapter.
4. **Continuity is exact.** A Channel thread or DM resumes the native session created for that conversation.
5. **Local authority.** State, files, agent processes, and credentials remain on the machine.
6. **Control operations stay local.** Slash commands change Commonspace state and are never forwarded as prompts.

## Core objects

### Project

A named context containing one or more canonical filesystem directories. The first directory is the working directory; supported adapters receive the others as additional context.

### Channel

A Project-scoped shared conversation with an explicit agent roster, instructions, settings, and projected memory. An `@agent-id` mention targets a seated agent. A message without a valid mention routes to the Channel roster within the configured limit.

### Direct Message

A persistent one-to-one conversation with an agent. `/new` deliberately rotates the native scope, clears only that DM transcript, and prevents stale in-flight replies from crossing the boundary.

### Agent

A stable identity backed by Hermes, Codex CLI, or Claude Code. Adapter, display name, model, reasoning, and availability remain visible.

### Message and thread

Messages carry user intent and agent results. A Channel root creates one native session; replies continue it. This is the product's unit of work and context handoff.

## Product decision rule

A feature belongs when it improves conversation continuity, context visibility, agent routing, transcript navigation, or safe local execution. It should extend the objects above rather than introduce a separate task-management model.
