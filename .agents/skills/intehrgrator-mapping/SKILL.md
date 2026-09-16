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

- Mapping source fields to Target value slots (including loops, Sheets, Decision tables, party identity)
- GUI desktop with Agent API, **or** headless create → Test Run → export (no window)
- Output must validate against **`intehrgrator-suggestions` version `"2"`**

Read [docs/AI_SUGGESTION_FORMAT.md](../../../docs/AI_SUGGESTION_FORMAT.md) for the envelope. Do not paraphrase block rules here.

## Paths

**GUI (watch the canvas):** desktop running; MCP `INTEHR_AGENT_URL=http://127.0.0.1:<port>` (add `INTEHR_AGENT_TOKEN` when the desktop was started with `--token`). Done when `GET /api/v1/health` returns `ok`.

**Headless / server:** `deno task mcp` with **no** `INTEHR_AGENT_URL` (embedded `WorkbenchService`), **or** `intEHRgrator --headless [--port n] [--bind addr] [--load file.intehrgrator] [--token secret]`. Non-loopback `--bind` requires `--token`. Done when load/inspect tools answer.

## Golden path

1. **`register_agent`** — note `agentId`, `displayName`, `color`. Pass those headers / `_agent*` args on writes. Done when register returns an id.
2. **`get_snapshot`** — read `revision`. Empty project (`templateId` empty, `exampleCount` 0) → **load** before mapping. Done when snapshot JSON is in hand.
3. **Load** (skip when the desktop already has a target + Active Example, or `--load` hydrated a bundle):
   - `load_target` (content / path / url)
   - `load_source_schema` (optional)
   - `add_example` + `set_active_example`
   - `replace_sheets` for terminology **Sheets** and **Decision tables**
   Done when snapshot shows `templateId` and `exampleCount >= 1`.
4. **Inspect** — do not skip to import:
   - `list_slots` (unmapped mandatory first)
   - `get_source_tree`
   - `get_sheets`, `get_product_stack`, `list_optional_rm`, `list_leases`
   Done when you can name the slot ids and source paths you will fill.
5. **Lease** hot slots (`lease_slot`) when another agent may write the same slot. Foreign `map_slot` is 409; `import_suggestions` skips foreign-leased slots. Done when `list_leases` shows your slots (or none, if uncontested).
6. **Map:**
   - `build_prompt` when another model will fill the envelope (Copy AI Prompt workflow)
   - else emit `intehrgrator-suggestions` from inspect data
   - `import_suggestions` (preferred), `map_slot`, `optional_rm_add` / `optional_rm_remove`, `set_instance_encoding`
   Pass `revision` / `If-Match`. Done when import `applied` matches what you intended (read `errors` / `skipped`).
7. **`run_test`** — read full `TestResult` (`output`, `warnings`, `outputValidation`), not only `testOk`. On failure, patch and re-import. Done when `testOk` is true or remaining failures are explained.
8. **Export** when the user asked: `export_bundle` (`json` | `zip`, optional `path`), `generate_script` (`typescript` | `java` | `handlebars` | `xquery` | `go-template`). Done when files/strings exist.
9. **`undo`** (`agent` / `user` / `global`) or `get_history` + `restore_at` if the user rejects work. `release_slot` when finished.

HTTP table: [docs/AGENT_WORKFLOW.md](../../../docs/AGENT_WORKFLOW.md). HTTP and MCP names are 1:1.

## Mapping choices

- **Decision tables** — prefer `kind: "decision-table"` + `decision_table` when several independent inputs, don't-care cells, or FIRST/UNIQUE/COLLECT hit policies make the mapping **more readable to humans** than nested `if` / `logic_ternary`. Put the grid on the project with `replace_sheets`; the envelope only fills the value slot.
- **Sheets** — `sheet_lookup` for 1-key terminology (ICD-10 → SNOMED). Not a Decision table.
- **Defaults Map** — `maps_get("defaults", …)` only when the source has no value. **Source over defaults** for time, facility, composer.
- **Loops** — `for_each_source` for repeating source nodes; `for_each_list` for a computed list. Product-stack loops and extra Instance roots: inspect `get_product_stack`; encoding via `set_instance_encoding`. `put_blockly` is an escape hatch, not the primary path.
- Value slots only in the envelope — no RM containers / `DV_*` shells. Optional RM Insertion is `optional_rm_add`.
- Copy `slotId` / `attachSlotId` verbatim from inspect / the prompt manifest.

## Multi-agent etiquette

- Register once per MCP session; mutations are attributed in joint history.
- User watches via **Open observer** — do not assume the main canvas auto-scrolls.
- Patch undo: `build_patch_prompt` → envelope → `import_suggestions`.

## openEHR help

- Prefer **openehr-assistant MCP** when available ([openEHR Assistant Plugin](https://github.com/cadasto/openehr-assistant-plugin))
- [specifications.openehr.org/llms.txt](https://specifications.openehr.org/llms.txt)
- [DeepWiki ehrtslib](https://deepwiki.com/ErikSundvall/ehrtslib)

## Fallback (no API)

Export mapping spec or generated TypeScript from the UI — **read-only** context; user applies changes via **Import Suggestions**.
