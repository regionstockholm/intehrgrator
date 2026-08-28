# Tasks: Roadmap implementation chunks

Based on [docs/ROADMAP.md](../docs/ROADMAP.md) (current `main`, including 2026-08-28 AI/local additions) and [PRD-intehrgrator-v1.md](./PRD-intehrgrator-v1.md). Glossary: [CONTEXT.md](../CONTEXT.md).

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task. If implementation steps happen to fulfil several things at once then ticking off several boxes is OK.

If running in interactive mode (e.g. Gemini CLI) then stop after each parent task and let user review. If running in autonomus batch mode e.g. dispatched to Jules, then just stop if user input is crucial in order to understand further steps.

## Grill round 1 (Chunk 1 frontier)

Asked after this plan was written, before coding Chunk 1. Recommended answers **adopted** so implementation can proceed; revisit if a later review disagrees.

❓ **Q1** - **Cogwheel scope**: The new B item replaces the encircled **+** popup with Blockly’s native cogwheel mutator (same family as `controls_if` elseif/else). Does that cover only container **Optional RM Insertion**, also DATA_VALUE **+ fields**, or template-optional skeleton slots too?

➡️ **Adopted: containers + DATA_VALUE shells.** Template-mandatory and silent-mandatory `ATTR_*` / `FLD_*` slots stay locked (not in the mutator stack). Optional RM extras (`OPT_*`) and optional DV fields (`OPTFLD_*`) are add/remove via the cogwheel. Skeleton `ATTR_*` mouths are not removed from the mutator.

---

❓ **Q2** - **Mutator UI**: Mini-workspace of stackable attribute blocks (true `MutatorIcon`, like if/elseif), or a cog that still opens a checkbox popup?

➡️ **Adopted: native `MutatorIcon` mini-workspace.** Flyout quark `optional_rm_mutator_item` / `dv_fields_mutator_item` with an attribute dropdown; container quark holds the STACK. HTML `#dialog-optional-rm` goes away.

---

❓ **Q3** - **Removing an optional attribute that already has children**: Disconnect and leave the subtree on the canvas (Blockly default), confirm-then-delete, or refuse until the child is detached?

➡️ **Adopted: disconnect / orphan.** `saveConnections` + `compose` reconnect remaining sockets; a removed extra’s child is left on the canvas, not silently deleted. Mapping Model `optionalRm[]` drops that insertion.

---

❓ **Q4** - **Empty slot vs auto child**: When the mutator *adds* `feeder_audit`, should the workbench only open an empty mouth (pure Blockly) or still auto-attach a typed child as today’s + picker does via `attachOptionalRmChild`?

➡️ **Adopted: auto-attach a typed child when the new mouth is empty** (same as current + picker). If a saved connection is already reconnected, do not create a second child.

---

❓ **Q5** - **Chunk order after this**: Next unfinished clusters are RM completeness (PARTY_IDENTIFIED / ITEM_STRUCTURE morph), mapping-editor undo, Handlebars hardening, and tables. Which next?

➡️ **Adopted: Chunk 2 = remaining B UX that shares Blockly editor surface (undo/redo, toolbox-search, Mapping Spec gutter markers); Chunk 3 = F RM completeness.** Handlebars and tables stay later (higher risk, less blocking).

## Grill round 2 (Chunk 3 — RM Blockly completeness)

Asked before coding Chunk 3. Recommended answers **adopted** (user confirmed all Q1–Q7).

❓ **Q1** - **PARTY_IDENTIFIED attrs when not using `external_ref`**: Show `name` only, `name`+`identifiers`, or all three (`external_ref`, `identifiers`, `name`)? Which are default-visible vs cogwheel?

➡️ **Adopted: default-visible `name` on `PARTY_IDENTIFIED` / `PARTY_RELATED`.** `identifiers` and `external_ref` stay out of the default shell until demographics tooling exists (see README note).

---

❓ **Q2** - **`identifiers: List<DV_IDENTIFIER>`** representation: statement chain of `dv_identifier` shells, single identifier, or maps-only for v1?

➡️ **Adopted: defer to a later demographics chunk** — no `DV_IDENTIFIER` Blockly shell yet; document the gap rather than half-implement list UI.

