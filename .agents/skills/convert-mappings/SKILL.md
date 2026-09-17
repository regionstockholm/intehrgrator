---
name: convert-mappings
description: >-
  Convert an existing mapping (Go text/template FLAT, Handlebars, TypeScript,
  XQuery, or similar) into intEHRgrator Blockly via Agent API / MCP
  intehrgrator-suggestions. Use when the user has a .tmpl, .hbs, conversion
  script, or other mapping artefact to port.
---

# Convert existing mappings

Port a mapping that already exists in another formalism onto the loaded Target. Apply through Agent API / MCP. Do not hand-edit Blockly JSON.

Read [docs/AI_SUGGESTION_FORMAT.md](../../../docs/AI_SUGGESTION_FORMAT.md) for the envelope. Follow [intehrgrator-mapping](../intehrgrator-mapping/SKILL.md) for load → inspect → import → Test Run.

## When this is the job

- Source artefact is a Go `text/template` FLAT JSON (`.tmpl`), Handlebars, generated TypeScript/XQuery, or a similar conversion script
- Target OPT / Web Template and source schema/instances are available (or in an example set)
- Output is a v2 `intehrgrator-suggestions` envelope plus `replace_sheets` / `optional_rm_add` / `set_instance_encoding` as needed

## Steps

1. **Load** target, source schema, and at least one Example Instance (`load_example_set` or `load_target` + `load_source_schema` + `add_example`). Done when `get_snapshot` shows `templateId` and `exampleCount >= 1`.
2. **Inspect** `list_slots` (copy `slotId`, `pathLabel`, `attachSlotId`, `codeFixed`, `unitsFixed`), `get_source_tree`, `list_optional_rm`. Done when every FLAT/script target path you will port has a slot id (or is listed as Optional RM / Product-stack encoding).
3. **Inventory the source mapping.** Walk the artefact once. For each assignment, record: source path or literal, target path, condition / loop, and extras (prefix, terminology id, hardcoded RM). Done when the inventory covers every assignment (including `range` / `if` / helpers).
4. **Translate target paths → slot ids.** Simplified FLAT (`templateId/path|code`) is not a `slotId`. Match Web Template / `pathLabel` / RM path. `_health_care_facility` and `composer` are `PARTY_IDENTIFIED` containers — `optional_rm_add` first, then `maps_create_with` keys `name`, `id`, `type`. Unconstrained coded text: keys `value`, `code_string`, `terminology_id`. Unconstrained quantity: keys `magnitude`, `units`. Identifier: keys `id`, `type` (RM field is `id`, not `value`). Done when every inventory row names a `slotId` or is marked unmappable (duplicate `slotId`, no source, or RM the envelope cannot express).
5. **Loops.** One `for_each_source` (or `for_each_list`) per repeating target container. Copy `attachSlotId` from inspect (`0..*` / `1..*`). Child `EXPRESSION` is **relative** to `PATH`. Composition-level fields stay absolute (`$.RekvisisjonId`) even inside a loop. Sibling `C_ARCHETYPE_ROOT` `at0000` paths use the archetype id (`…//content/openEHR-EHR-ACTION.medication.v1`); attach still prefers `0..*` if ids collide. Done when `loops[]` and `loopVar` match inspect.
6. **Rules.** Prefer a **Decision table** (`replace_sheets` `kind: "decision-table"` + `decision_table` block) when several inputs / don't-care / FIRST|UNIQUE|COLLECT are easier to read than nested `if`. Prefer **`sheet_lookup`** for 1-key terminology. Keep `logic_ternary` for a single guard (e.g. emit diagnosis only when code and name exist). Hardcoded OPT-only codes (`codeFixed`) can stay `text` plus the fixed code. Done when each rule has one construct, not both a table and nested `if` for the same slot.
7. **Emit and apply.** Write the v2 envelope. `optional_rm_add` before import for facility (and any other catalog row the artefact uses). `replace_sheets` then `import_suggestions`. `set_instance_encoding` `flat-json` when the artefact was Simplified FLAT. Done when import `applied` matches the inventory (read `errors` / `skipped`) and `loopsAccepted` matches `loops[]`.
8. **Test Run** against every Example Instance. Compare payload to any golden target instances — do not treat goldens as error-free. Done when remaining diffs are listed (golden stale, OPT constraint, or app gap).

## FLAT / Go template translation

Worked example: `test/fixtures/administrerad-medicinsk-onkologisk-behandling/mapping/AdministrationRCCV1-AdministreradMedicinskOnkologiskBehandlingPerSubstans.tmpl` → `mapping/pass-2-ai.intehrgrator-suggestions.json`.

| Artefact | Blockly / API |
|----------|----------------|
| `"path\|value": "{{ .Field }}"` | `source_query` `EXPRESSION` `$.Field` |
| `"path\|code"` + `"path\|value"` + `"path\|terminology"` | `maps_create_with` on the DV_CODED_TEXT slot |
| `"path\|magnitude"` + `"path\|unit"` | `maps_create_with` magnitude + units on the DV_QUANTITY slot |
| `"path/_identifier:0\|id"` + `\|type` | party map keys `id` / `type`, or DV_IDENTIFIER map `id` / `type` |
| `"path/_health_care_facility\|name"` | `optional_rm_add` then party slot `…//context/EVENT_CONTEXT/health_care_facility` |
| `"composer\|name"` | party slot `…//composer` |
| `{{ range $i, $row := .Items }}` … `:{{ $i }}` | `for_each_source` `PATH` `$.Items`; relative fields; no `:n` index in `slotId` |
| `{{ if and .A .B }}` | `logic_ternary` or omit empty (Test Run skips absent) |
| `SE2321000016-{{ .HSAID }}` | `text_join` (`concat`) |
| Helper `toLocalDateTime` | `source_query` on the DV_DATE_TIME slot (renderer / encoding formats) |
| Literal setting / category / role | `text` when `codeFixed`; else coded-text map |
| `_instruction_details`, `_uid` | skip unless the user asked — not value slots |
| `set_instance_encoding` `flat-json` | after import, so Test Run serializes Simplified FLAT |

`pathLabel` can collide on reused at-codes (vårdenhet vs vårdgivare both `at0000`). Trust `codeFixed` on Role and the OPT tree, not the label alone.

Two sibling ELEMENTs that share `at0003` (HSA vs organisationsnummer) share one `slotId` — `applyExpressionEdit` keeps one row. Map the sourced identifier; note the other as unmappable until slot ids are unique.

## Goldens vs artefact

Compare Test Run to golden target instances **and** to the source artefact. A golden that disagrees with both the artefact and the Example Instance is stale (hand-edited facility, instruction_details, renamed org). OPT-mandated ISM (`532` / `at0007`) that ignores source `Stoppad` is a template constraint, not a conversion miss.

## Fallback

If Agent API is down: write the envelope files next to the artefact and stop. The user applies them via Import Suggestions.
