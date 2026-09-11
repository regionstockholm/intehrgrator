# Plain Sheets after decision tables

**Status:** Investigation 2026-09-11. Not a removal ticket.

**Verdict:** Keep data **Sheets**. Do not remove `kind: sheet`, `sheet_lookup`, or the Sheets tab’s “add sheet” path. Decision tables (#69) occupy the combinational-rule job. They do not replace 1-key terminology / code lists, FHIR-style concept maps, CSV paste of data, or convert-time lookup tables (ADR 0005). Empty-cell meaning alone makes collapsing the two kinds unsafe.

---

## Question

Are **plain Sheets** (`kind: sheet` or omitted) still needed in an integration mapping now that **Decision tables** (`kind: decision-table`) exist? Could the Sheet kind and accessors be deleted?

---

## Sources

| Source | What it contributes |
|--------|---------------------|
| [`CONTEXT.md`](../../CONTEXT.md) (Sheet / Decision table) | Glossary split: Sheet = data matrix + `sheet_lookup` / `sheet_get_*`; Decision table = condition/output grid + hit policy. Same widget and convert-time bag. |
| [ADR 0005](../adr/0005-convert-time-sheets.md) | Generated scripts take a convert-time `sheets` bag. Grids stay editable without regenerating the mapping. |
| [`src/core/sheets/types.ts`](../../src/core/sheets/types.ts) | `GridKind = "sheet" \| "decision-table"`. Empty / `—` / `*` are don't-care **only** on decision tables (`DONT_CARE_GLYPHS`). |
| [`src/core/sheets/model.ts`](../../src/core/sheets/model.ts) `sheetLookup` | First row where **one** column equals a value; return one column **or the whole row** (header→cell record, including `__row`). |
| [`src/core/sheets/decision_table.ts`](../../src/core/sheets/decision_table.ts) | Equality + don't-care on **every** condition column; outputs are value or VMS-Mustache; hit policies FIRST / UNIQUE / COLLECT; optional all-outputs Map (`*`). |
| [`src/core/sheets/evaluate.ts`](../../src/core/sheets/evaluate.ts) | Same bag; `sheet_lookup` and `decision_table` do **not** check `kind`. Either call can run on the other document. |
| [DESIGN-sheets-vs-maps](../design/DESIGN-sheets-vs-maps.md) | Maps stay 1D (Defaults + nested Blockly values). Sheets took 2-column terminology away from maps. |
| [decision-tables-for-mapping.md](decision-tables-for-mapping.md) | Pre-#69: “A **Sheet** remains right for 1-key terminology lists. A decision table is for **combinational** rules.” First slice “multi-column `sheet_lookup`” was adopted then **not shipped**. |
| [spreadsheet-matrix-libraries.md](spreadsheet-matrix-libraries.md) | `sheet_get_*` Blockly types map 1:1 to the jspreadsheet widget API, not to mapping jobs. |
| AI prompt in [`src/core/ai/mod.ts`](../../src/core/ai/mod.ts) | Terminology translation still prefers `sheet_lookup` on a named Sheet (`code` / `snomed`). |
| Archived ROADMAP §C / S-05 | FHIR ConceptMap / ValueSet → **Sheet** import (deferred). |
| [#69](https://github.com/regionstockholm/intehrgrator/issues/69) (closed) | Shipped `kind: decision-table`. Explicitly distinct from data Sheet. Out of scope: FHIR import. |
| [#70](https://github.com/regionstockholm/intehrgrator/issues/70) | Sibling Example Sets for lung-MDT / chemo **Notes** as tables + snippets — combinational narrative, not code lists. |
| [#76](https://github.com/regionstockholm/intehrgrator/issues/76) | XQuery `$sheets` would bind **both** accessors. |
| [`examples/`](../../examples/) | No catalogued mapping currently stores Sheets or Decision tables (fixture only: `test/fixtures/sheets/icd10_snomed.json`). |

---

## Two kinds, one bag

Both documents are `SheetDocument` rows in `ProjectBundle.mapping.sheets` and the convert-time bag ([ADR 0005](../adr/0005-convert-time-sheets.md), [`src/types/mod.ts`](../../src/types/mod.ts)). The Sheets tab hosts both; “Add sheet” vs “Add decision table” sets `kind` ([`src/ui/sheets_panel.ts`](../../src/ui/sheets_panel.ts)).

| | **Sheet** | **Decision table** |
|---|-----------|-------------------|
| Cell meaning | Data (empty = empty) | Tests (`=` or don't-care) + outputs |
| Blockly | `sheet_lookup`, `sheet_get_*`, decl chip | `decision_table` + schema-bound locals Map; output dropdown or all-outputs Map |
| Match | One equality key, first row | All condition columns (AND); don't-care skips a column |
| Result | One cell **or whole row record** | One output column, or Map of **output** columns |
| Hit policy | Implicit first-match | FIRST / UNIQUE / COLLECT |
| Extra columns | Payload (rubric, system, …) | Conditions or outputs; trailing letter columns are trimmed as spare |

#69’s agent brief required that `kind` stay distinct from data Sheet. That split is still the right product seam.

---

## Jobs in an integration mapping

| Job | Right construct | Why a Decision table is a poor stand-in |
|-----|-----------------|----------------------------------------|
| **1-key terminology** (ICD-10 → SNOMED, local code → TermId) | Sheet + `sheet_lookup` | Lookup is “where `code` = source, return `snomed`”. Extra columns (rubric, system) are payload, not extra conditions. AI already teaches this shape. |
| **Paste / CSV / Excel concept lists** | Sheet | Import is a data grid. FHIR ConceptMap / ValueSet (ROADMAP S-05) feeds Sheets, not rule tables. |
| **Whole-row fetch** then pick fields | `sheet_lookup` without `returnColumn` | Decision-table all-outputs (`*`) returns **output** columns only, not the match key or non-output payload. |
| **Site-specific tables without regenerating the script** | Either, via ADR 0005 bag | Shared. Does not pick a kind. |
| **Combinational rules** (laterality × finding → TermId **and** Note snippet; COLLECT fragments) | Decision table | This is what #69/#70 are for. Nested `if` / `#if` trees. |
| **1D Defaults / nested Blockly values** | **Map**, not Sheet | [DESIGN-sheets-vs-maps](../design/DESIGN-sheets-vs-maps.md). Unchanged. |

A 1-condition Decision table *can* encode a two-column code→value list. That is strictly heavier Blockly (locals Map, column roles, hit policy) for a job `sheet_lookup` already names. It also mis-teaches empty cells (next section).

---

## Why collapsing kinds is unsafe

**1. Empty cells.** `DONT_CARE_GLYPHS` includes `""` ([`types.ts`](../../src/core/sheets/types.ts)). On a Decision table an empty condition matches **any** input. On a Sheet, `sheetLookup` treats empty as empty (equal only to null/empty). A terminology grid with blank SNOMED cells would, if evaluated as a table, match those rows for every source value.

**2. Column roles.** With no `decisionColumns`, evaluate treats **all but the last** header as conditions ([`decisionColumnMeta`](../../src/core/sheets/decision_table.ts)). The fixture `icd10_snomed` is headers `code`, `snomed`, `rubric`. As a Decision table, lookup by `code` also requires `snomed` to match before returning `rubric`. `sheet_lookup(..., "code", "I10", "snomed")` ignores `rubric` and does not constrain `snomed`.

**3. Kind is not enforced at eval.** `evalSheetCall` dispatches on the **block** name, not `sheet.kind`. Removing the kind would not remove the footgun; it would make it the only behaviour.

**4. Accessor zoo is leftover, not a reason to delete Sheets.** `sheet_get_cell` / `_xy` / `_row` / `_column` / `_header` / `_data` exist because Chunk 8 mirrored jspreadsheet ([spreadsheet-matrix-libraries.md](spreadsheet-matrix-libraries.md)). Mutators already left the default toolbox (VMS / PR #58). Coordinate access is a weak integration API (A1 refs break when rows are inserted) but that argues for **slimming the toolbox**, not deleting `kind: sheet` or `sheet_lookup`.

**5. No production mapping uses either yet.** Catalog examples have no `mapping.sheets`. #70 will add Decision tables for **Notes**, not as a migration of terminology Sheets. Absence of Sheet usage in examples is “not demoed yet”, not “unused in the product model”.

---

## What decision tables *did* supersede

The pre-#69 plan’s **first slice** was multi-column equality `sheet_lookup` (AND of several `header = value` pairs, still a Sheet) — archived ROADMAP §C, S-02 in [`SUGGESTED-ISSUES-roadmap-remaining.md`](../historical-archive/SUGGESTED-ISSUES-roadmap-remaining.md). That slice **never shipped** (`sheetLookup` is still one match column).

A Decision table with several condition columns **is** that AND, plus don't-care, hit policy, and mixed outputs. **Do not implement S-02.** Combinational lookup belongs on `kind: decision-table`.

They do **not** supersede 1-key `sheet_lookup`.

---

## Could we remove Sheets anyway?

| Option | Verdict |
|--------|---------|
| **A. Keep both kinds** (status quo) | **Adopt.** Matches CONTEXT, ADR 0005, #69, AI prompt, FHIR-import plan. |
| **B. Delete `kind: sheet`; author terminology as 1-condition tables** | Reject. Empty-cell and extra-column semantics; heavier Blockly; breaks the planned ConceptMap import target. |
| **C. Keep Sheet store; drop all accessors except `sheet_lookup`** | Optional later product cut, same shape as the mutator removal. Not required to “make room” for decision tables. |
| **D. Dual-read: `decision_table` on a Sheet, `sheet_lookup` on a table** | Already possible in `evalSheetCall`. Do not advertise. |

Export gaps (XQuery fail-closed, Go `index .Sheets` stub, Java convert signature without a sheets argument) apply to **both** kinds. Removing Sheets would not simplify #76.

A later **function test table** kind ([function-test-harnesses.md](function-test-harnesses.md)) still wants the same widget family, a third `kind`, not a single grid.

---

## Recommendation

1. **Keep** `kind: sheet`, the add-sheet control, `sheet` declaration chip, and `sheet_lookup`.
2. **Keep** the glossary split. Do not treat a Decision table as a data Sheet.
3. **Do not** implement multi-column `sheet_lookup` (S-02); use Decision tables for that job.
4. **Keep** FHIR ConceptMap / ValueSet import aimed at Sheets (S-05), not at `kind: decision-table`.
5. Optional, not now: hide `sheet_get_*` (except lookup) from the default toolbox, same policy as mutators.

No CONTEXT or ADR change is required unless a later grill picks C (toolbox slim).
