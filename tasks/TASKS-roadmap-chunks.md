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

## Grill round 3 (Chunk 4 frontier)

Asked before coding Chunk 4 (AI copy-paste polish). Recommended answers **adopted**.

❓ **Q1** - **openEHR references in prompt**: Should Copy AI Prompt mention the openehr-assistant MCP, link to docs, or both?

➡️ **Adopted: both.** Add an **openEHR references** section when the target is an openEHR template: hint to use the openehr-assistant MCP for spec/archetype lookup, plus links to `docs/OPENEHR_PRIMER.md`, `docs/AI_SUGGESTION_FORMAT.md`, and DeepWiki/ehrtslib.

---

❓ **Q2** - **Import button label**: Toolbar still says “Import Suggestions”; rename to “Import AI suggestions”?

➡️ **Adopted: already fixed on `main`.** No further work.

---

❓ **Q3** - **CI validation depth**: Should recurring CI call a live LLM, or only fixture/round-trip tests?

➡️ **Adopted: fixture/round-trip only; no live LLM in recurring CI.**

---

❓ **Q4** - **Suggestion envelope breadth**: Expand allowed value `block.type` list and prompt examples (e.g. `maps_get`, loops, party `name` slots)?

➡️ **Adopted: yes.** Add `maps_get` to schema + import codegen; document examples for defaults lookup, repeating containers, and party identity value slots (`name` via `source_query` / `text`).

---

❓ **Q5** - **Partial import**: On schema/apply errors, import valid entries only and report counts?

➡️ **Adopted: yes.** Keep apply-valid-only behaviour; surface applied / loops / skipped / errors / schema counts in the import dialog summary.

## Grill round 1 (Chunk 5 frontier)

Asked before coding Chunk 5 (local app + installable AI skill + agent/MCP driving). User answers **adopted** 2026-08-31.

❓ **Q1** - **Chunk 5 boundary**: Docs/skill only, thin Agent API, or full MCP server in this chunk?

➡️ **Adopted: C (MCP server in Chunk 5).** Include PEN-style MCP on the running desktop app. OK to **split implementation into separate commits/parts** (e.g. core service → HTTP API → MCP tools → docs/skill) for easier review and testing.

---

❓ **Q2** - **Primary agent workflow**: Files on disk, live session, copy-paste only, or combined?

➡️ **Adopted: D.** File-first baseline (`.intehrgrator` / project folder) **plus** live session when desktop is open. Web shell stays copy-paste primary.

---

❓ **Q3** - **API layer**: Extend test API, core service, HTTP wrapper, or phased extraction?

➡️ **Adopted: D (phased).** Extract **`WorkbenchService`** in core operating on **`ProjectBundle` / Blockly JSON / Mapping Model** — **no HTML DOM manipulation**. Desktop exposes localhost HTTP; MCP calls the same service. `intehrgratorTestApi` becomes a thin UI/test client where possible.

---

❓ **Q4** - **Write granularity**: Import-only, single-slot map, loops/optional RM/defaults, full workspace replace?

➡️ **Adopted: C + D.** Agent API must support **`importSuggestions`**, **loops**, **optional RM extras**, and **defaults map** edits. **`loadBlocklyJson` / full workspace replace** remains an escape hatch. Loops are first-class for mapping.

---

❓ **Q5** - **Concurrency & revision**: Defer, revision token only, undo exposure, or both?

➡️ **Adopted: D.** Mutating calls return a **revision token** (optimistic concurrency) **and** expose **undo / redo** on the Agent API.

---

❓ **Q6** - **Installable skill packaging**

➡️ **Adopted: A.** In-repo `.cursor/skills/intehrgrator-mapping/SKILL.md` (and agents mirror) **plus** `docs/AGENT_WORKFLOW.md`.

---

❓ **Q7** - **Golden path documentation**

➡️ **Adopted: B primary** — IDE + **desktop app side-by-side**; agent calls **localhost API** while user watches the canvas update. **Fallback (C-like):** when MCP/API is unavailable, document read-only / downstream export of mapping spec or generated conversion script (not round-trip authoring).

## Grill round 1 (Chunk 5 follow-up — multi-agent MCP presence & attribution)

