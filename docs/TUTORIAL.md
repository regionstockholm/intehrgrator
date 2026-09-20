# intEHRgrator — User tutorial

A brief guide for medical informaticians mapping source data to openEHR (or other targets). For terminology, see [CONTEXT.md](../CONTEXT.md).

## 1. Open the workbench

- **Web:** [regionstockholm.github.io/intehrgrator/](https://regionstockholm.github.io/intehrgrator/)
- **Desktop:** download from [GitHub Releases](https://github.com/regionstockholm/intehrgrator/releases) and run the binary for your platform.
- **Stable web version:** check [versions.json](https://regionstockholm.github.io/intehrgrator/versions.json) for pinned URLs (`/v0.7/`, etc.). The site root is the bleeding-edge build.

The layout has three panes: **Source** (left, slide-away), **Mapping Editor** (centre), **Target & Previews** (right, tabbed and slide-away).

## 2. Load source data

### Source schema (upper left)

Click **Load Schema** to open a structural definition: JSON Schema, XML/XSD sample, or openEHR Web Template. You can also paste a **GitHub URL** (▾ menu → From GitHub template…).

The schema tree shows field names and types for authoring mappings without an example file.

### Example instances (lower left)

Click **+ Add Example** to load one or more JSON/XML instance files (or a GitHub folder). Each file opens in its own tab.

- The **active tab** drives click-to-map and **Test Run**.
- Switch tabs to compare different patients or edge cases; each tab keeps its own last test result.

## 3. Load a target

In **Target & Previews** (right pane), click **Load target & default context map**. Pick a target file and a **default context map** (openEHR factory, a saved snapshot, a file, or **New**). Confirm scaffolds the **Template Skeleton** and **Default point**s. After a target loads, the **Target schema** tab shows its tree — drag a leaf or subtree onto empty canvas to recover deleted scaffold or add optional structure. Drag a leaf onto **scaffold target** chips, or a subtree onto a map value socket, to author the map.

Supported targets:

- openEHR OPT / Web Template (`.opt`, `.wt.json`, `.adl`)
- JSON Schema, XML Schema (XSD)
- Free-form (Handlebars-driven text output)

When an openEHR template loads, the Mapping Editor shows a **Template Skeleton**: nested Blockly blocks matching your clinical model, including silent-mandatory RM fields the template does not mention.

## 4. Set defaults before mapping

A blank project has **no** factory **default context map** rows. **Load target & default context map** and pick the openEHR factory (or a clinic snapshot). Each **entry** has a **runtime key** (`language`, `facility`, …) for convert-time `maps_get("defaults", …)`, plus **scaffold targets** (chips such as `*.language`) that light **Default point**s when you confirm or click **Apply**.

**New** loads the target into the **Target schema** tab only: pull PARTY / term pieces onto value sockets, chip paths, **Save as**, then Apply. ▾ **Refresh from file/URL** updates a target or source without wiping canvas mappings.

When you confirm a joint load, scaffolding fills **Default point**s with map lookups — change the map once instead of every slot. Value edits are live in Test Run; new chips wait for Apply.

## 5. Map source to target (click-to-map)

1. Click a **value slot** on a Blockly block (or a row in the Mapping Specification tab).
2. The slot enters **listening mode** (highlighted).
3. Click a node in the **schema tree** or the **active example tree**.
4. A source-query block with an XPath expression is inserted.

**Tips:**

- Drag a source node onto a slot as an alternative.
- Yellow **constraint warning** triangles mark unmapped mandatory fields.
- Use the cogwheel on container blocks to add **optional RM structures** (e.g. feeder audit) allowed by the Reference Model.
- For repeating containers, click-to-map under a list wraps the container with a **for each source** loop.

## 6. Test your mapping

1. Make sure at least one example tab is open.
2. In **Target & Previews**, open the **Conversion Test Run(s)** tab and leave **Output mode** on **Mapping preview**.
3. Click **Run Test** (or enable **Autoplay** for automatic re-runs after edits).

**Conversion Test Run(s)** shows the produced instance. For openEHR targets, a ✅ or ⚠ indicates template validation via ehrtslib.

## 7. Use lists, maps, and sheets

Open the Blockly toolbox drawers:

| Drawer | Use for |
|--------|---------|
| **Lists & maps** | Generic Maps, terminology lookups (`get map key …`), list operations. The unique **default context map** is on the canvas, not in this drawer. |
| **Sheets** | 2D grids (paste from Excel/CSV); `sheet_get_*` / `sheet_lookup` accessors |
| **Logic** | Conditions, list restrictions, set operations |

The **Sheets** tab in the Mapping Editor embeds a spreadsheet for editing project-owned grids.

## 8. AI-assisted mapping

1. **Copy prompt** (toolbar) builds a markdown prompt (▾: embed / attach / URI delivery).
2. Paste into ChatGPT, Claude, Cursor, or similar — **or** save **AI credentials** and use **Call AI** (default when credentials exist).
3. Copy the `intehrgrator-suggestions` JSON from the response, or let Call AI import it.
4. **Import AI suggestions** still accepts a pasted block if you used Copy prompt.
5. **Run Test** to verify.

Refreshing a target or source opens a report with **Copy merge prompt** / **Call AI** for slots that no longer fit. Detached Blockly stays on the canvas.

## 9. Save and share projects

| Action | What it does |
|--------|--------------|
| **Save as** | Named snapshot in browser storage (web) or local storage (desktop) |
| **Load Project** | Reopen a saved snapshot |
| **Export Project** | Download a `.intehrgrator` bundle (portable, self-contained) |
| **Import Project** | Load a `.intehrgrator` file |
| **Example Sets** (▾) | Load a bundled demo (source + target + optional mapping) from a catalog |
| **Functions** | Save/load a Blockly Function (definition + Decision tables), browse the Function library, or Contribute via a GitHub issue |

## 10. Export conversion scripts

In **Target & Previews**, change **Output mode** from Mapping preview to a **conversion script language**:

- TypeScript (executable in Test Run)
- Java (generated; JVM execution planned)
- Handlebars (canvas `text_handlebars` in Test Run), XQuery, and Go Template (generated and executed in Conversion Test Run)

**Generated conversion script(s)** shows the code. Download when ready for your integration pipeline.

Generated scripts accept a **defaults** map and **sheets** bag at convert time — the same structures you authored on the canvas.

## 11. Example Sets and languages

- **Example Sets** loads complete demo projects from URIs (toolbar ▾).
- **Language** (toolbar) switches Blockly UI messages (`en`, `sv`, `de`, `es`, `ca`, `fr`). Model/ontology language in the target pane is separate.

## 12. Get help and report problems

- Click **ⓘ** next to pane headers for format hints.
- Use the toolbar **Help** menu for this tutorial and [GitHub Issues](https://github.com/regionstockholm/intehrgrator/issues/new/choose).
- Feature requests are welcome — describe the clinical workflow you are trying to support.

---

## Appendix A — Desktop app and IDE agents

The **desktop build** adds a localhost **Agent API** and stdio **MCP server** so AI-enabled IDEs can drive mappings while you watch the canvas update.

### Quick setup (Cursor example)

1. Install and run the [desktop release](https://github.com/regionstockholm/intehrgrator/releases).
2. Add MCP to `.cursor/mcp.json`:

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

Replace `cwd` with your clone path and `INTEHR_AGENT_URL` with the port shown in the desktop app console.

3. Install the mapping skill (from your clone):

```bash
npx skills@latest add regionstockholm/intehrgrator --agent cursor --skill intehrgrator-mapping --yes --copy
```

Or use the bundled copy at [.cursor/skills/intehrgrator-mapping/SKILL.md](../.cursor/skills/intehrgrator-mapping/SKILL.md).

### What agents can do

- Register an agent identity and map **node-by-node** (`map_slot` — preferred on the GUI for canvas transparency) or apply a suggestion envelope (`import_suggestions`)
- Load a target, Source Schema, examples, or a catalogued **Example Set** (`load_target`, `add_example`, `load_example_set`) when running headless
- Inspect slots, source trees, Sheets / Decision tables, Product stack, Constraint warnings (`list_slots`, `get_source_tree`, `get_sheets`, `list_constraint_warnings`)
- Build AI prompts from the loaded project (`build_prompt`); Import Suggestions still applies the same v2 envelope
- Map individual slots (`map_slot`), Optional RM, Instance encoding, slot leases — node-by-node edits are expected, not a last resort
- Run tests (`run_test`), export a Project Bundle / Conversion Script, undo/redo with revision tokens
- Open **Open observer** in the desktop UI for a live timeline of agent edits

Headless process (no browser / hidden native window):

```text
intEHRgrator --headless --port 8765
intEHRgrator --headless --load project.intehrgrator
```

Non-loopback bind requires `--token` (or `INTEHR_AGENT_TOKEN`).

Full API reference: [docs/AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

### Recommended MCP connections for mapping work

| MCP | Purpose |
|-----|---------|
| **intEHRgrator** (local) | Drive the desktop workbench |
| **openEHR assistant** | Archetype/template lookup, terminology, spec guidance |
| **DeepWiki** | ehrtslib and openEHR library questions |

The web app (GitHub Pages) does not expose the Agent API — use copy-paste AI assist or the desktop build for IDE integration.
