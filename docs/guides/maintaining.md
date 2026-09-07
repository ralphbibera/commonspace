# Maintaining Commonspace

Maintainers review contributions, handle reports, and prepare releases. [CODEOWNERS](../../.github/CODEOWNERS) identifies the reviewers for each part of the repository.

## Handle issues and proposals

Look for related issues and pull requests before creating new work. For a bug, establish what happened, what should have happened, how to reproduce it, and which version is affected. Then identify the smallest part of the code responsible for the behavior.

For a feature, agree on the user problem and product fit before accepting a large implementation. Record product and architectural decisions in the relevant documentation so future contributors can find them.

Small fixes may arrive directly as pull requests. Do not require an issue that repeats a clear pull request description. Link related work and credit earlier contributors when work is continued or combined.

## Review a pull request

Use [Contributing](../../CONTRIBUTING.md) as the review standard. A change should have:

- a clear problem and an explanation of the resulting behavior;
- one logical purpose and an appropriate place in the code;
- tests and manual checks that prove the changed behavior;
- matching shared types, consumers, migrations, and documentation;
- passing required CI, including the aggregate `check` job;
- resolved substantive feedback and maintainer approval;
- disclosure of AI assistance and a review of the complete diff.

Check that documentation follows the [writing guidance](../../CONTRIBUTING.md#documentation-and-privacy). Reviewers should be able to understand the change from its description and linked issues.

Use conventional commit messages. See [Releasing](../releases/releasing.md) for the release process.

## Review workflows and dependencies

Treat workflow and dependency changes as executable code. Contribution workflows use the `pull_request` event and read-only default permissions. Do not expose provider credentials or run untrusted contribution code through a privileged event.

Review permission changes explicitly. Dependency updates do not authorize additional access or automatic merging. Review tools can help find problems, but the maintainer remains responsible for the decision.

Keep these repository controls enabled:

- require approval before workflows from every external contributor;
- allow GitHub-owned actions plus the explicitly selected `pnpm/action-setup`, and require full commit-SHA pins;
- keep the default workflow token read-only and prevent it from approving pull requests;
- use GitHub-hosted runners only for untrusted pull request code;
- keep secret scanning, push protection, Dependabot alerts, and Dependabot security updates enabled.

The `npm-release` environment requires owner approval and accepts deployments from `main` and `v*` tags. Release events run against their tag; manual dispatch must run from `main`. The workflow verifies that the tagged commit belongs to `main`, rechecks its tag before publication, and cannot publish while `NPM_RELEASE_ENABLED` is absent. Add that variable only after npm package ownership and trusted publishing are configured.

## Configure GitHub

Configure branch rules and required checks in the repository's GitHub settings. Use rules supported by the repository's plan.

The default branch should require the CI `check` status and, for outside contributions, pull requests with resolved conversations and maintainer or code-owner review. Prevent force pushes and branch deletion. Keep any owner recovery exception narrow and explicit.

Keep default workflow permissions read-only. Check jobs that request write access, the issue and pull request templates, and the reporting routes. The repository description, topics, and links should describe Commonspace accurately. Do not require checks that the repository does not run.

## Handle security and conduct reports

Follow [Security](../../SECURITY.md) and the [Code of Conduct](../../CODE_OF_CONDUCT.md). Arrange a confidential route before asking someone for sensitive details. Do not request workspace state or agent transcripts in ordinary issues.

Maintain working confidential reporting routes for security and conduct concerns, and keep the policies current. Do not promise response times or long-term version support that the maintainer group cannot provide.

Security fixes target `main` and the latest release. Document affected versions, the upgrade path, and any saved-data compatibility limits.

## Release readiness

Use [Releasing](../releases/releasing.md) for versioning, verification, publication, and release notes. Maintainers should also review current files, Git history, reporting routes, branch rules, and private-data exposure before publication.
