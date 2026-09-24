---
name: intehrgrator-mapping
description: >-
  Guide AI agents mapping source data to openEHR (or other targets) via
  intEHRgrator desktop Agent API, headless --headless server, or stdio MCP.
  Use when editing .intehrgrator projects, loading Target / Source Schema /
  Example Instances, producing intehrgrator-suggestions JSON, Decision tables,
  Sheets, Product stack, Instance encoding, Optional RM, Conversion Scripts,
  or slot leases.
---

# intEHRgrator mapping agent

## When to use

- Mapping source fields to Target value slots (including **node-by-node** `map_slot`, loops, Sheets, Decision tables, party identity)
- GUI desktop with Agent API, **or** headless create → Test Run → export (no window)
- Output must validate against **`intehrgrator-suggestions` version `"2"`**

Read [docs/AI_SUGGESTION_FORMAT.md](../../../docs/AI_SUGGESTION_FORMAT.md) for the envelope. Do not paraphrase block rules here.

## Paths

**GUI (watch the canvas):** desktop running; MCP `INTEHR_AGENT_URL=http://127.0.0.1:<port>` (add `INTEHR_AGENT_TOKEN` when the desktop was started with `--token`). Done when `GET /api/v1/health` returns `ok`.

**Headless / server:** `deno task mcp` with **no** `INTEHR_AGENT_URL` (embedded `WorkbenchService`), **or** `intEHRgrator --headless [--port n] [--bind addr] [--load file.intehrgrator] [--token secret]`. Non-loopback `--bind` requires `--token`. Target load **scaffolds** Conversion start + Template Skeleton (same as the GUI). Done when load/inspect tools answer.

**Call AI (in-app):** web app / desktop toolbar with saved AI credentials. intEHRgrator calls the provider and executes the same tool names (`list_slots`, `map_slot`, `import_suggestions`, `run_test`, …) on the open project. Provider key walkthrough: [docs/AI_CREDENTIALS.md](../../../docs/AI_CREDENTIALS.md). A remote OpenCode server / cloud runner uses the **Headless / server** path (HTTP Agent API), not the in-app key dialog. stdio MCP is required only when a GUI session should be watched (`INTEHR_AGENT_URL`). Headless and cloud agents call the Agent API directly; they do not need a desktop MCP server.

**Copy prompt:** no API. User pastes the markdown; apply the envelope with `import_suggestions` / Import Suggestions.

## Golden path

1. **`register_agent`** — note `agentId`, `displayName`, `color`. Pass those headers / `_agent*` args on writes. Done when register returns an id.
2. **`get_snapshot`** — read `revision`. Empty project (`templateId` empty, `exampleCount` 0) → **load** before mapping. Done when snapshot JSON is in hand.
3. **Load** (skip when the desktop already has a target + Active Example, or `--load` hydrated a bundle):
   - `load_example_set` (`catalogPath` / `catalogUrl` + `setId`) when the project is a catalogued use case. **`includeMapping` defaults to true and adopts** the saved Blockly, Sheets, and loops (`appliedSlots` > 0). Pass `includeMapping: false` only to scaffold an empty Mapping Model from the Template Skeleton.
   - or `load_target` (content / path / url), `load_source_schema`, `add_example` + `set_active_example`
   - `replace_sheets` for terminology **Sheets** and **Decision tables**
   - `list_function_library` / `load_function` when a reusable Blockly Function (grammatical join, shared Decision table helper) already lives in the Function library — read [`function-library/index.md`](../../../function-library/index.md). `load_function` merges; it does not `put_blockly`-replace the canvas. `clash` defaults to `rename`.
   Done when snapshot shows `templateId` and `exampleCount >= 1`.
4. **Inspect** — do not skip to import:
   - `list_slots` (unmapped mandatory first). Colliding `at0000` content: use `pathLabel`, `attachSlotId`, and `parentRmType` (`ACTION` vs `EVALUATION`), not raw Blockly.
   - `get_source_tree`
   - `get_sheets`, `get_product_stack`, `list_optional_rm`, `list_leases`, `list_constraint_warnings`
   Done when you can name the slot ids and source paths you will fill.
5. **Lease** hot slots (`lease_slot`) when another agent may write the same slot. Foreign `map_slot` is 409; `import_suggestions` skips foreign-leased slots. Done when `list_leases` shows your slots (or none, if uncontested).
6. **Map** — node-by-node is first-class (not a fallback). When a human is watching the GUI, **prefer `map_slot` one Target value slot at a time**: each write pulses the canvas, appends attributed history, and is easy to undo. That transparency is the point of desktop + Open observer.
   - `map_slot` for Click-to-Map-shaped source paths (`slotId` + `path` + `format`)
   - `import_suggestions` for a v2 envelope (Copy AI Prompt, Decision tables, Sheet lookups, `text_code` / loops, or headless bulk)
   - `build_prompt` when another model will fill that envelope
   - `optional_rm_add` / `optional_rm_remove`, `set_instance_encoding`
   Pass `revision` / `If-Match`. Done when the slots you meant to fill are mapped (`list_slots` / import `applied`; read `errors` / `skipped`).
