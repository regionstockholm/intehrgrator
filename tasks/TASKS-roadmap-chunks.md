# Tasks: Roadmap implementation chunks

Based on [docs/ROADMAP.md](../docs/ROADMAP.md) (current `main`, including 2026-08-27 additions) and [PRD-intehrgrator-v1.md](./PRD-intehrgrator-v1.md). Glossary: [CONTEXT.md](../CONTEXT.md).

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:

- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task. If implementation steps happen to fulfil several things at once then ticking off several boxes is OK.

If running in interactive mode (e.g. Gemini CLI) then stop after each parent task and let user review. If running in autonomus batch mode e.g. dispatched to Jules, then just stop if user input is crucial in order to understand further steps.

## Grill round 1 (Chunk 1 frontier)

Asked after this plan was written, before coding Chunk 1. Recommended answers **adopted** so implementation can proceed; revisit if a later review disagrees.

❓ **Q1** - **Cogwheel scope**: The new B item replaces the encircled **+** popup with Blockly’s native cogwheel mutator (same family as `controls_if` elseif/else). Does that cover only container **Optional RM Insertion**, also DATA_VALUE **+ fields**, or template-optional skeleton slots too?

➡️ **Adopted: containers + DATA_VALUE shells.** Template-mandatory and silent-mandatory `ATTR_`* / `FLD_*` slots stay locked (not in the mutator stack). Optional RM extras (`OPT_*`) and optional DV fields (`OPTFLD_*`) are add/remove via the cogwheel. Skeleton `ATTR_*` mouths are not removed from the mutator.

---

❓ **Q2** - **Mutator UI**: Mini-workspace of stackable attribute blocks (true `MutatorIcon`, like if/elseif), or a cog that still opens a checkbox popup?

➡️ **Adopted: native** `MutatorIcon` **mini-workspace.** Flyout quark `optional_rm_mutator_item` / `dv_fields_mutator_item` with an attribute dropdown; container quark holds the STACK. HTML `#dialog-optional-rm` goes away.

---

❓ **Q3** - **Removing an optional attribute that already has children**: Disconnect and leave the subtree on the canvas (Blockly default), confirm-then-delete, or refuse until the child is detached?

➡️ **Adopted: disconnect / orphan.** `saveConnections` + `compose` reconnect remaining sockets; a removed extra’s child is left on the canvas, not silently deleted. Mapping Model `optionalRm[]` drops that insertion.

---

❓ **Q4** - **Empty slot vs auto child**: When the mutator *adds* `feeder_audit`, should the workbench only open an empty mouth (pure Blockly) or still auto-attach a typed child as today’s + picker does via `attachOptionalRmChild`?

➡️ **Adopted: auto-attach a typed child when the new mouth is empty** (same as current + picker). If a saved connection is already reconnected, do not create a second child.

---

❓ **Q5** - **Chunk order after this**: Next unfinished clusters are RM completeness (PARTY_IDENTIFIED / ITEM_STRUCTURE morph), mapping-editor undo, Handlebars hardening, and tables. Which next?

➡️ **Adopted: Chunk 2 = remaining B UX that shares Blockly editor surface (undo/redo, toolbox-search, Mapping Spec gutter markers); Chunk 3 = F RM completeness.** Handlebars and tables stay later (higher risk, less blocking).

## Relevant Files

- `src/blockly/blocks/rm_blocks.ts` — `optional_rm_mutator` / `dv_fields_mutator`, + image fields, compose/decompose
- `web/main.ts` — Optional RM HTML picker + context menu
- `web/index.html` — `#dialog-optional-rm`
- `src/blockly/skeleton_loader.ts` — `attachOptionalRmChild`
- `src/workbench/controller.ts` — `addOptionalRm` / optional attachment catalog
- `src/core/rm_meta.ts` — `getValidAttachments`
- `test/blockly_rm_blocks_test.ts`
- `CONTEXT.md`, `docs/BLOCKLY_INTEGRATION.md`, `docs/ROADMAP.md`



## Priority-ordered chunks


