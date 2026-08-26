# Agent adapter contract

Commonspace adapters translate one host-owned execution request into a bounded local CLI invocation. They do not read or copy credentials; each CLI resolves authentication from its supported runtime store.

## Supported adapters

| Adapter | Identity source | New session | Resume | Safe default |
| --- | --- | --- | --- | --- |
| Hermes | `hermes profile list` | Named `Bot Chat`, `Commonspace DM: <uuid>`, or `Commonspace Thread: <uuid>` | Same named chat | Normal Hermes permissions |
| Codex CLI | Explicit Commonspace definition | `codex exec --json` | `codex exec resume --all <uuid>` | `workspace-write` sandbox |
| Claude Code | Explicit Commonspace definition | `claude -p --session-id <uuid>` | `claude -p --resume <uuid>` | `acceptEdits` permission mode |

## Execution request

Every adapter receives:

- agent identity and adapter kind;
- canonical primary working directory;
- canonical additional Project directories;
- host-generated prompt;
- stable Commonspace session scope;
- optional native session UUID;
- optional model and reasoning override;
- execution budget and safe/unsafe policy.

Prompts are sent through stdin or a `0600` prompt file. Commands use argument arrays—never shell interpolation.

## Session scopes

- Initial DM: `Bot Chat`.
- Reset DM: `Commonspace DM: <uuid>`.
- Channel root/thread: `Commonspace Thread: <thread-uuid>`.

Native UUIDs and DM scopes are persisted only in host state and are redacted from browser/API snapshots. If a native resume reports that its session is missing, Commonspace clears that mapping and performs exactly one fresh-session attempt. Other failures are not retried automatically.

## Concurrency and cancellation

Message acceptance is non-blocking. Different agents and different native sessions may run concurrently, including in the same Project. Calls to the same agent session are serialized so native session continuity remains valid. Before publishing a result, the host revalidates the managed-agent generation and Channel/DM generation. Removed agents, deleted Channels, and reset DMs cannot be resurrected by late replies.

In Channels, an agent reply that names a seated peer creates one bounded follow-on delivery with the root human message and recent room context. Each agent is delivered at most once per causal turn, preventing mention loops without introducing task or blocker state.

## Resource boundaries

- JSON body and message length caps.
- Agent count cap per Channel turn.
- Process timeout with process-group termination.
- Combined stdout/stderr capture cap.
- Bounded Codex output-file read.
- Maximum 64,000-character published response.
- `0700` temp directory and `0600` temp files.
- Temporary files removed in `finally` blocks.

## Reasoning normalization

Commonspace exposes one cross-adapter scale. Provider-incompatible `none` and `minimal` values map to Codex/Claude's lowest supported effort. Hermes receives its native Commonspace value.

## Unsafe mode

Unsafe execution is off by default and split by runtime:

- `COMMONSPACE_AGENT_YOLO=1` affects Codex CLI and Claude Code.
- `COMMONSPACE_HERMES_YOLO=1` affects Hermes only.

Never enable either flag merely to work around authentication or a stale session.

## Adding an adapter

A new adapter must include:

1. A new `AgentAdapterKind` and managed-definition validation.
2. A pure invocation builder with no prompt text in process arguments where stdin is available.
3. Strict native-session identifier validation.
4. Output parsing with explicit success/error handling.
5. Safe default permissions and a separately scoped unsafe opt-in.
6. Unit tests for new/resume arguments, model/reasoning mapping, malformed output, and identifier injection.
7. Host tests for persistence, stale-session behavior, removal/reset races, concurrent room delivery, and bounded peer handoffs.
8. An opt-in real CLI smoke test that starts and resumes a session.
9. README, operations, and architecture updates.