---

❓ **Q3** - **`PARTY_REF` / `external_ref`**: add a `party_ref` block, or treat REF-only paths as out of scope for Blockly shells?

➡️ **Adopted: out of scope for Chunk 3** (no `party_ref` block). Demographics / REF tooling is a follow-up.

---

❓ **Q4** - **ITEM_STRUCTURE morph**: one abstract `item_structure` block with dropdown (like EVENT), or keep four concrete blocks only?

➡️ **Adopted: abstract `item_structure` block with dropdown** plus existing concrete `item_tree` / `item_list` / `item_table` / `item_single` toolbox entries.

---

❓ **Q5** - **Morph subtype set**: `ITEM_TREE` / `ITEM_LIST` / `ITEM_TABLE` / `ITEM_SINGLE` — same four as slot checks?

➡️ **Adopted: yes** — align with `nestCheckFor` / `resolveGenericSlotType` (`ITEM_STRUCTURE` generic bound on `EVENT.data`, etc.).

---

❓ **Q6** - **Abstract warnings**: warn on abstract `ITEM_STRUCTURE` like `ABSTRACT_EVENT_WARNING` for `EVENT`?

➡️ **Adopted: yes** — constraint triangle + message until a concrete subtype is chosen.

---

❓ **Q7** - **Toolbox sort/groups/colour**: split `openEHR types` into sub-drawers (entries, items/events, party, DV, terminology) and surface missing RM blocks?

➡️ **Adopted: yes** — nested toolbox categories; common composition/entry blocks first; optional RM types (`feeder_audit`, `link`, …) in entries drawer.

## Relevant Files

- `src/blockly/blocks/rm_blocks.ts` — RM containers, EVENT / ITEM_STRUCTURE morph, party `name` slot
- `src/blockly/toolbox_demo.ts` — nested openEHR toolbox drawers
- `src/blockly/block_constraints.ts` — abstract EVENT / ITEM_STRUCTURE warnings
- `web/main.ts` — `RM_TYPE` change listener for morph blocks
- `test/blockly_rm_blocks_test.ts`
- `CONTEXT.md`, `docs/BLOCKLY_INTEGRATION.md`, `docs/ROADMAP.md`

## Priority-ordered chunks

| Prio | Chunk | Roadmap items | Why this grouping |
|------|-------|----------------|-------------------|
| 1 | Native cogwheel for optional attributes | B: replace + popup with cogwheel; per-option flyout; header placement | Blockly-native mutator; honest optional RM/DV editing |
| 2 | Mapping Editor chrome | B: undo/redo; toolbox-search; Mapping Spec gutter markers | Shared editor surface |
| 3 | RM Blockly completeness | F: PARTY `name`; ITEM_STRUCTURE morph; toolbox groups; missing RM blocks in drawer | Mapping defaults + manual RM authoring |
| 4 | AI copy-paste polish | I: validate assist; openehr-assistant prompt hint; clarify Import Suggestions label | Web-first AI; small toolbar/prompt work |
| 5 | Local/offline AI integration | D: parallel IDE + desktop app; installable skill; optional MCP on running executable | Desktop binary + IDE/CLI; atomic model edits with undo timestamps |
| 6 | Cross-pane a11y | B: colourblind in→conv→out; sync highlight mapping ↔ Conversion Test Run | Visual language |
| 7 | Handlebars correctness | G: harden Mapping preview Test Run; execute generated Handlebars script; Blockly ↔ Handlebars Template round-trip; arm Click-to-Map on source-node block | ADR 0001 / 0003 |
| 8 | Maps/tables | C: CSV/Excel paste tables; FHIR terminology maps | Lookup blocks + table digest |
| 9 | Conversion scripts | J golden TS/Java/XQuery/Handlebars; K full COMPOSITION XML emit + Saxon/BaseX CI | After mapping/RM is trustworthy |
| 10 | Persistence, i18n, versioning | B: GitHub save if logged in; full UI i18n; L: source/target version hashes | Platform |
| 11 | Dynamic schema toolboxes | H: JSON/XSD target drawers from schema; TakeCare test + term ids | Productized schema-specific Blockly |
| 12 | Better Form parity | G: ScriptApi / formTestApi / Cypress port | Licensed optional path |
| 13 | Later hosts | v1 follow-ups: Java Export UI; VS Code host; Autoplay E2E | Post-v1 |

