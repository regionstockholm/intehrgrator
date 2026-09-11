# intEHRgrator — User tutorial

A brief guide for medical informaticians mapping source data to openEHR (or other targets). For terminology, see [CONTEXT.md](../CONTEXT.md).

## 1. Open the workbench

- **Web:** [regionstockholm.github.io/intehrgrator/](https://regionstockholm.github.io/intehrgrator/)
- **Desktop:** download from [GitHub Releases](https://github.com/regionstockholm/intehrgrator/releases) and run the binary for your platform.
- **Stable web version:** check [versions.json](https://regionstockholm.github.io/intehrgrator/versions.json) for pinned URLs (`/v0.7/`, etc.). The site root is the bleeding-edge build.

The layout has three panes: **Source** (left), **Mapping Editor** (centre), **Target & Previews** (right).

## 2. Load source data

### Source schema (upper left)

Click **Load Schema** to open a structural definition: JSON Schema, XML/XSD sample, or openEHR Web Template. You can also paste a **GitHub URL** (▾ menu → From GitHub template…).

The schema tree shows field names and types for authoring mappings without an example file.

### Example instances (lower left)

Click **+ Add Example** to load one or more JSON/XML instance files (or a GitHub folder). Each file opens in its own tab.

- The **active tab** drives click-to-map and **Test Run**.
- Switch tabs to compare different patients or edge cases; each tab keeps its own last test result.

## 3. Load a target

In **Target & Previews** (right pane), click **Open target Schema/Template**.

Supported targets:

- openEHR OPT / Web Template (`.opt`, `.wt.json`, `.adl`)
- JSON Schema, XML Schema (XSD)
- Free-form (Handlebars-driven text output)

When an openEHR template loads, the Mapping Editor shows a **Template Skeleton**: nested Blockly blocks matching your clinical model, including silent-mandatory RM fields the template does not mention.

## 4. Set defaults before mapping

A **Default context mapping** block is already on the canvas. Edit the plugged-in map (language, territory, composer, facility, time, encoding, …) or **Save as** a named snapshot.

When you load a template, scaffolding fills **default points** with map lookups — change the map once instead of every slot.

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
2. In **Target & Previews**, leave **Output mode** on **Mapping preview**.
3. Click **Run Test** (or enable **Autoplay** for automatic re-runs after edits).

**Conversion Test Run(s)** shows the produced instance. For openEHR targets, a ✅ or ⚠ indicates template validation via ehrtslib.

## 7. Use lists, maps, and sheets

Open the Blockly toolbox drawers:

| Drawer | Use for |
|--------|---------|
| **Lists & maps** | Defaults Map, terminology lookups (`get map key …`), list operations |
| **Sheets** | 2D grids (paste from Excel/CSV); `sheet_get_*` / `sheet_lookup` accessors |
| **Logic** | Conditions, list restrictions, set operations |

The **Sheets** tab in the Mapping Editor embeds a spreadsheet for editing project-owned grids.

## 8. AI-assisted mapping (copy-paste)

No in-app AI API — you bring your own chat tool:

1. **Copy AI Prompt** (▾ to choose embed / attach / URI delivery).
2. Paste into ChatGPT, Claude, Cursor, or similar.
3. Copy the `intehrgrator-suggestions` JSON from the response.
4. **Import AI suggestions** → paste → **Import**.
5. **Run Test** to verify.

## 9. Save and share projects

| Action | What it does |
|--------|--------------|
| **Save as** | Named snapshot in browser storage (web) or local storage (desktop) |
| **Load Project** | Reopen a saved snapshot |
| **Export Project** | Download a `.intehrgrator` bundle (portable, self-contained) |
| **Import Project** | Load a `.intehrgrator` file |
| **Example Sets** (▾) | Load a bundled demo (source + target + optional mapping) from a catalog |

## 10. Export conversion scripts

In **Target & Previews**, change **Output mode** from Mapping preview to a **conversion script language**:

- TypeScript (executable in Test Run)
- Java, Handlebars, XQuery (generated; execution planned)

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

- Register an agent identity and apply mapping suggestions (`import_suggestions`)
- Build AI prompts from the loaded project (`build_prompt`)
- Map individual slots (`map_slot`), run tests (`run_test`), undo/redo with revision tokens
- Open **Open observer** in the desktop UI for a live timeline of agent edits

Full API reference: [docs/AGENT_WORKFLOW.md](AGENT_WORKFLOW.md).

### Recommended MCP connections for mapping work

| MCP | Purpose |
|-----|---------|
| **intEHRgrator** (local) | Drive the desktop workbench |
| **openEHR assistant** | Archetype/template lookup, terminology, spec guidance |
| **DeepWiki** | ehrtslib and openEHR library questions |

The web app (GitHub Pages) does not expose the Agent API — use copy-paste AI assist or the desktop build for IDE integration.
