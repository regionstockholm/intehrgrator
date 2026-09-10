# intEHRgrator tutorial

Brief guide for informaticians and clinical super users. Terminology matches the in-app labels and [CONTEXT.md](../CONTEXT.md).

## 1. Layout

Three panes:

| Pane | Purpose |
|------|---------|
| **Source** (left) | Source schema tree (top) and example instance tabs (bottom) |
| **Mapping Editor** (centre) | Blockly canvas, Mapping Specification tab, Handlebars Template, Sheets |
| **Target & Previews** (right) | Output mode, generated scripts, Conversion Test Run |

Resize panes by dragging dividers. Toolbar buttons manage projects, example sets, and AI assist.

## 2. Start a project

**New Project** clears the workspace. To resume later:

- **Load Project** — pick a saved project from browser storage
- **Import Project** / **Export Project** — share a `.intehrgrator` bundle file

A project bundle holds source files, target definition, Blockly mapping, defaults map, sheets, and settings. Generated scripts and test output are *not* stored; they are recomputed when you open the project.

## 3. Load source data

**Source schema** (upper left): structural definition — JSON Schema, XML/XSD sample, openEHR Web Template, or similar. Used for tree navigation and mapping even without an example file.

**Example instance** (lower left): one or more real source records (JSON, XML, openEHR FLAT/STRUCTURED). Open tabs let you switch the **active example**; Test Run always uses the selected tab.

**Click-to-map:** click an empty target value slot (or a source-query block still showing `/path`), then click a node in the active example tree. The tool inserts an XPath expression. Drag-and-drop from the tree onto a slot works too.

**Example Sets** (toolbar ▾): load a curated bundle (schema + examples + target + optional mapping) from the built-in catalog.

## 4. Open a target

**Target & Previews → Open target Schema/Template** loads the output shape:

- openEHR Operational Template (`.opt`, Web Template JSON, AD@git URL, …)
- JSON Schema or XML Schema
- Free-form (Handlebars-driven text)

Scaffolding builds a **Template Skeleton** on the Blockly canvas: mandatory RM/template fields as typed blocks with empty value slots.

## 5. Defaults before you map

The **Defaults block** (on the canvas from a new project) holds a **Defaults Map** — language, territory, time, composer, facility, encoding, and any keys you add. Edit values on the canvas or **Save as** a named snapshot.

When you scaffold a target, common slots are pre-wired with **Map lookup** blocks pointing at these keys. Change the map once; every lookup picks up the new value at convert time.

## 6. Map fields

1. **Listening mode** — click an empty slot on the canvas (yellow highlight) or a placeholder source path; click the source tree.
2. **Mapping Specification** tab — compact rows for each mapping; edit paths and literals inline; click a row to select the Blockly block.
3. **Constraint warnings** (yellow triangles) — unmapped mandatory slots or cardinality problems.
4. **Optional RM** — cogwheel on a container block → add structures the template omits but RM allows (e.g. `feeder_audit`).
5. **Loops** — map repeating source nodes with `for_each_source` under repeating target containers.
6. **Lists & maps** — terminology tables (`maps_get`), set logic, list restrictions.
7. **Sheets** — 2D grids (paste from Excel/CSV); use `sheet_lookup` / `sheet_get_*` in Blockly.

## 7. Test and validate

1. Set **Output mode** in Target & Previews:
   - **Mapping preview** — evaluates the mapping model in the browser (default after load).
   - **TypeScript / Java / Handlebars / XQuery / Go Template** — shows generated conversion script.
2. Click **Run Test** in **Conversion Test Run(s)**.
3. **Autoplay** (when available) re-runs after edits.
4. For openEHR targets, ✅ or ⚠ template validation appears on the test tab.

Fix warnings on the canvas, then re-run until the output matches your expectations across example tabs.

## 8. Export conversion scripts

Choose a conversion script language in **Output mode**. **Generated conversion script(s)** shows the export; use **Download** to save. Scripts accept a `defaults` map and sheet bag at runtime — design-time values from the Defaults block and Sheets tabs are not baked in as the only source of truth.

## 9. AI assist (copy-paste)

No in-app AI API in v1 — you bring your own chat tool.

1. **Copy AI Prompt** (▾ delivery: embed files, attach in chat, or URI browse).
2. Paste into your AI assistant; ask it to propose mappings.
3. **Import AI suggestions** — paste the `intehrgrator-suggestions` JSON response.
4. **Run Test** to verify before exporting.

Response format: [AI_SUGGESTION_FORMAT.md](./AI_SUGGESTION_FORMAT.md).

## 10. Save and share

- **Save as** — name in browser storage (web) or project folder (desktop).
- **Export Project** — `.intehrgrator` zip for colleagues or version control.
- **Import Project** — merge or replace from a bundle.

## 11. Desktop-only extras

The [desktop release](https://github.com/regionstockholm/intehrgrator/releases) adds:

- Local files without browser storage limits
- **Agent API** on `127.0.0.1` for IDE agents
- **Open observer** — watch agent edits and history timeline

See [AGENT_WORKFLOW.md](./AGENT_WORKFLOW.md) for HTTP/MCP details.

---

## Appendix A — MCP and IDE agents (advanced)

For AI-assisted mapping from Cursor, VS Code, or another MCP-capable client:

### Prerequisites

1. Install [Deno](https://docs.deno.com/runtime/getting_started/installation/) (2.9+) *or* download a desktop build from [Releases](https://github.com/regionstockholm/intehrgrator/releases) (no Deno required to *run* the app).
2. Clone this repository if you will run `deno task mcp` from source.
3. Start the **desktop app** with a project loaded.

### Connect MCP

Add to your editor MCP config (Cursor: `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "intehrgrator": {
      "command": "deno",
      "args": ["run", "-A", "src/agent/mcp_stdio.ts"],
      "cwd": "/path/to/intehrgrator",
      "env": { "INTEHR_AGENT_URL": "http://127.0.0.1:8765" }
    }
  }
}
```

Replace `cwd` and port with your paths. The desktop app prints its Agent API port on startup. Set `INTEHR_AGENT_API=0` to disable the API.

Run manually: `deno task mcp`

### Install the mapping skill

Copy or symlink the skill into your agent skills folder:

- Repository path: [`.cursor/skills/intehrgrator-mapping/SKILL.md`](../.cursor/skills/intehrgrator-mapping/SKILL.md)

In Cursor, skills under `.cursor/skills/` in the project are discovered automatically. For other tools, point your skill loader at that file.

The skill documents the golden path: `register_agent` → read snapshot → `build_prompt` / `import_suggestions` → `run_test` → `undo` if needed.

### Recommended companion MCP servers

| Server | Use |
|--------|-----|
| **openehr assistant** | Archetypes, templates, terminology, spec lookup |
| **DeepWiki** | ehrtslib and openEHR library questions |

### Further reading

- [AGENT_WORKFLOW.md](./AGENT_WORKFLOW.md) — API endpoints and multi-agent etiquette
- [README-DEVELOPERS.md](../README-DEVELOPERS.md) — full task list and dev setup
- [AI_SUGGESTION_FORMAT.md](./AI_SUGGESTION_FORMAT.md) — JSON schema for agent responses