7. **`run_test`** — read full `TestResult` (`output`, `warnings`, `outputValidation`), not only `testOk`. On failure, read `list_constraint_warnings` and patch, then re-import. Done when `testOk` is true or remaining failures are explained. Extra languages that execute: Karda mapped sets — TypeScript (Simplified FLAT) and XQuery; lung-MDT — Mapping preview and Handlebars (evaluated TermId + Note); chemo symptoms — TypeScript and Go template. Go template Test Run is the Blockly walker, the same script as Generated Export.
8. **Export** when the user asked: `export_bundle` (`json` | `zip`, optional `path`), `generate_script` (`typescript` | `java` | `handlebars` | `xquery` | `go-template`). Done when files/strings exist.
9. **`undo`** (`agent` / `user` / `global`) or `get_history` + `restore_at` if the user rejects work. `release_slot` when finished.

HTTP table: [docs/AGENT_WORKFLOW.md](../../../docs/AGENT_WORKFLOW.md). HTTP and MCP names are 1:1.

## Mapping choices

- **Decision tables** — prefer `kind: "decision-table"` + `decision_table` when several independent inputs, don't-care cells, or FIRST/UNIQUE/COLLECT hit policies make the mapping **more readable to humans** than nested `if` / `logic_ternary`. Put the grid on the project with `replace_sheets`; the envelope only fills the value slot.
- **Sheets** — `sheet_lookup` for 1-key terminology (ICD-10 → SNOMED). Not a Decision table.
- **Defaults Map** — `maps_get("defaults", …)` only when the source has no value. **Source over defaults** for time, facility, composer.
- **Loops** — `for_each_list` with `source_query_node` in LIST for repeating source nodes, or a list value for a computed collection. Copy `attachSlotId` from `list_slots` (`repeatable` and per-slot `attachSlotId`), not only from `build_prompt`. Product-stack loops and extra Instance roots: inspect `get_product_stack`; encoding via `set_instance_encoding`. `put_blockly` is an escape hatch, not the primary path.
- **Function library** — reusable Blockly Functions (value `procedures_defreturn` or statement `procedures_defnoreturn`, plus Decision tables they call; `procedures_ifreturn` is inside a body) in `function-library/`. Index: [`function-library/index.md`](../../../function-library/index.md). `list_function_library` then `load_function`. Starters `join_swedish` (Blockly `join_swedish_words`, table SweJoinWords) and `join_oxford` are FIRST Decision-table joins, not a `join_list` builtin. Call a value Function from a slot.
- **Quantities** — unconstrained `DV_QUANTITY.units` is a shell field. When `list_slots` has no `unitsFixed`, map the quantity slot with `maps_create_with` keys `magnitude` + `units`.
- **Coded text** — copy `allowedValues` from inspect when present; otherwise `maps_create_with` keys `value`, `code_string` / `defining_code`, `terminology_id`.
- **Party identity** — `list_slots` includes `PARTY_IDENTIFIED` containers (`composer`, and `health_care_facility` when already scaffolded from the Defaults Map or after `optional_rm_add`). Map with `source_query` (name only) or `maps_create_with` keys `name`, `id`, `type`. Not a `/name/value` DV_TEXT leaf.
- Value slots only in the envelope — no RM containers / `DV_*` shells. Optional RM Insertion is `optional_rm_add` when `list_optional_rm` still lists the attribute (factory Defaults often already insert `health_care_facility` on EVENT_CONTEXT).
- Copy `slotId` / `attachSlotId` verbatim from inspect / the prompt manifest.
- Copy `slotId` / `attachSlotId` from inspect. Sibling `C_ARCHETYPE_ROOT` nodes that share `at0000` use openEHR locator predicates (`…//content[openEHR-EHR-ACTION.medication.v1]`). Reused ELEMENT ids use a name predicate (`…/items[at0003, 'Organisationsnummer']`). Unique OPTs stay on `content/at0000` with no brackets. `repeatable` / `attachSlotId` still prefer the `0..*` container when ids collide.
- Existing mapping in another formalism (`.tmpl`, Handlebars, generated TypeScript, …): use `convert-mappings`, then this skill's golden path to apply and Test Run.

## Multi-agent etiquette

- Register once per MCP session; mutations are attributed in joint history.
- User watches via **Open observer** — do not assume the main canvas auto-scrolls. Node-by-node `map_slot` is the transparent default on that path.
- Patch undo: `build_patch_prompt` → envelope → `import_suggestions`.

## openEHR help

- Prefer **openehr-assistant MCP** when available ([openEHR Assistant Plugin](https://github.com/cadasto/openehr-assistant-plugin))
- [specifications.openehr.org/llms.txt](https://specifications.openehr.org/llms.txt)
- [DeepWiki ehrtslib](https://deepwiki.com/ErikSundvall/ehrtslib)

## Fallback (no API)

Export mapping spec or generated TypeScript from the UI — **read-only** context; user applies changes via **Import Suggestions**.
