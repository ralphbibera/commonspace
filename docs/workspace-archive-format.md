# Workspace archive format

Commonspace workspace archives are plain JSON. They are local, self-contained, and do not depend on a Commonspace cloud service.

## Version 1 envelope

```json
{
  "format": "commonspace-workspace",
  "version": 1,
  "exportedAt": "2026-08-31T00:00:00.000Z",
  "workspace": {
    "inboxReadAt": null,
    "inboxReadMessageIds": [],
    "inboxSavedItemIds": [],
    "followedSessionIds": [],
    "mutedSessionIds": [],
    "defaults": {},
    "agents": [],
    "projects": [],
    "channels": [],
    "threads": [],
    "pins": [],
    "permissions": [],
    "messages": {}
  },
  "attachments": []
}
```

`format` and `version` identify the archive contract. `exportedAt` and other timestamps are ISO 8601 strings. IDs are opaque strings and relationships use those IDs. The detailed workspace object shapes are the public contracts in `packages/shared/src/contracts.ts`.

Projects contain `id`, `name`, `rootCount`, and `createdAt`. Absolute roots are never exported. Import requires exactly `rootCount` existing local directories for each Project, supplied as an explicit mapping outside the archive.

Each attachment contains `kind` (`image` or `file`), `id`, `name`, `mimeType`, `size`, and padded base64 `data`. Every attachment referenced by a message must have exactly one matching byte entry. Metadata, decoded size, and canonical base64 encoding must agree.

## Privacy boundary

Commonspace-managed workspace fields omit:

- routing-provider credentials;
- native harness credentials and transcript stores;
- opaque native session references;
- ephemeral MCP capabilities;
- absolute Commonspace, projectless-workspace, and Project-root paths.

Pending native permission requests export as interrupted because their original harness request cannot survive transfer. Attachment bytes remain exact and are not content-scanned or rewritten, so an attached file can contain paths or secrets supplied by its author. The archive is unencrypted and contains conversation text and attachment bytes; handle it as private user data.

## Import rules

Import is intentionally restore-like:

1. The destination workspace must be empty. Import never merges with or overwrites current workspace data.
2. The envelope version, workspace structure, Projects, attachment metadata, and attachment bytes are validated before state becomes active.
3. Every Project root is remapped through an explicit local directory choice. Unknown, missing, duplicate, non-directory, or surplus mappings fail the import.
4. Native session references are recreated as empty. Imported conversations remain visible, while the next harness turn establishes new native continuity.
5. Attachment bytes and state are committed together; failed persistence removes newly copied bytes.

Unknown archive versions are rejected. A future format change must increment `version` and document its migration behavior here.

## Retention

Retention is not automatic. Commonspace keeps accepted messages indefinitely until the owner explicitly previews and applies cleanup to one Channel or Direct Message. The preview is bound to the current state revision and reports affected messages, Threads, attachments, pins, and permission records. Any intervening state change makes it stale and requires a new preview.

Applying retention removes that conversation's transcript, attachment bytes, associated Threads, native-session mappings, pins, permission records, and derived Channel/routing memory. It preserves the Channel or Agent identity and does not affect other conversations. Active work blocks cleanup.
