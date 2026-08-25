# Architecture

## Boundary

Commonspace is a local Buzz-like agent workspace hosted inside DeepSeek Harness Web. DSH supplies the shell and extension points. Optional Hermes, Codex CLI, and Claude Code adapters supply agent identities and execution. Commonspace owns only local Projects, Channels, DMs, Agents presentation, message metadata, routing, and native-session references.

Commonspace has no runtime package dependency on those CLIs or OpenAgents, does not copy their credentials or session content, and does not modify DeepSeek Harness core files.

## Core entities

### Project

A Project is a named context container with one or more absolute local directory paths. The first path is the agent process working directory. Other paths are exposed through the adapter's supported additional-directory flags and every path is listed in Channel prompts.

### Channel

A Channel belongs to a Project and carries an explicit list of agent IDs. Valid `@agent-id` mentions route only to seated agents. If no seated agent is mentioned, the turn is sent to the full Channel roster. Each root creates a new native session; replies reuse that thread's session. Agent calls are serial and capped by host configuration.

### Direct Message

A DM is derived from an agent ID and uses one persistent native session: Hermes uses its canonical `Bot Chat`; Codex and Claude Code resume the recorded CLI session UUID.

### Agent

An Agent is either a real Hermes profile discovered through `hermes profile list` or an explicit user-managed Codex CLI/Claude Code definition. Commonspace never synthesizes specialists. The namespaced agent ID is routing authority; display name, adapter, and optional model are presentation/execution metadata.

## Host face

`src/index.ts` creates `CommonspaceHostService`, which mounts three same-origin routes on DSH's existing loopback Web server:

- `GET /commonspace/api/bootstrap`
- `POST /commonspace/api/mutate`
- `POST /commonspace/api/send`

The host service:

- rejects cross-origin mutation requests;
- caps JSON body and message sizes;
- structurally sanitizes loaded state, validates reasoning/settings at API boundaries, and canonicalizes Project paths as absolute existing directories;
- persists `~/.commonspace/state.json` through temp-file + rename publication;
- discovers Hermes profiles without reading credentials;
- invokes every adapter with argument arrays and piped input, never a shell command;
- scopes DMs and Channel threads to persisted native session IDs;
- retries a missing native session once with a fresh session and never retries unrelated failures;
- serializes sends per conversation and serializes runs whose Project paths overlap;
- bounds stdout, stderr, Codex output files, execution time, room history, and agents per turn;
- kills timed-out adapter process groups;
- stores temporary prompts/outputs under a `0700` directory with `0600` files and removes them in `finally` blocks.

Unsafe adapter mode is config-controlled and disabled by default. `COMMONSPACE_AGENT_YOLO=1` affects only Codex CLI and Claude Code; the legacy `COMMONSPACE_HERMES_YOLO=1` flag remains isolated to Hermes.

## Browser face

### Mode switching

`CommonspaceModeController` starts in Workspaces mode. The footer switch toggles it.

When Commonspace mode activates, `src/client/index.ts` dynamically registers priority `-20` occupants for the existing `sidebar.workspaces` and `conversation` single slots. Lower priority wins the DSH slot shadowing election. When Commonspace deactivates, those registrations are disposed, revealing the untouched native Workspace browser and DSH conversation again.

### Shared state

`CommonspaceClientStore` is one observable store shared by both replacement surfaces. It owns bootstrap loading, active Project, active Channel/DM, optimistic user messages, sending state, errors, mutations, and refresh.

### Sidebar

`CommonspaceSidebar` renders:

- Projects with expandable child filesystem workspaces and per-Project add-workspace controls;
- Channels with Project binding and editable agent rosters;
- Direct Messages derived from persisted DM activity;
- discovered Hermes agents and user-managed Codex CLI/Claude Code agents.

### Conversation

`CommonspaceConversation` renders the selected Channel or DM, visible Channel membership, attributed messages, errors, and a bounded composer. It does not reuse DSH Session messages because adapter-backed Commonspace agents—not DSH agents—are the room members.

## Persistence

The host state format is versioned. Commonspace state on disk holds Project definitions, Channel definitions, managed agent definitions, bounded message histories, and native session UUID mappings. Session content and credentials remain in each CLI's supported storage. Native session UUIDs are redacted from browser/API snapshots because only the host needs them.

## Intentional omissions

The private preview does not implement:

- Nostr/Buzz federation;
- multi-user authentication;
- voice or media uploads;
- GitHub repositories or workflow automation;
- token streaming;
- reactions, read receipts, or Slack-style message threads;
- hosted remote agent runtimes.

These can be added later without changing the four core entities or the Workspaces/Commonspace mode boundary.

## Rollback

Before reverting to a host version that only understands state v4 or earlier, preserve the v5 state file:

```bash
cp ~/.commonspace/state.json ~/.commonspace/state-v5.backup.json
```

Then remove the profile bundle and restart DSH Web:

```bash
dsh plugin --profile web remove @ralphbibera/commonspace
dsh web
```

Commonspace metadata remains in `~/.commonspace/state.json` unless the operator deletes it explicitly. A pre-v5 host cannot load managed-agent/session fields and must not overwrite the backup.