Asked after Chunk 5 shipped (0.3 desktop: Agent API + MCP + skill). Deferred from 5.3: scroll/highlight, multi-agent visibility, actor-attributed undo. **Not adopted yet** — awaiting answers.

Context from product direction:

- Scrolling the **main** Mapping Editor canvas to follow an agent likely **disrupts** a human who is editing or reviewing elsewhere on the canvas.
- The existing **Open canvas** button (`openCanvasSnapshot` / `workspace_snapshot.ts`) opens a **separate popup** with a standalone Blockly SVG (print/save today). That window could become a **live observer** for agent activity — PEN-style — without moving the user's viewport.
- Chunk 5 already has **revision tokens + undo/redo** on `WorkbenchService` / Agent API, but undo entries carry **no actor** (user vs named agent). Blockly's native undo stack is separate and also actor-less.
- Roadmap D still has an open item: MCP scroll/highlight (currently unchecked).

❓ **Q1** - **Chunk placement**: Where does multi-agent MCP presence land relative to schema toolboxes (current Chunk 6)?

**A** — New **Chunk 6** (multi-agent MCP UX + attribution); push dynamic schema toolboxes to Chunk 7+.  
**B** — Small **Chunk 5.1** patch release before any Chunk 6 work.  
**C** — Fold into Chunk 6 schema toolboxes (same PR).  
**D** — Split: **6a** actor/undo attribution only; **6b** observer UI / colours later.

➡️ **Recommended: A.** Natural completion of deferred 5.3; schema toolboxes (H) are unrelated and should not block PEN-style agent visibility.

---

❓ **Q2** - **Main canvas behaviour on agent edits**: Should MCP/API mutations ever scroll or pan the primary Mapping Editor?

**A** — **Never** auto-scroll/pan the main canvas on agent edits (user keeps full viewport control).  
**B** — Opt-in toolbar setting: “Follow active agent”.  
**C** — Scroll/pan **only** in the observer window (see Q3), never the main canvas.  
**D** — Brief in-canvas flash/highlight on touched blocks **without** changing scroll position.

➡️ **Recommended: A + D.** No viewport hijacking; at most a subtle, non-scrolling pulse on affected blocks in the main editor. Full “where are they working?” view belongs elsewhere.

---

❓ **Q3** - **Observer surface**: How should users *watch* multiple simultaneous agents (PEN.dev-like)?

**A** — Extend **Open canvas** popup into a **live multi-agent observer** (layered SVG, per-agent colour, legend with agent names). Static print/save remains available.  
**B** — New dedicated **“Agent activity”** top-level window (separate from Open canvas).  
**C** — Docked **pane inside** the main window (split view below or beside Mapping Editor).  
**D** — No live UI — agents only; user reads MCP logs / IDE chat.

➡️ **Recommended: A.** Reuses `openWorkspaceSnapshotWindow` / `workspace_snapshot.ts` and the existing toolbar affordance; popup is already “out of the way” of the main canvas. Optional auto-open when first agent connects.

---

❓ **Q4** - **Agent identity (name, id, colour)**: How are concurrent agents distinguished?

**A** — **Register on connect** (MCP `initialize` or new `register_agent` tool): `{ agentId, displayName, color? }`.  
**B** — Pass **`agentName` / `agentId` on every mutating API call** (header or JSON field); desktop assigns colour from id hash if omitted.  
**C** — Desktop **UI registry** — user names/colours agents before IDE connects.  
**D** — Anonymous sessions; colour by MCP connection order only.

➡️ **Recommended: B (+ palette from agentId).** Matches “terminology agent + source-mapping agent” running in parallel from different IDE sessions; no extra connect handshake required if each mutation carries identity. Optional explicit registration later.

---

❓ **Q5** - **Highlight semantics**: What does each agent’s colour mean, and for how long?

**A** — **Transient** outline on blocks/slots touched by last mutation; fade after N seconds.  
**B** — **Persistent** tint on all blocks last edited by that agent until someone else edits them.  
**C** — **Observer window only** — full per-agent layers; main canvas shows only neutral bundle sync (no colours).  
**D** — **Dual**: subtle badge/pulse on main canvas + full colour-coded overlay in observer window.

