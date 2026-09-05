# Roadmap

Commonspace is a private preview. Core conversation, context, and local-service capabilities are implemented; release work focuses on clean-machine validation and desktop usability.

The capabilities below describe the implementation, not a passing result for a release candidate. Use the [Product specification](product-spec.md) for required behavior, the [Implementation gap audit](implementation-gap-audit.md) for its dated status snapshot, and the [v0.1 acceptance ledger](v0.1-acceptance.md) for evidence and release gates.

## Working now

### Conversations and session continuity

- Channels have chosen agent members, instructions, shared context, and threads. Model and reasoning settings apply across the workspace.
- Direct Messages continue one chosen agent's native session. `/new` starts a fresh session and prevents earlier context or late replies from crossing into it.
- Different native sessions can run concurrently. New turns send only the new request, and continuations resume the exact stored native session.
- Busy sessions preserve queued follow-ups. Users can reorder or remove them, steer the agent where supported, or stop the current turn and send the next input.
- Replies show distinct completed, needs-input, failed, silent, cancelled, timed-out, and interrupted outcomes. Cancellation, stale-session recovery, and graceful shutdown preserve session boundaries and distinguish missing sessions from temporary failures.
- Accepted messages survive append and restart without a hidden message-count limit. Editing a human message creates a new branch and session continuity while retaining earlier versions; deletion leaves a durable marker and removes the content.
- Slash commands and agent, Project, and Channel references are available within the conversation.

### Projects and shared context

- Projects can contain several validated local folders. Messages and threads can reference zero, one, or several Projects; execution, search, and reply attribution account for every reference.
- Inference chooses relevant Projects when no explicit tags are present. Visible `@@project` tags remain authoritative. There are no separate Project pickers for root messages, DMs, threads, branches, or reroutes.
- Thread replies inherit the latest Project references or use explicit `@@project` tags. New references affect future turns without rewriting earlier deliveries or active-session scope.
- Projectless turns run from a dedicated owner-only neutral workspace and receive no Project filesystem roots.
- Channel context supports editing, source and status inspection, manual compaction, and automatic compaction under token pressure. Human edits are preserved.
- Each thread starts with an immutable Channel-context snapshot and maintains its own editable context and compaction state.
- Channel and Thread pins include messages, exact attachments, and human notes. Scoped context tools expose active pins and preserve removal records.

### Agents and routing

- Adding an agent explicitly discovers supported installed Hermes and Codex runtimes. Each runtime has one reusable workspace identity.
- The Agent Client Protocol (ACP) carries native sessions and activity. Scoped Model Context Protocol (MCP) tools let agents read permitted Commonspace context and post visible progress or peer handoffs.
- Unaddressed Channel messages use a configured runtime or OpenAI-compatible inference provider to select agents. Explicit mentions remain authoritative.
- Routing stores one limited sub-request and relevant Project subset per selected agent. A visible setting controls the maximum number of selected agents; there is no hidden two-agent cap.
- Routing time is recorded separately from agent execution. Failed inference creates retryable Inbox attention. Completed routing assignments remain service metadata instead of filling the conversation with routing details.
- Service-level corrections can redirect one assignment to another existing Channel member while retaining its Project scope and earlier attempts. Replies stay linked to their assignments, and summaries of explicit corrections inform later routing. Inline reroute controls are deferred.

### Review, activity, and desktop experience

- Project views show files, Git changes, and diffs. Agent replies connect changed files, Project roots, activity, and emitted verification results to the request that produced them.
- Replies preserve expandable reasoning summaries, plans, tool calls, results, and context usage when the runtime emits them. Live activity includes per-run and `/stop` cancellation controls where supported.
- Images and general files can be attached, downloaded safely, searched, and pinned. Supported agent files are copied only from permitted roots; known credential files are refused.
- Native permission requests show exactly the runtime's available choices. They remain visible in the conversation and Inbox and block only the affected session.
- The desktop shell, collections, conversations, Inbox, threads, and Project panes follow the geometry and border rules in [UI direction](ui-direction.md). Final visual polish remains part of release readiness.
- Appearance starts in Light and offers Light, Dark, and System modes. Message focus uses a neutral card treatment. Theme tokens in `ui/src/index.css` allow a theme change without editing React components or layouts.

### Local operation and data

- The standalone server and browser application use a loopback API, origin guards, versioned atomic state, bounded execution, and browser-safe Project labels. Absolute Project roots stay private to the service.
- One-command macOS installation runs Commonspace as a user LaunchAgent. The built UI and API share an origin; service controls, staged updates, health checks, and one-release rollback support recovery.
- Runtime diagnostics explain storage readiness, available runtimes, observed agent readiness, recovery steps, and whether inference sends context to a local or remote provider.
- Opt-in desktop notifications cover replies, mentions, permission requests, failures, and timeouts. Category and sound settings are independent of durable Inbox state; alerts open the exact message.
- Versioned exports omit Commonspace-managed credential, session, capability, and absolute-path fields while preserving conversation text and exact attachment bytes. Archives are unencrypted private data; their contents may still contain sensitive information supplied by their authors. Import requires a clean workspace and explicit local Project-root mappings.
- Channel or DM retention requires an impact preview and a matching state revision. Cleanup removes attachment bytes and rejects live or queued runs and context or routing compaction. There is no automatic expiry.

## Scale-dependent work

A relational transcript store is deferred until measured transcript scale justifies replacing the current versioned state file. Storage may remain JSON while it meets the product's needs.

Regardless of storage technology, every accepted message must remain available until the user applies explicit retention. A migration must preserve that rule and the portable archive contract.

## Release readiness

- Exercise Hermes and Codex login, start, and exact-session resume on a clean supported machine.
- Run `pnpm check` for static checks, tests, migration and recovery coverage, and application builds.
- Run `pnpm verify:live` for desktop browser behavior, keyboard search and navigation, and Light/Dark/System appearance.
- Build and verify a distribution archive with `pnpm release:pack` and `pnpm verify:release`.
- Run `pnpm verify:service` on macOS for isolated source clone, install, build, update, and rollback checks. This test substitutes `launchctl` commands and health responses.
- Install the candidate archive on a clean supported macOS account and manually check real LaunchAgent startup, browser access, status, update, and rollback using [Releasing](releasing.md#check-the-real-integrations).
- Complete keyboard-only and destructive-action reviews.

Narrow and mobile layouts are deferred; desktop is the current UI target. Release gates need fresh results from the candidate being shipped. Follow [Releasing](releasing.md) for packaging and publication; the repository remains private until the owner explicitly authorizes a visibility change.
