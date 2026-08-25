# Architecture

## Boundary

Commonspace is a local Buzz-like agent workspace hosted inside DeepSeek Harness Web. DSH supplies the shell and extension points. Hermes profiles supply agent identities and execution. Commonspace owns only local Projects, Channels, DMs, Agents presentation, message metadata, and routing.

Commonspace does not depend on OpenAgents, run another model provider, replace Hermes profile state, or modify DeepSeek Harness core files.

## Core entities

### Project

A Project is a named context container with one or more absolute local directory paths. The first path is the Hermes process working directory. Every path is listed in the room prompt so an agent can reason about the whole Project.

### Channel

A Channel belongs to a Project and carries an explicit list of Hermes profile IDs. Valid `@profile` mentions route only to seated agents. If no seated agent is mentioned, the turn is sent to the full Channel roster. Agent calls are currently serial and capped by host configuration.

### Direct Message

A DM is derived from a Hermes profile ID and uses that profile's canonical `Bot Chat` session. The profile therefore keeps its own role, model, memory, skills, and persistent conversation context.

### Agent

An Agent is a real Hermes profile discovered through `hermes profile list`. Commonspace never synthesizes fake specialists. The profile ID is routing authority; the display name and model are presentation metadata.

## Host face

`src/index.ts` creates `CommonspaceHostService`, which mounts three same-origin routes on DSH's existing loopback Web server:

- `GET /commonspace/api/bootstrap`
- `POST /commonspace/api/mutate`
- `POST /commonspace/api/send`

The host service:

- rejects cross-origin mutation requests;
- caps JSON body and message sizes;
- validates Project paths as absolute existing directories;
- persists `~/.commonspace/state.json` through temp-file + rename publication;
- discovers Hermes profiles without reading credentials;
- invokes Hermes with `execFile` argument arrays and `--query-file`, never a shell command;
- scopes DMs to `Bot Chat` and Channels to a stable room session name;
- serializes sends per conversation;
- bounds output, execution time, room history, and agents per turn;
- removes temporary prompt files in a `finally` block.

Hermes yolo mode is config-controlled and disabled by default. The bundle reads `COMMONSPACE_HERMES_YOLO=1` only when the operator explicitly opts in.

## Browser face

### Mode switching

`CommonspaceModeController` starts in Workspaces mode. The footer switch toggles it.

When Commonspace mode activates, `src/client/index.ts` dynamically registers priority `-20` occupants for the existing `sidebar.workspaces` and `conversation` single slots. Lower priority wins the DSH slot shadowing election. When Commonspace deactivates, those registrations are disposed, revealing the untouched native Workspace browser and DSH conversation again.

### Shared state

`CommonspaceClientStore` is one observable store shared by both replacement surfaces. It owns bootstrap loading, active Project, active Channel/DM, optimistic user messages, sending state, errors, mutations, and refresh.

### Sidebar

`CommonspaceSidebar` renders:

- Projects with expandable child filesystem workspaces and per-Project add-workspace controls;
- Channels with Project binding and editable Hermes member rosters;
- Direct Messages derived from persisted DM activity;
- the full Hermes Agent roster.

### Conversation

`CommonspaceConversation` renders the selected Channel or DM, visible Channel membership, attributed messages, errors, and a bounded composer. It does not reuse DSH Session messages because Hermes profiles—not DSH agents—are the room members.

## Persistence

The host state format is versioned. Commonspace state holds Project definitions, Channel definitions, and bounded message histories. Hermes session content remains in each Hermes profile's own state database; Commonspace stores only the room transcript needed for shared display.

## Intentional omissions

The private preview does not implement:

- Nostr/Buzz federation;
- multi-user authentication;
- voice or media uploads;
- GitHub repositories or workflow automation;
- token streaming;
- reactions, read receipts, or Slack-style message threads;
- non-Hermes runtimes.

These can be added later without changing the four core entities or the Workspaces/Commonspace mode boundary.

## Rollback

Remove the profile bundle and restart DSH Web:

```bash
dsh plugin --profile web remove @ralphbibera/commonspace
dsh web
```

Commonspace metadata remains in `~/.commonspace/state.json` unless the operator deletes it explicitly.
