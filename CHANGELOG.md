# Changelog

All notable changes to Commonspace are recorded here.

## [Unreleased]

### Added

- Standalone Express server with loopback and same-origin API guards.
- Vite and React application served independently in development and by the production server after build.
- pnpm workspace boundaries for shared contracts, agent adapters, server behavior, and UI behavior.
- Real standalone health, API, browser-mount, build, and live smoke verification.

### Changed

- Reframed Commonspace as a conversation-first context workspace centered on Projects, Channels, Direct Messages, Agents, Messages, and native session continuity.
- Preserved the existing local state format and Hermes, Codex CLI, and Claude Code adapter behavior during extraction.

### Removed

- Plugin lifecycle, slot mounting, bundle manifests, and framework-specific build dependencies.
