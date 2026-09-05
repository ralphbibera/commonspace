# Commonspace

Commonspace brings your coding agents into one local workspace. Talk with agents in shared channels or direct messages, connect local projects, and return to earlier conversations without losing their history.

![Commonspace workspace](docs/assets/commonspace-panel.png)

> **Private preview:** Commonspace is being prepared for an open-source release. The repository is currently private.

## Work with your agents

- Use **Channels** for shared conversations and **Direct Messages** to talk with one agent.
- Connect local folders through **Projects**, then refer to a Project from any conversation.
- Continue a focused conversation in a **thread**, with the agent's session preserved between replies.
- Find agent replies and requests for your attention in the **Inbox**, then open the conversation to inspect reported progress and tool results.
- Find earlier work through search, unread markers, and pinned context.

Commonspace supports local Hermes and Codex installations. You choose which agents to add. Their credentials, tools, permissions, and native sessions remain under their control.

In a Channel, use `@agent` to choose who responds and `@@project` to choose relevant Project context. For messages without an agent mention, your configured router chooses which agents should respond. See [how Commonspace works](docs/product.md) for the conversation and context rules.

## Run Commonspace

The [installation guide](docs/install.md) covers release downloads, checksums, startup, and updates for macOS and Linux. A release archive includes the application and its dependencies; you only need Node.js 22 or newer.

From an extracted release directory:

```bash
node commonspace.mjs
```

Open `http://127.0.0.1:3100` in your desktop browser. The app runs on your computer. macOS users can also install it as a background service.

During the private preview, downloads require repository access. If no release is available to you, use the source setup below.

## Develop from source

You need Node.js 22 or newer, pnpm 10.34.5, and Git with SSH access to the repository. Agent credentials are not required for development or the normal test suite.

```bash
git clone git@github.com:ralphbibera/commonspace.git
cd commonspace
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173`. This development UI connects to the local API on port `3100`.

Read [Contributing](CONTRIBUTING.md) to choose a change, run the right checks, and prepare a pull request. Small fixes can go straight to a pull request; discuss larger changes with a maintainer first.

## Your data

Commonspace stores workspace data in `~/.commonspace` by default and listens only on `127.0.0.1`. Agent credentials stay in each agent's own store. Agents and your configured inference provider may use remote model services, so the services you choose determine where message and context data is sent.

See [Operations](docs/operations.md) for configuration, backups, and recovery, and [Security](SECURITY.md) for the protection and reporting policies.

## Documentation

The [documentation guide](docs/README.md) groups instructions for using Commonspace, contributing changes, and maintaining releases.

## License

Commonspace is [MIT licensed](LICENSE). © Ralph Bibera.
