# Roadmap

This page lists current priorities and deferred work. It is not the product contract or release checklist; use the [Product specification](docs/specs/product-spec.md) and [Releasing](docs/releases/releasing.md) for those.

## Now

- Validate the release on clean supported machines, including npm installation, desktop browser behavior, and macOS service lifecycle.
- Finish desktop usability polish: navigation, search, follow-up delivery, settings, accessibility, and Light/Dark/System review.
- Keep the initial native-agent baseline stable: Codex, Claude Code, Gemini CLI, OpenCode, and Hermes.

## Next

- Revalidate newer Gemini CLI versions against native session resume and scoped MCP before expanding support.
- Add Pi coding agent after its transport passes the same native-session and scoped-MCP checks.
- Measure larger synthetic workspaces before changing the current JSON persistence model.

## Later

- Desktop application wrapper over the same local service.
- Additional Project resource types beyond local folders.
- Relational transcript storage when measured scale justifies it.
- Generic plugin lifecycle after the native runtime interface is stable.
- Mobile and narrow-layout support after an explicit product decision.