➡️ **Recommended: D.** Main editor stays calm; observer window is the PEN-style “mission control” with stacked or toggled agent layers and a legend.

---

❓ **Q6** - **Undo/redo attribution**: Who gets credit in history — and where is it stored?

**A** — **`WorkbenchService` / Agent API undo stack only** — each entry `{ actor: user | agent, id, displayName, revision, summary }`; Blockly native undo unchanged for direct user block edits.  
**B** — **Unified history** — merge Blockly events + service snapshots into one timeline with actor on every row.  
**C** — **Separate stacks** — “Undo my edit” (Blockly) vs “Undo last agent change” (API).  
**D** — Extend **Blockly custom events** (`DocumentSwapEvent`, future slot events) with an `actor` field so one stack serves both.

➡️ **Recommended: A first, D later.** Agent mutations already flow through `WorkbenchService.withUndo`; add actor metadata there and expose via `GET /api/v1/history` + desktop undo menu labels (“Undo **TerminologyAgent**: map ICD→SNOMED”). Bridging Blockly micro-edits into the same timeline is a second phase.

---

❓ **Q7** - **Simultaneous writes & conflicts**: Two agents edit different slots at once — what happens?

**A** — **Revision + 409** (current): second writer refreshes snapshot and retries; no slot-level locking.  
**B** — **Slot leases**: optional `POST /api/v1/lease-slot` so an agent holds a slotId while thinking.  
**C** — **Serial queue** per project — one mutation at a time globally.  
**D** — **Merge report** — apply non-conflicting slot updates; return conflicts for human/agent retry (like partial import).

➡️ **Recommended: A for v1; B optional for v2.** Terminology agent on Maps + mapping agent on value slots rarely collide on the same slotId; revision tokens already shipped. Leases help if two agents target the same subtree.

---

### Relevant files (Chunk 5 follow-up — when adopted)

- `src/workbench/service.ts` — undo stack + actor metadata on mutations
- `src/agent/http.ts` / `src/agent/mcp_stdio.ts` — `agentId` / `agentName` on tools; `GET /history`
- `src/web/agent_bridge.ts` — push agent highlight events to UI without scrolling main workspace
- `src/blockly/workspace_snapshot.ts` — live observer window (multi-agent SVG layers)
- `web/main.ts` — Open canvas → observer mode; undo menu shows actor
- `docs/AGENT_WORKFLOW.md` — multi-agent setup, colours, observer window
- `CONTEXT.md` — Agent actor, observer canvas, attributed undo

## Relevant Files (Chunk 5)

- `src/workbench/controller.ts` — extract `WorkbenchService` seam
- `src/core/persistence/mod.ts` — `ProjectBundle` load/save
- `src/core/ai/mod.ts` — `buildPrompt`, `importSuggestions`
- `src/ui_test/test_api.ts` — thin client over service (not DOM-first agent API)
- `src/desktop/` — localhost Agent API + MCP server (opt-in)
- `docs/AGENT_WORKFLOW.md` — golden path (B) + fallback (C)
- `.cursor/skills/intehrgrator-mapping/SKILL.md` — installable agent SOP
- `CONTEXT.md` — Workbench Agent API, session revision (when implemented)