Already done (do not re-open unless regression): A small fixes (including `.xml` pickers), maps de-uglify, target visualisation pane removal, CLUSTER/SECTION colour/cleanup, Handlebars language + template tab, XQuery Model B emit, Chunk 1 cogwheel UX (per-option flyout + header placement, PR #13).

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
  - [x] 1.7 Per-option mutator flyout (no dropdown) + header cogwheel placement (roadmap B line 11)
- [x] 2.0 Chunk 2 — Mapping Editor chrome (undo/redo, toolbox-search, spec gutter markers)
  - [x] 2.1 Fix GitHub CI/Pages Test Run locatable identity (string `archetype_node_id`)
  - [x] 2.2 Canvas is source of truth: spec widget edits, Click-to-Map, and cogwheel extras stay in Blockly undo
  - [x] 2.3 Undo/Redo buttons; group user-perceived actions; Open template / Example Sets / Load Project are undoable; saves/exports are not
  - [x] 2.4 `@blockly/toolbox-search` indexes all `kind: "block"` toolbox drawers including Source, openEHR types, and Maps
  - [x] 2.5 Mapping Spec right-hand overview ticks from the same constraint warnings as Blockly triangles; click selects/pans
  - [x] 2.6 Docs: ROADMAP, CONTEXT, MAPPING_SPECIFICATION
- [x] 3.0 Chunk 3 — RM Blockly completeness (PARTY `name`, ITEM_STRUCTURE morph, toolbox)
  - [x] 3.1 `PARTY_IDENTIFIED` / `PARTY_RELATED`: default-visible `name` value slot (defaults + mapping)
  - [x] 3.2 Abstract `item_structure` block with EVENT-style morph (`applyItemStructureRmType`)
  - [x] 3.3 `ABSTRACT_ITEM_STRUCTURE_WARNING` + `web/main.ts` `RM_TYPE` listener
  - [x] 3.4 Nested openEHR toolbox drawers; add missing RM blocks to flyout
  - [x] 3.5 README note: demographics blocks (`PARTY_REF`, `DV_IDENTIFIER` lists) not yet implemented
  - [x] 3.6 Tests: party `name`, ITEM_STRUCTURE morph, toolbox nesting
  - [x] 3.7 Docs: ROADMAP F items, TASKS grill round 2, README
- [ ] 4.0 Chunk 4 — AI copy-paste polish (roadmap I)
  - [ ] 4.1 Validate cut-and-paste AI suggestion import end-to-end
  - [ ] 4.2 Prompt/instruction hints for openehr-assistant MCP (+ DeepWiki link)
  - [ ] 4.3 Clarify **Import AI suggestion** toolbar label
- [ ] 5.0 Chunk 5 — Local/offline AI integration (roadmap D)
  - [ ] 5.1 Document desktop app + IDE working on same project files in parallel
  - [ ] 5.2 Installable AI skill: intEHRgrator mapping suggestion format + project layout
  - [ ] 5.3 Optional MCP on running desktop executable: model/canvas ops, scroll/highlight, undo timestamp per atomic edit
  - [ ] 5.4 Investigate multi-agent coordination via undo log / last-change tokens (CRDT/OT deferred)
- [ ] 6.0 Chunk 6 — Colourblind language + sync highlight
- [ ] 7.0 Chunk 7 — Handlebars Test Run + round-trip
- [ ] 8.0 Chunk 8 — CSV / FHIR tables
- [ ] 9.0 Chunk 9 — Conversion script goldens + XQuery Model A/C
- [ ] 10.0 Chunk 10 — GitHub save, UI i18n, dependency hashes
- [ ] 11.0 Chunk 11 — Schema-driven dynamic toolboxes
- [ ] 12.0 Chunk 12 — Better Form parity
- [ ] 13.0 Chunk 13 — Java Export UI / VS Code host / Autoplay E2E
