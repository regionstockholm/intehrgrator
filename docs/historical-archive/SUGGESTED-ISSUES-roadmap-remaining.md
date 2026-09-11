# Suggested GitHub issues — remaining roadmap work

> **⚠️ ARCHIVED** — This was a staging list for filing GitHub issues. **Live planning is now [GitHub Issues](https://github.com/regionstockholm/intehrgrator/issues)** — see [docs/agents/issue-tracker.md](../agents/issue-tracker.md).

**Date:** 2026-09-09  
**Sources:** [ROADMAP.md](./ROADMAP.md), [TASKS-roadmap-chunks.md](./TASKS-roadmap-chunks.md), open GitHub issues (cross-checked).  
**Purpose:** Inspect and edit this list before filing real issues. Do **not** treat unchecked boxes here as tracker state.

## Snapshot

| Area | Status |
| ---- | ------ |
| Chunks **1–8** + **5.1** | Done (merged) |
| Chunk **7.1** (Handlebars Mapping preview) | Still open in task list |
| Chunks **9–14** | Open; Chunk 9 core is **#38–#41** (VMS profile **#35** / IR **#37** done) |
| Constraint Overlay Phase 1 | Done (**#46** closed / PR #48) |

---

## A. Existing open issues — keep (amendments applied 2026-09-09)

Bodies updated on GitHub for #35, #37, #38, #39, #49, #51, #52. No body change needed for #21, #40, #41. Triage labels `ready-for-agent` / `needs-triage` / `needs-info` / `ready-for-human` were created on the repo.

| Issue | Verdict |
| ----- | ------- |
| **[#35](https://github.com/regionstockholm/intehrgrator/issues/35)** Decide: remove verification-hostile Blockly from the toolbox | **Done** (PR #58). |
| **[#37](https://github.com/regionstockholm/intehrgrator/issues/37)** Extend Mapping Model IR beyond flat `slots[]` | **Done** (PR #58). |
| **[#38](https://github.com/regionstockholm/intehrgrator/issues/38)** Unify Mapping preview vs TypeScript vs XQuery on VMS | **Keep; VMS frontier #1.** Absorbs ROADMAP J (TS) acceptance; Java/Handlebars compare out of scope. |
| **[#39](https://github.com/regionstockholm/intehrgrator/issues/39)** XQuery: `for_each_source` + nested structure | **Keep; VMS frontier #2.** Follow-up child section for ROADMAP K (COMPOSITION XML + Saxon/BaseX); no parallel Chunk 9 epic. |
| **[#40](https://github.com/regionstockholm/intehrgrator/issues/40)** Workspace linter for VMS escape hatches | **Keep; VMS frontier #3.** |
| **[#41](https://github.com/regionstockholm/intehrgrator/issues/41)** Property-based / metamorphic checks | **Keep; VMS frontier #4.** Separate from S-07 dependency hashes. |
| **[#21](https://github.com/regionstockholm/intehrgrator/issues/21)** Remove ehrtslib vendor `code_list` patch | **Keep.** Optional contract assert already in body. |
| **[#49](https://github.com/regionstockholm/intehrgrator/issues/49)** Scaffolding rule updates + defaults / TERM_PICK UX | **Keep.** Full-object Defaults scaffolding clarified. |
| **[#51](https://github.com/regionstockholm/intehrgrator/issues/51)** Mapping Spec / Sheets editor chrome (tabs, dividers, button order) | **Keep.** Multi-sheet tabs called out as the Sheets gap. |
| **[#52](https://github.com/regionstockholm/intehrgrator/issues/52)** Discoverability of non-openEHR blocks (glyphs + mutator placement) | **Keep.** Unify mutator placement first; colour-safe glyphs; soft-link S-11. |

**Closed / do not re-open:** #46 Constraint Overlay Phase 1. Phase 2+ (value-domain overlay) is out of ROADMAP for now — only file if you want it tracked.

---

## B. Suggested **new** issues (implementation-sized)

Edit titles/bodies freely. Proposed order is “good next agents,” not a hard priority lock.

### S-01 — Harden Handlebars Mapping preview (Chunk 7.1)

**Combines:** ROADMAP G (preview Test Run hardening); TASKS 7.1.1–7.1.7 / 7.6 carry-over.

**Why one issue:** Small, fixture-first, unblocks later Handlebars codegen/example work; independent of the VMS chain (#38+).

**Acceptance sketch:**
- Kintegrate fixtures assert via `runTest` Mapping preview, not only direct `renderHandlebars`
- Parity: same fixture under `outputMode: "preview"` and `"handlebars"`
- Slot/json interop (`{{slot}}`, `{{{json (slot …)}}}`)
- Fix `handlebars()` builtin to pass slot bag
- Docs: ADR 0003 / ROADMAP wording

**Out of scope:** Blockly→Handlebars codegen (S-10); Better Form parity (S-09).

---

### S-02 — Multi-column equality `sheet_lookup`

**Combines:** ROADMAP C multi-column lookup; TASKS Chunk 8 “(later) multi-column equality”; first slice of [`docs/future/decision-tables-for-mapping.md`](../docs/future/decision-tables-for-mapping.md).

**Why separate from decision tables:** Still a Sheet (data grid), not predicates/hit policies. Small Blockly + model + codegen change.

**Acceptance sketch:**
- AND of several `header = value` pairs; first matching row
- Mapping Spec widget + TS/XQuery/Go emit or clear “unsupported”
- Tests in sheet evaluate + one fixture

**Blocked by:** none (Chunk 8 done).  
**Blocks:** S-03 (nice-to-have precursor).

---

### S-03 — Decision tables (`kind: decision-table`) + lung-MDT sibling Example Set

**Combines:** ROADMAP C decision tables; TASKS later decision-table items; investigation doc.

**Why one issue (large):** Model + UI + convert semantics + Example Set are one vertical slice. Split PRs inside if needed (model → Blockly/host → example).

**Acceptance sketch:**
- Sheets-adjacent `kind`; predicate cells, don't-care; hit policy FIRST then UNIQUE/COLLECT
- Mixed **value** and **snippet** output columns
- Sibling Example Set `examples/lung-MDT-form-decision-tables/` (catalog id `lung-mdt-form-to-tc-xml-decision-tables`); do **not** replace `examples/lung-MDT-form/`
- No FEEL; no DMN yet

**Blocked by:** S-02 recommended.  
**Out of scope:** DMN I/O (S-04); FHIR import (S-05).

---

### S-04 — DMN import/export for simple decision tables

**Combines:** ROADMAP C DMN; TASKS later DMN.

**Why separate:** Only after internal decision-table JSON is stable.

**Acceptance sketch:** Equality/range + FIRST/UNIQUE/COLLECT only; no FEEL as Mapping Expression language.

**Blocked by:** S-03.

---

### S-05 — FHIR ConceptMap / ValueSet → Sheet import

**Combines:** ROADMAP C FHIR deferred item.

**Why separate:** Independent of decision tables; feeds terminology Sheets.

**Acceptance sketch:** Parse FHIR JSON into project Sheet model; optional Example/fixture; no runtime FHIR server required for v1.

**Blocked by:** none (accessors exist). Soft-after S-02 if multi-key lookups help.

---

### S-06 — GitHub-backed project save (when logged in)

**Combines:** ROADMAP B “Integrate save functions with github repo”.

**Why split from i18n/hashes:** Auth + repo I/O is a different stack from chrome strings or content hashing.

**Acceptance sketch:** Save/load `.intehrgrator` (or project folder) to a user repo when authenticated; Web Shell path clear; desktop may keep local-first.

**Related open UX:** none. Independent of #51.

---

### S-07 — Source/target dependency version hashes before convert

**Combines:** ROADMAP L.

**Why separate:** Correctness guardrail; small core change; pairs well with Test Run, not with GitHub OAuth.

**Acceptance sketch:** Detect OPT/schema/source identity change since last successful load (hash or version); warn or fail convert when stale; document behaviour.

**Related:** #41 is generative robustness; this is dependency drift. Keep both.

---

### S-08 — Full application UI i18n

**Combines:** ROADMAP B full UI i18n (toolbar language already switches Blockly/stock).

**Why separate:** Large string inventory; keep model/ontology language (Target pane) separate as already specified.

**Acceptance sketch:** Pane titles, buttons, tips, status from same UI-language setting; `en`/`sv`/… parity for chrome; jspreadsheet `setDictionary` already noted in Chunk 8 grill.

**Soft-link:** #52 / S-11 — translated strings must not rely on colour alone.

---

### S-09 — Better Form Bridge: ScriptApi / formTestApi / Cypress parity

**Combines:** ROADMAP G Better Form parity; Chunk 11.

**Why one issue:** Licensed optional path; natural single epic with phased checklist.

**Acceptance sketch:** Documented parity matrix vs Better form-viewer APIs; Cypress generator port or explicit deferrals.

**Blocked by:** S-01 useful if forms lean on Handlebars preview.

---

### S-10 — Blockly → Handlebars codegen + reverse-engineered Handlebars Example Set

**Combines:** ROADMAP G Blockly→Handlebars codegen + Handlebars example set / non-Blockly harness.

**Why combine:** Same language family; example set validates codegen. Split into two issues if you prefer smaller PRs (codegen first, then example).

**Acceptance sketch:**
- `generate(model, "handlebars")` (or agreed surface) for VMS-ish mappings
- Example Set + expected output harness for Handlebars files (after chemo Go example pattern)
- Non-Blockly editing support only as needed for the harness

**Blocked by:** S-01. Soft-align with #38 if codegen should stay on VMS.

---

### S-11 — Colourblind-safe in→conv→out language + sync highlight

**Combines:** ROADMAP B colourblind patterns + sync highlight mapping ↔ Conversion Test Run; Chunk 13.

**Why combine:** One visual language across panes; sync highlight is the same design system.

**Acceptance sketch:**
- Consistent colour **and** pattern for source → conversion → target (syntax highlight, block colours, Test Run)
- Sync highlight between mapping selection and Test Run (and optionally generated script)
- Works with #52 glyphs (icons + patterns, not colour-only)

**Blocked by:** none hard; nicer after #51/#52 so chrome is not mid-refactor.

---

### S-12 — TakeCare schema golden + term-id systems (test vs prod)

**Combines:** ROADMAP H remaining TakeCare items.

**Why one issue:** Vendor-specific; Chunk 6 deliberately deferred both.

**Acceptance sketch:** Decide design-time vs runtime plugin story; golden load of TakeCare XSD; term-id blocks / system switch for test vs prod.

**Note:** Chemo Example Set already exercises TakeCare **schema blocks** at runtime — this issue is the productized/vendor extras, not “can we load an XSD.”

---

### S-13 — Later hosts epic (checklist) — Java Export UI / VS Code / Autoplay E2E

**Combines:** ROADMAP / Chunk 12.

**Why one epic with three child issues (recommended):** Different stacks; filing three separate issues is fine — use this as parent text if you want a single tracking issue:

1. Java Export UI  
2. VS Code extension host  
3. Autoplay E2E  

Mark post-v1 explicitly.

---

### S-14 — Human multi-user collaboration (Chunk 14)

**Combines:** ROADMAP B/D multi-user; Chunk 14; [`ARCHITECTURE-multi-user-collab-prep.md`](../design/ARCHITECTURE-multi-user-collab-prep.md).

**Why one late epic:** CRDT/sync spike + rooms; 5.1 already laid actor/history seams. Do not start until single-user VMS/platform work is calm.

**Acceptance sketch:** Spike choice (Automerge/Yjs/Loro per design docs); shared room prototype; no requirement to finish full product in one issue.

---

### S-15 (optional) — Agent API slot leases (Chunk 5.2 leftover)

**Combines:** TASKS 5.1 grill Q7 Phase 5.2 optional leases.

**Why optional/small:** Revision+409 + merge report already shipped; leases only if multi-agent contention hurts in practice.

---

### S-16 (optional / docs-light) — Prefer STRUCTURED over FLAT as openEHR source

**Combines:** ROADMAP G note on FLAT vs STRUCTURED.

**Why optional:** Mostly product guidance + loader UX; FLAT must remain supported. Could be a short enhancement or docs-only issue.

---

## C. Do **not** file as new issues (covered elsewhere)

| Roadmap / task item | Covered by |
| ------------------- | ---------- |
| Chunk 9 “golden TS/Java/XQuery” (core of J) | **#38** (+ expand #38 as above); **#35/#37 done** |
| XQuery loops / nested emit | **#39** |
| Escape-hatch warnings | **#40** |
| Metamorphic / PBT robustness | **#41** |
| MCP scroll/highlight / multi-agent observer | Done in Chunk 5.1 (ROADMAP updated) |
| Schema JSON/XSD dynamic toolboxes + generic drawers | Done in Chunk 6 (ROADMAP updated) |
| Sheets widget + `sheet_*` | Done in Chunk 8 |
| `source_query_node` click-to-map | Done (Chunk 7.10; ROADMAP updated) |
| RM “missing classes” flyout pass | Done in Chunk 3 (ROADMAP updated) |
| Constraint Overlay Phase 1 | **#46** closed |

Full COMPOSITION XML + Saxon/BaseX CI: prefer **extending #39** (or a child of #39) rather than a fresh “Chunk 9” issue.

---

## D. Suggested filing order (for agents)

1. **#38 → #39 → #40 → #41** VMS frontier (toolbox cut + IR extension done in PR #58)  
2. **S-01** Handlebars preview (parallel to VMS chain is OK)  
3. **#21** anytime  
4. **#49 / #51 / #52** UX — parallel, human-facing  
5. **S-02 → S-03 → S-04** sheets → decision tables → DMN  
6. **S-05** FHIR import when terminology workflows need it  
7. **S-06 / S-07 / S-08** platform (order flexible)  
8. **S-09 / S-10** Better Forms + Handlebars codegen  
9. **S-11** a11y visual language  
10. **S-12** TakeCare vendor extras  
11. **S-13 / S-14** late hosts + multi-user  

---

## E. Edit log

- 2026-09-09: Initial draft after ROADMAP/TASKS tick-off for Chunks 5.1–8 and open-issue cross-check.
- 2026-09-09: Applied section A suggested edits via `gh issue edit` (#35, #37–#39, #49, #51, #52); created triage labels; removed Suggested edit column.
- 2026-09-10: Marked **#35/#37** done (PR #58); VMS frontier reordered to **#38 → #39 → #40 → #41**.
