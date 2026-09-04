## Thinking path

<!-- Explain the reasoning from the product problem to this change. Keep it short and concrete. -->

1. Commonspace should ...
2. But ...
3. Therefore this change ...

## What changed

<!-- Describe the implementation and name the owning package or boundary. -->

## Verification

### Automated

- [ ] Focused test or existing coverage: <!-- command and result -->
- [ ] `pnpm check:fast`
- [ ] `pnpm check`
- [ ] `pnpm verify:live` <!-- required for server, API, routing, persistence, or integrated UI changes -->

### Manual

<!-- Describe the path you checked. For visible changes, include screenshots or a short recording. -->

## Risks and follow-up

<!-- List migration, compatibility, security, performance, or rollout risks. Write "None" when there are none. -->

## Model used

<!-- State the provider and exact model used, or write: None, human-authored. -->

## Checklist

- [ ] I searched for related issues and pull requests.
- [ ] This pull request contains one logical change.
- [ ] The change follows the Commonspace product model.
- [ ] Shared contracts and affected consumers are synchronized.
- [ ] I added or updated focused coverage, or explained why it is not needed.
- [ ] I checked for credentials, private paths, native session data, and generated artifacts.
- [ ] I reviewed the complete diff and ran `git diff --check`.
