# Changelog

All notable changes to Commonspace will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and future releases will use semantic versioning.

## [Unreleased]

### Added

- Private GitHub repository and open-source-oriented project structure.
- Native DeepSeek Harness bundle with dynamic Workspaces/Commonspace mode switching.
- Local filesystem Projects containing multiple workspace paths.
- Channels with editable, explicit agent membership.
- Membership-aware `@agent-id` routing and serial Channel turns.
- Direct Messages backed by each agent adapter's persistent native session.
- Searchable Direct Messages picker with one-click agent chat and composer focus.
- Commonspace `/help`, `/new`, `/retry`, `/status`, and `/agents` commands with autocomplete and safe aliases.
- Real Hermes profile discovery with profile model and availability metadata.
- User-managed Codex CLI and Claude Code agents with native DM/thread session resumption.
- Adapter-aware Agent creation/removal and Channel membership in the Commonspace sidebar.
- Overlapping-workspace serialization, stale-session recovery, generation-safe removal, and host-private session references.
- Same-origin local API, atomic JSON persistence, and bounded no-shell Hermes execution.
- Generation-safe Direct Message resets that clear the transcript, rotate native context, and discard stale in-flight replies.
- Projects, Channels, Direct Messages, Agents, and center Messages UI.
- Unit, type, build, CI, and live-browser verification.

### Removed

- The earlier additive popup/footer navigation.
- Fake local agent labels and DSH-session-backed Commonspace conversations.
