# Project Persistence

## v1 Decision

Projects are saved as **self-contained workspaces**.

The Web Shell persists projects in IndexedDB and can export/import the same data as a single `.intehrgrator` file. A saved project must be enough to resume authoring and run examples without asking the user to re-load the original template/source files.

## Project Bundle Contents

| Area | Contents |
|------|----------|
| Template | OPT content, filename, template id, parsed skeleton metadata |
| Source | Source Schema content + metadata |
| Examples | Array of example instances `{ id, filename, format, content }`, plus `activeExampleId` |
| Mapping | Dual serialization — native Blockly workspace data **and** the normalized Mapping Model (see below) |
| Editor / settings | Workspace preferences: **Conversion script language** (`exportTarget`), theme, validation; Mapping Specification cache — separate from Mapping Model |
| AI assist | Last generated slot manifest and imported suggestion report, if useful for review |
| Metadata | Project id, app version, created/updated timestamps |

## Mapping Serialization (dual)

The bundle stores the mapping **twice**, by design:

1. **Native Blockly serialization** — exact visual workspace restore (block positions, expansions, collapsed state). Source of truth for re-opening the editor.
2. **Normalized Mapping Model** — versioned JSON; drives Mapping Specification text and codegen input:

   | Field | Purpose |
   |-------|---------|
   | `modelVersion` | Migration across app releases |
   | `templateId` | Bind mapping to its OPT |
   | `slots[]` | `{ slotId, rmType, expression, returnType }` — JS-shaped expression strings per [MAPPING_SPECIFICATION.md](MAPPING_SPECIFICATION.md) |
   | `optionalRm[]` | Inserted optional RM structures and their attachment points |
   | `specText` | Optional cached text projection of the Mapping Specification |

   **Not in Mapping Model:** Conversion script language (`exportTarget`) — lives in workspace `settings` (downstream preview/export choice).

**Why both:** Blockly serialization is best for UI restore but brittle across Blockly versions and hard to validate. The Mapping Model enables safe migrations, AI **Import Suggestions** validation (shared `slotId` vocabulary with `AI_SUGGESTION_FORMAT.md`), and a future text-first editor that does not depend on Blockly.

**On load:** restore Blockly from native serialization; treat the Mapping Model as the authority for validation and for reconciling imported suggestions. If the two disagree (e.g. after a migration), the Mapping Model wins and the Blockly workspace is regenerated.

## Storage

- **IndexedDB**: primary Web Shell persistence.
- **`.intehrgrator` export**: portable JSON bundle for sharing, backup, or moving between browsers.
- **Import**: validates app/project version, template id, and bundle shape before loading.

## Non-goals

- Do not rely on local filesystem paths in v1; GitHub Pages cannot safely reopen arbitrary files later.
- Do not store API keys in the project bundle.
- Do not make `.intehrgrator` a long-term interchange standard yet; it is an app workspace format.

## Related

- [UI_ARCHITECTURE.md](UI_ARCHITECTURE.md) — Save Project / Web Shell
- [SOURCE_FORMATS.md](SOURCE_FORMATS.md) — source and example file handling
- [CONTEXT.md](../CONTEXT.md) — Project Bundle
