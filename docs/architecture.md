# Architecture

## Boundary

Commonspace extends the shipped DeepSeek Harness Web profile. It is not a separate application, API server, model provider, or agent runtime.

## Package faces

### Host

`src/index.ts` is the Cordis host face. It deliberately registers no services in the browser-local release. This lets the DSH Loader discover the package and lets the browser module scanner find the package's `dsh.client` declaration.

### Browser

`src/client/index.ts` loads after `@deepseek-ai/dsh-client-ui-sidebar` and registers `CommonspaceLauncher` into the public `sidebar.footer.action` list slot.

The launcher:

- preserves the stock sidebar and workspace/session browser;
- embeds the navigation directly above the Commonspace row in the sidebar footer stack;
- grows upward into the sidebar's available space without covering the conversation;
- closes on Escape or when the stock sidebar collapses;
- follows the sidebar's wide layout and keeps the collapsed rail compact;
- uses Harness design tokens with safe fallbacks;
- exposes Projects, Channels, and Direct Messages as disclosure buttons;
- provides inline create, select, and remove controls for every group.

### Browser state

`src/client/navigation-state.ts` owns a versioned `commonspace.navigation.v1` localStorage record. It validates unknown JSON before use, applies Unicode-aware channel slug normalization, prevents case-insensitive duplicates, restores a valid selection, and falls back safely when storage is unavailable or corrupt. This state is intentionally local to one browser profile and contains navigation labels only; it is not a shared collaboration database.

## Profile activation

`package.json` declares `dsh.bundle.patch`. Installing the package through `dsh plugin --profile web add …` appends the package to the Web profile's bundle layers. `commonspace.patch.yml` then inserts the host plugin row. The DSH client-module service discovers and serves `lib/client.js` from the same package.

## Future extensions

Future work can move browser-local data behind shared Harness services:

1. a host-side Commonspace service and explicit persistence format;
2. typed APIs for projects, channels, direct messages, and thread metadata;
3. mapping a top-level channel message to a bounded Harness session;
4. project-context injection into that session;
5. work-inspection projections derived from real Harness events.

Those additions must preserve Harness conversation rendering, compaction, credentials, and tool execution rather than reimplementing them.

## Rollback

Remove the profile bundle and restart Web:

```bash
dsh plugin --profile web remove @ralphbibera/commonspace
dsh web
```