## Relevant Files (Chunks 1–4)

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
| 4    | AI copy-paste polish                    | I: validate assist; openehr-assistant prompt hint; clarify Import AI suggestions label                                                                   | Small, isolated toolbar/prompt work                                                        |
| 5    | Local/offline AI skill                  | D: parallel IDE + local app; installable AI skill for suggestion format                                                                                  | Docs + skill packaging                                                                     |
| 6    | Dynamic schema toolboxes                | H: JSON/XSD target drawers from schema; TakeCare test + term ids                                                                                         | Productized schema-specific Blockly                                                        |
| 7    | Handlebars correctness                  | G: harden Mapping preview Test Run; execute generated Handlebars script; Blockly ↔ Handlebars Template round-trip; arm Click-to-Map on source-node block | Documented as shaky; ADR 0001 / 0003                                                       |
| 8    | Maps/tables                             | C: CSV/Excel paste tables; FHIR terminology maps                                                                                                         | Needs solid map blocks (already done) + lookup blocks                                      |
| 9    | Conversion scripts                      | J golden TS/Java/XQuery/Handlebars; K full COMPOSITION XML emit + Saxon/BaseX CI                                                                         | After mapping/RM is trustworthy                                                            |
| 10   | Persistence, i18n, versioning           | B: GitHub save if logged in; full UI i18n; L: source/target version hashes                                                                               | Platform, not mapping semantics                                                            |
| 11   | Better Form parity                      | G: ScriptApi / formTestApi / Cypress port                                                                                                                | Licensed optional path                                                                     |
| 12   | Later hosts                             | v1 follow-ups: Java Export UI; VS Code host; Autoplay E2E                                                                                                | Explicitly post-v1                                                                         |
| 13   | Cross-pane a11y                         | B: colourblind in→conv→out; sync highlight mapping ↔ Conversion Test Run                                                                                 | Visual language; after editor mechanics settle                                             |


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
- [x] 3.0 Chunk 3 — RM Blockly completeness (PARTY identity, ITEM_STRUCTURE morph, toolbox)
  - [x] 3.1 `PARTY_IDENTIFIED` / `PARTY_RELATED`: `name`, `identifiers`, `external_ref` slots
  - [x] 3.2 `party_ref` block + `dv_identifier` in Party toolbox drawer
  - [x] 3.3 Abstract `item_structure` morph + abstract warning
  - [x] 3.4 Nested openEHR toolbox drawers; missing RM blocks in flyout
  - [x] 3.5 TypeScript codegen for `PARTY_REF`, list-valued `identifiers`
  - [x] 3.6 Tests + README note (full Demographics compositions still future)
- [x] 4.0 Chunk 4 — AI copy-paste polish (roadmap I)
  - [x] 4.1 `buildPrompt`: openEHR references section (openehr-assistant MCP hint + doc links) when target is openEHR
  - [x] 4.2 Expand suggestion envelope: `maps_get` in schema, docs, import codegen; prompt examples for loops / defaults / party `name`
  - [x] 4.3 Import dialog: apply-valid-only with clear applied / skipped / schema counts (Q5)
  - [x] 4.4 Fixture + round-trip tests only (no live LLM in CI)
  - [x] 4.5 ROADMAP I items ticked; Q2 label already on `main`
- [x] 5.0 Chunk 5 — Local app + installable AI skill + MCP (roadmap D)
  - [x] 5.1 Extract `WorkbenchService` (bundle I/O, prompt, import, loops, test, slot map) on Blockly JSON / model — no DOM
  - [x] 5.2 Desktop localhost Agent API (opt-in): revision + undo/redo; UI subscribes to service
  - [x] 5.3 MCP stdio server over same service (scroll/highlight on edit deferred to follow-up)
  - [x] 5.4 `docs/AGENT_WORKFLOW.md` — golden path B (IDE + desktop API); fallback C when MCP unavailable
  - [x] 5.5 `.cursor/skills/intehrgrator-mapping/SKILL.md` + agents mirror
  - [x] 5.6 Tests: service round-trips without browser; MCP/HTTP integration tests (separate commits per part OK)
- [ ] 5.1 Chunk 5 follow-up — Multi-agent MCP presence (grill round 1 above; deferred from 5.3)
- [ ] 6.0 Chunk 6 — Schema-driven dynamic toolboxes (roadmap H)
- [ ] 7.0 Chunk 7 — Handlebars Test Run + round-trip (roadmap G)
- [ ] 8.0 Chunk 8 — CSV / FHIR tables (roadmap C)
- [ ] 9.0 Chunk 9 — Conversion script goldens + XQuery Model A/C (roadmap J/K)
- [ ] 10.0 Chunk 10 — GitHub save, UI i18n, dependency hashes (roadmap B/L)
- [ ] 11.0 Chunk 11 — Better Form parity (roadmap G)
- [ ] 12.0 Chunk 12 — Java Export UI / VS Code host / Autoplay E2E
- [ ] 13.0 Chunk 13 — Colourblind language + sync highlight (roadmap B)