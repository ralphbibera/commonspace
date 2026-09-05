# Maintaining Commonspace

Maintainers help contributors choose useful changes, review the results, and prepare releases. The repository owner makes the final decisions about product direction, access, releases, and repository visibility. [CODEOWNERS](../.github/CODEOWNERS) records who reviews changes.

## Handle issues and proposals

Look for related issues and pull requests before creating new work. For a bug, establish what happened, what should have happened, how to reproduce it, and which version is affected. Then identify the smallest part of the code responsible for the behavior.

For a feature, agree on the user problem and product fit before accepting a large implementation. Record product and architectural decisions in the relevant documentation so future contributors can find them.

Small fixes may arrive directly as pull requests. Do not require an issue that repeats a clear pull request description. Link related work and credit earlier contributors when work is continued or combined.

## Review a pull request

Use [Contributing](../CONTRIBUTING.md) as the review standard. A change should have:

- a clear problem and an explanation of the resulting behavior;
- one logical purpose and an appropriate place in the code;
- tests and manual checks that prove the changed behavior;
- matching shared types, consumers, migrations, and documentation;
- passing required CI, including the aggregate `check` job;
- resolved substantive feedback and maintainer approval;
- disclosure of AI assistance and a review of the complete diff.

Check that documentation follows the [writing guidance](../CONTRIBUTING.md#write-useful-documentation). The explanation should make sense to a contributor who has not read the original conversation.

Use conventional commit messages and SSH Git remotes. See [Releasing](releasing.md) when a reviewed change is ready to become a distribution.

## Review workflows and dependencies

Treat workflow and dependency changes as executable code. Contribution workflows use the `pull_request` event and read-only default permissions. Do not expose provider credentials or run untrusted contribution code through a privileged event.

Review permission changes explicitly. Dependency updates do not authorize additional access or automatic merging. Review tools can help find problems, but the maintainer remains responsible for the decision.

## Configure GitHub

Repository files document policy; they do not prove that GitHub settings enforce it. When reviewing the repository configuration, check the actual settings and use rules supported by the repository's plan.

The default branch should require the CI `check` status and, for outside contributions, pull requests with resolved conversations and maintainer or code-owner review. Prevent force pushes and branch deletion. Keep any owner recovery exception narrow and explicit.

Keep default workflow permissions read-only. Check jobs that request write access, the issue and pull request templates, and the reporting routes. The repository description, topics, and links should describe Commonspace accurately. Do not require checks that the repository does not run.

## Handle security and conduct reports

Follow [Security](../SECURITY.md) and the [Code of Conduct](../CODE_OF_CONDUCT.md). Arrange a confidential route before asking someone for sensitive details. Do not request workspace state or agent transcripts in ordinary issues.

Maintain working confidential reporting routes for security and conduct concerns, and keep the policies current. Do not promise response times or long-term version support that the maintainer group cannot provide.

Security fixes target `main` and the latest release. Document affected versions, the upgrade path, and any saved-data compatibility limits.

## Release readiness checklist

Review the candidate before approving publication:

- Review both current files and Git history for credentials, private paths, agent session data, internal links, and generated artifacts. Deleting a file from the latest commit does not remove it from history.
- Review screenshots, fixtures, examples, and bundled dependencies for private content and license requirements.
- Check that the README, installation instructions, contribution guide, support matrix, license, security policy, and conduct policy match the candidate.
- Verify the private security and conduct reporting routes.
- Check branch rules, required CI, and contribution templates in GitHub.
- Verify all supported archives, checksums, and fresh installations. Record real agent and macOS service results, plus any checks or platforms not exercised.
- Review the release notes, backup and migration instructions, known limitations, and accuracy of public installation and contribution instructions.

The owner must approve publication. The release workflow leaves the candidate as a draft; a maintainer publishes it after review. Repository access and visibility changes are separate administrative decisions.