| Prio | Chunk                                   | Roadmap items                                                                                                                                            | Why this grouping                                                                          |
| ---- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1    | Native cogwheel for optional attributes | B: replace + popup with cogwheel; non-mandatory can be removed                                                                                           | First unfinished item; Blockly-native mutator; unblocks honest optional RM/DV editing      |
| 2    | Mapping Editor chrome                   | B: undo/redo; toolbox-search plugin; Mapping Spec gutter error markers                                                                                   | Shared editor surface; independent of RM class work                                        |
| 3    | RM Blockly completeness                 | F: missing classes; toolbox sort/groups/colour; PARTY_IDENTIFIED `name`/`identifiers`; ITEM_STRUCTURE morph like EVENT                                   | Uses cogwheel once it exists; `openehr://spec/type/RM/PARTY_IDENTIFIED` + `ITEM_STRUCTURE` |
| 4    | AI copy-paste polish                    | I: validate assist; openehr-assistant prompt hint; clarify Import Suggestions label                                                                      | Small, isolated toolbar/prompt work                                                        |
| 5    | Cross-pane a11y                         | B: colourblind in→conv→out; sync highlight mapping ↔ Conversion Test Run                                                                                 | Visual language; after editor mechanics settle                                             |
| 6    | Handlebars correctness                  | G: harden Mapping preview Test Run; execute generated Handlebars script; Blockly ↔ Handlebars Template round-trip; arm Click-to-Map on source-node block | Documented as shaky; ADR 0001 / 0003                                                       |
| 7    | Maps/tables                             | C: CSV/Excel paste tables; FHIR terminology maps                                                                                                         | Needs solid map blocks (already done) + lookup blocks                                      |
| 8    | Conversion scripts                      | J golden TS/Java/XQuery/Handlebars; K full COMPOSITION XML emit + Saxon/BaseX CI                                                                         | After mapping/RM is trustworthy                                                            |
| 9    | Persistence, i18n, versioning           | B: GitHub save if logged in; full UI i18n; L: source/target version hashes                                                                               | Platform, not mapping semantics                                                            |
| 10   | Dynamic schema toolboxes                | H: JSON/XSD target drawers from schema; TakeCare test + term ids                                                                                         | Productized schema-specific Blockly                                                        |
| 11   | Better Form parity                      | G: ScriptApi / formTestApi / Cypress port                                                                                                                | Licensed optional path                                                                     |
| 12   | Later hosts                             | v1 follow-ups: Java Export UI; VS Code host; Autoplay E2E                                                                                                | Explicitly post-v1                                                                         |
| 13   | Local/offline AI skill                  | D: parallel IDE + local app; installable AI skill for suggestion format                                                                                  | Docs + skill packaging                                                                     |


Already done (do not re-open unless regression): A small fixes (including `.xml` pickers), maps de-uglify, target visualisation pane removal, CLUSTER/SECTION colour/cleanup, Handlebars language + template tab, XQuery Model B emit.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 `git checkout -b cursor/xml-file-pickers-7430` from latest `origin/main` (branch name kept; Chunk 1 is now the cogwheel item because XML pickers landed on `main`)
- [x] 1.0 Chunk 1 — Native Blockly cogwheel for optional RM / DV attributes
  - [x] 1.1 Register `optional_rm_mutator` with `decompose` / `compose` / `saveConnections` and quark types so Blockly adds a `MutatorIcon` cogwheel
  - [x] 1.2 Remove encircled + on containers and the HTML Optional RM dialog; context menu opens the mutator bubble
  - [x] 1.3 Same cogwheel pattern for DATA_VALUE `dv_fields_mutator`; remove + fields image
  - [x] 1.4 Auto-attach typed child for newly added empty structural mouths; orphan on remove; sync `optionalRm[]`
  - [x] 1.5 Tests: add/remove extra via compose without dropping remaining children; DV optional field; no PLUS input
  - [x] 1.6 Update CONTEXT.md, BLOCKLY_INTEGRATION.md, ROADMAP.md
- [x] 2.0 Chunk 2 — Mapping Editor chrome (undo/redo, toolbox-search, spec gutter markers)
  - [x] 2.1 Fix GitHub CI/Pages Test Run locatable identity (string `archetype_node_id`)
  - [x] 2.2 Canvas is source of truth: spec widget edits, Click-to-Map, and cogwheel extras stay in Blockly undo
  - [x] 2.3 Undo/Redo buttons; group user-perceived actions; Open template / Example Sets / Load Project are undoable; saves/exports are not
  - [x] 2.4 `@blockly/toolbox-search` indexes all `kind: "block"` toolbox drawers including Source, openEHR types, and Maps
  - [x] 2.5 Mapping Spec right-hand overview ticks from the same constraint warnings as Blockly triangles; click selects/pans
  - [x] 2.6 Docs: ROADMAP, CONTEXT, MAPPING_SPECIFICATION
- [ ] 3.0 Chunk 3 — RM Blockly completeness (PARTY_IDENTIFIED, ITEM_STRUCTURE morph, toolbox)
- [ ] 4.0 Chunk 4 — AI copy-paste polish
- [ ] 5.0 Chunk 5 — Colourblind language + sync highlight
- [ ] 6.0 Chunk 6 — Handlebars Test Run + round-trip
- [ ] 7.0 Chunk 7 — CSV / FHIR tables
- [ ] 8.0 Chunk 8 — Conversion script goldens + XQuery Model A/C
- [ ] 9.0 Chunk 9 — GitHub save, UI i18n, dependency hashes
- [ ] 10.0 Chunk 10 — Schema-driven dynamic toolboxes
- [ ] 11.0 Chunk 11 — Better Form parity
- [ ] 12.0 Chunk 12 — Java Export UI / VS Code host / Autoplay E2E
- [ ] 13.0 Chunk 13 — Local app + installable AI skill