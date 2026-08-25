# Roadmap

Commonspace is a private preview. This roadmap records sequencing and product boundaries; it is not a promise to add every collaboration feature found in Buzz or Slack.

## Shipped in the private preview

- Native Workspaces/Commonspace mode switch.
- Filesystem Projects with multiple canonical paths.
- Channels with explicit agent rosters, settings, instructions, memory, and threaded execution.
- Searchable Direct Messages and generation-safe `/new` resets.
- Hermes discovery plus managed Codex CLI and Claude Code agents.
- Exact native session resumption and stale-session recovery.
- Local slash commands and tag autocomplete.
- Versioned, sanitized, atomic local state.
- Same-origin loopback API, workspace locking, bounded subprocess execution, and host-private session references.
- Semantic Commonspace visual system and live-browser acceptance verification.

## Before a public release

- Resolve all supported CLI authentication smoke tests in a clean machine setup.
- Exercise light/dark host themes and narrow viewport screenshots in CI or a repeatable manual matrix.
- Add package/release metadata and remove `private` only after install/uninstall tests pass from a packed artifact.
- Document supported DSH version ranges and migration guarantees.
- Add a user-facing destructive-action pattern for removing managed agents and Projects.
- Audit keyboard-only navigation across every sidebar form, picker, command menu, and thread.
- Define retention controls for transcripts and projected Channel memory.

## Candidate next work

- Token streaming if DSH and every adapter expose a compatible cancellable stream contract.
- Explicit stop/cancel controls backed by tracked process groups.
- Adapter availability diagnostics in the Agents list.
- Per-agent configuration beyond model (profile/config layer, safe permission preset).
- Import/export for non-secret Commonspace metadata.
- Better transcript search and filters.

## Deliberate non-goals

- A second web application or agent runtime.
- OpenAgents or Hermes Kanban as a hidden work queue.
- Multi-user authentication in the local preview.
- Nostr/Buzz federation.
- Voice, media uploads, reactions, read receipts, or broad social features.
- Hosted remote agents without a separate threat model and explicit product decision.
- GitHub workflow/project management features unrelated to local agent conversation.

## Decision rule

A roadmap item belongs in Commonspace only when it strengthens the four core objects—Project, Channel, DM, Agent—or makes their local execution safer and more legible. Everything else should remain outside the plugin.
