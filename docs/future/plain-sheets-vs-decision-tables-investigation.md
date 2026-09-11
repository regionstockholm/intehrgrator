# Investigation: plain Sheets vs decision tables (integration context)

**Status:** Brief investigation (2026-09-11)  
**Question:** Are plain `kind: "sheet"` grids still needed or useful for integration mappings now that `kind: "decision-table"` exists? Should/could plain Sheets be removed?

**Verdict:** **Keep plain Sheets.** Decision tables solve a different problem (combinational rules + snippets + hit policies). Plain Sheets remain the right construct for convert-time **reference data** (terminology, code lists, site-specific rubrics) and for low-level grid access. Removing them would regress the integration story without simplifying the product.

---

## Definitions (project vocabulary)

| Construct | `kind` | Role at convert time |
|-----------|--------|----------------------|
| **Sheet** | `sheet` (default) | Named 2D **data** matrix. Cells are values, not predicates. Accessed via `sheet_get_*` and `sheet_lookup`. |
| **Decision table** | `decision-table` | Named **rule** grid. Condition columns (equality + don't-care), output columns (value or VMS-Mustache snippet), hit policies FIRST / UNIQUE / COLLECT. Accessed via `decision_table`. |

Both share the Sheets tab, jspreadsheet widget, and convert-time `sheets` bag ([ADR 0005](../adr/0005-convert-time-sheets.md), `CONTEXT.md`). They are intentionally distinct kinds.

---

## What integration mappings use Sheets for today

1. **Terminology / code translation** — the primary integration pattern: a site-maintained grid (e.g. ICD-10 → SNOMED + rubric) passed at convert time, not baked into generated scripts.

   - AI suggestion prompts prefer `sheet_lookup` for this (`src/core/ai/mod.ts`).
   - Tests and fixtures model it explicitly (`test/fixtures/sheets/icd10_snomed.json`, `test/sheets_test.ts`).
   - Planned **FHIR ConceptMap / ValueSet → Sheet import** targets plain Sheets, not decision tables ([`SUGGESTED-ISSUES-roadmap-remaining.md`](../historical-archive/SUGGESTED-ISSUES-roadmap-remaining.md) S-05).

2. **Convert-time argument bag** — generated TypeScript/Java/Handlebars scripts take a `sheets` parameter; Test Run and integration hosts supply project-owned JSON. This mirrors the Defaults Map pattern and keeps terminology editable per site without regenerating mappings ([ADR 0005](../adr/0005-convert-time-sheets.md)).

3. **Low-level grid reads** — `sheet_get_cell`, `sheet_get_row`, `sheet_get_data`, etc. support ad hoc access (A1 refs, row names, full-row records) that `decision_table` does not expose.

---

## What decision tables add (and do not replace)

Decision tables address **combinational mapping logic**, not bulk reference data ([`decision-tables-for-mapping.md`](decision-tables-for-mapping.md)):

- Multiple condition columns with AND semantics and don't-care (`—`).
- Hit policies (FIRST, UNIQUE, COLLECT) and mixed value + snippet outputs.
- VMS-Mustache snippet cells for narrative fragments (lung-MDT-style Note logic).

The design doc is explicit:

> A **Map** remains right for 1D defaults. A **Sheet** remains right for 1-key terminology lists. A decision table is for **combinational** rules (several independent inputs → one or more outputs).

`sheet_lookup` is documented as a **limited-entry lookup** (first row where one column equals a value), not a decision table (`src/core/sheets/model.ts`). Multi-column equality `sheet_lookup` (planned first slice) is still a Sheet, not a promotion to `decision-table`.

---

## Overlap analysis: could decision tables subsume plain Sheets?

| Capability | Plain Sheet | Decision table |
|------------|-------------|----------------|
| 2-col code → target lookup | `sheet_lookup(name, "code", key, "target")` — one block, one match key | Requires `decision_table` + locals Map keyed by condition headers; awkward for simple 1:1 tables |
| Return full matching row | `sheet_lookup` with no `returnColumn` → header→cell record (+ `__row`) | Returns one output column (or COLLECT join of one column) |
| Row names, A1/xy/row/column access | `sheet_get_*` family | Not supported |
| Don't-care / multi-condition rules | Not supported (by design) | Core feature |
| Snippet outputs + hit policies | Not supported | Core feature |
| FHIR ConceptMap import target | Planned for Sheet model | Wrong kind — imported maps are data, not rules |
| Formal verification / VMS | Accessors are Keep; static tables can be inlined | UNIQUE rows are contract-ready; snippets add Mustache lint |

A degenerate decision table (one condition column, FIRST, value output) can emulate a two-column `sheet_lookup`, but:

- Worse authoring UX (locals Map vs direct match value).
- Loses row-oriented helpers and terminology import semantics.
- Blurs the data vs rules distinction the glossary and ADRs already draw.

---

## Should plain Sheets be removed?

**No.** Reasons:

1. **Different semantic roles** — Sheets are **data**; decision tables are **rules**. Collapsing them would confuse authors and downstream tooling (AI suggestions, function-test harnesses, formal verification) that rely on the split (`CONTEXT.md`, [`function-test-harnesses.md`](function-test-harnesses.md)).

2. **Integration pipelines depend on reference grids** — ADR 0005 exists because terminology must be swappable per site/message without codegen. Decision tables are for logic authored in the mapping; Sheets are for tables maintained alongside it.

3. **No redundancy in shipped examples** — decision tables are exercised in tests (`test/decision_table_test.ts`); terminology Sheets in fixtures. Real Example Sets have not yet migrated combinational Handlebars/Go `if` trees to decision tables (sibling `lung-MDT-form-decision-tables` is still planned).

4. **Removal cost** — Would require deprecating seven accessor block types, `sheet_lookup` in Mapping Expression AST/codegen, AI suggestion schema, persistence bundle `sheets[]`, and the ConceptMap import roadmap, with no compensating simplification (the widget, bag, and tab stay for decision tables anyway).

---

## Could they be removed (technical feasibility)?

Only with a **forced migration** of every plain Sheet to `kind: "decision-table"` and replacement of `sheet_lookup` / `sheet_get_*` with `decision_table` or Maps. That is feasible for narrow two-column lookups but **not** for:

- Full-grid or positional access (`sheet_get_cell`, `sheet_get_data`).
- Imported terminology tables treated as opaque reference data.
- Future `sheet_to_map` / dual-read compatibility paths ([`DESIGN-sheets-vs-maps.md`](../design/DESIGN-sheets-vs-maps.md)).

Recommendation: **do not pursue removal.**

---

## Optional consolidation (not removal)

| Idea | Notes |
|------|--------|
| **Multi-column equality `sheet_lookup`** | Still a Sheet; closes gap for AND of several headers without decision-table ceremony (roadmap S-02). |
| **Promote grid to decision-table** | UI/kind change when predicates, don't-care, snippets, or non-FIRST hit policy are needed — not a replacement for terminology Sheets. |
| **`sheet_to_map`** | Two Sheet columns → Map for `maps_get` interop; keeps Sheets as the 2D authoring surface. |
| **Rename in UI only** | e.g. tab label “Grids” with sub-kinds Data / Rules — cosmetic; kinds stay separate in JSON. |

---

## References

- `CONTEXT.md` — Sheet vs Decision table glossary
- [ADR 0005](../adr/0005-convert-time-sheets.md) — convert-time bag
- [`decision-tables-for-mapping.md`](decision-tables-for-mapping.md) — when to use which
- [`DESIGN-sheets-vs-maps.md`](../design/DESIGN-sheets-vs-maps.md) — Sheets vs Maps (orthogonal to this question)
- `src/core/sheets/model.ts` — `sheetLookup`
- `src/core/sheets/decision_table.ts` — `evaluateDecisionTable`
- `src/core/sheets/evaluate.ts` — shared bag, distinct eval paths
