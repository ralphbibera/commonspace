## Problem

<!-- Describe what happens today, what should happen, and why the change belongs in Commonspace. Link a related issue if one exists; an issue is not required. -->

## Changes

<!-- Explain the resulting behavior and the package or files responsible for it. Keep the explanation understandable without the original conversation. -->

## Verification

<!-- Give commands and results. Remove checks that do not apply and explain why. Documentation-only changes need link, command, syntax, and diff checks rather than a full build. -->

### Automated checks

- [ ] Focused test or existing coverage: <!-- command and result, or why no new test is needed -->
- [ ] `pnpm check:fast`
- [ ] `pnpm check`
- [ ] `pnpm verify:live` <!-- required for server, API, routing, saved-data, or complete UI-flow changes -->
- [ ] `pnpm release:pack` and `pnpm verify:release` <!-- required for packaging, installation, production dependencies, or release workflow changes -->

### Manual checks

<!-- Describe the steps you tried and the result. For visible UI changes, check the desktop flow and include a useful screenshot or short recording with synthetic data. State whether real agent or background-service checks were run when relevant. -->

## Risks and follow-up

<!-- Describe any data migration, compatibility, security, performance, or release risk. Include backup or recovery steps if needed. Write "None" when there are none. -->

## AI assistance

<!-- State the provider and exact model used, or write: None, human-authored. The contributor remains responsible for the complete change. -->

## Checklist

- [ ] I searched for related issues and pull requests and credited earlier work where relevant.
- [ ] This pull request contains one logical change that fits Commonspace's product direction.
- [ ] Shared types, affected consumers, and saved-data migrations are consistent.
- [ ] I added or updated focused coverage, or explained why it is not needed.
- [ ] I updated the documentation affected by the change.
- [ ] I removed credentials, private paths, agent session data, internal links, and generated artifacts from the contribution.
- [ ] I reviewed the complete diff and ran `git diff --check`.
