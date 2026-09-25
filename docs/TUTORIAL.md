# intEHRgrator — User tutorial

A brief guide for medical informaticians mapping source data to openEHR (or other targets). For terminology, see [CONTEXT.md](../CONTEXT.md).

## 1. Open the workbench

- **Web:** [regionstockholm.github.io/intehrgrator/](https://regionstockholm.github.io/intehrgrator/)
- **Desktop:** download from [GitHub Releases](https://github.com/regionstockholm/intehrgrator/releases) and run the binary for your platform.
- **Stable web version:** check [versions.json](https://regionstockholm.github.io/intehrgrator/versions.json) for pinned URLs (`/v0.7/`, etc.). The site root is the bleeding-edge build.

The layout has three panes: **Source** (left, slide-away), **Mapping Editor** (centre), **Target & Previews** (right, tabbed and slide-away).

One of the easiest ways to learn the tool is to load an example set (often containing source schema, source examples, target schema and a scaffolded example with some already saved mappings) and then play around with the features and clicking the (i) - encircled i symbols in the user interface to learn mora about different things. 

The steps below on the other hand describe how you start from scratch with files for your own projects.

## 2. Load source data

### Source schema (upper left)

Click **Load Schema** to open a structural definition: JSON Schema, XML/XSD sample, or openEHR Web Template. You can also paste a **GitHub URL** (▾ menu → From GitHub template…).

The schema tree shows field names and types for authoring mappings without an example file.

### Example instances (lower left)

Click **+ Add Example** to load one or more JSON/XML instance files (or a GitHub folder). Each file opens in its own tab.

- The **active tab** drives click-to-map and also shifts corresponding **Test Run** tab (in right-hand pane).
- Switch tabs to compare different patients or edge cases.

## 3. Load a target

In **Target & Previews** (right pane), click **Load target & default context map**. Pick a target (file, URL, or the one already loaded) and a **default context map** (openEHR factory, a saved snapshot, a file, or **New**) if you need one. Confirm scaffolds the **Template Skeleton** and **Default point**s. **New** loads the target into the **Target schema** tab only so you can pull chips and values, then Apply. After a target loads, the **Target schema** tab shows its tree — drag a leaf or subtree onto empty canvas to add optional structure (or to recreate mistakenly deleted scaffold when detected so late that you do not want to use undo). Drag a leaf onto **scaffold target** chips, or a subtree onto a map value socket, to author the map.

Supported targets:

- openEHR "operational templates" OPT / Web Template (`.opt`, `.wt.json`, `.adl`)
- JSON Schema
- XML Schema (XSD)
- Free-form text document (no schema, likely using handlebars-templating, decision tables with text snippet output and other text manipulation blockly-blocks)

When an openEHR template loads, the Mapping Editor shows a **Template Skeleton**: nested Blockly blocks matching your clinical model, including silent-mandatory RM fields the template does not mention.

## 4. Set defaults before mapping (if wanted)

Often formats for targets contain default values that are not in the source input, but that are either hardcoded or provided via a dynamic mapping context in the enviroment where the converion code is running. This is what the **default context map** is for, and it also can help scaffolding sensible (often repeated) things.

A blank project has **no** factory **default context map** rows. Use **Load target & default context map** and for example pick the openEHR factory. Each **entry** has a **runtime key** (in the openEHR example `language`, `facility`, …) for convert-time `maps_get("defaults", …)`, plus **scaffold targets** (chips such as `*.language`) that light **Default point**s when you confirm or click **Apply**.

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

Three ways to bring a model onto the mapping:

1. **Copy prompt** (toolbar ▾: embed / attach / URI) → paste into ChatGPT, Claude, Cursor, … → **Import AI suggestions**.
2. **Call AI** — save **AI credentials…** (provider presets + key links). Default mode sends mapping **tools** named like MCP (`map_slot`, `import_suggestions`, `run_test`, …) and applies them on the live canvas. **Suggestions JSON only** is the older one-shot import. Desktop forwards the provider call so browser CORS does not block Gemini/OpenAI/Anthropic/HF/Zen.
3. **IDE + MCP** (desktop) — see Appendix A. OpenCode’s cloud runner / `opencode serve` can use the same HTTP Agent API when it can reach the desktop.

Provider key pages (also linked from the credentials dialog). Longer walkthrough: [Call AI credentials](AI_CREDENTIALS.md).

| Provider | Create credentials |
|----------|-------------------|
| Google Gemini | [AI Studio API keys](https://aistudio.google.com/app/apikey) · [OpenAI-compat docs](https://ai.google.dev/gemini-api/docs/openai) |
| OpenAI | [API keys](https://platform.openai.com/api-keys) · [Chat completions](https://platform.openai.com/docs/api-reference/chat) |
| Anthropic Claude | [Console keys](https://console.anthropic.com/settings/keys) · [OpenAI SDK compat](https://platform.claude.com/docs/en/api/openai-sdk) |
| Ollama local | [OpenAI compatibility](https://docs.ollama.com/openai) (dummy key `ollama`) |
| Ollama Cloud | [API keys](https://ollama.com/settings/keys) · [Cloud](https://docs.ollama.com/cloud) |
| LM Studio local | [OpenAI compat](https://lmstudio.ai/docs/developer/openai-compat) · [Auth tokens](https://lmstudio.ai/docs/developer/core/authentication) |
| LM Studio cloud / remote | [LM Link](https://lmstudio.ai/docs/lmlink/basics) · [Bionic models](https://lmstudio.ai/docs/bionic/models) (LAN `:1234`; Bionic Cloud is in-app credits) |
| Hugging Face | [Access tokens](https://huggingface.co/settings/tokens) · [Inference Providers](https://huggingface.co/docs/inference-providers/en/index) |
| OpenCode Zen | [Auth / API key](https://opencode.ai/auth) · [Zen](https://opencode.ai/docs/zen/) |
| OpenCode cloud runner | [Server](https://opencode.ai/docs/server/) · [Railway `railway ca desktop --opencode`](https://docs.railway.com/cloud-agents/opencode) — point the runner at MCP / Agent API; Zen key is still what Call AI uses |

Refreshing a target or source opens a report with **Copy merge prompt** / **Call AI**. Detached Blockly stays on the canvas.
**Run Test** after any AI pass.

## 9. Save and share projects

| Action | What it does |
|--------|--------------|
| **Save as** | Named snapshot in browser storage (web) or local storage (desktop) |
| **Load Project** | Reopen a saved snapshot |
| **Export Project** | Download a `.intehrgrator` bundle (portable, self-contained) |
| **Import Project** | Load a `.intehrgrator` file |
| **Example Sets** (▾) | Open a catalogued demo. Each family has an **unmapped** row (schema + instances + target) and a **mapped** row (the same files plus a saved mapping). See [§11](#11-example-sets-and-languages) |
| **Functions** | Save/load a Blockly Function (definition + Decision tables), browse the Function library, or Contribute via a GitHub issue |

## 10. Export conversion scripts

In **Target & Previews**, change **Output mode** from Mapping preview to a **conversion script language**:

- TypeScript (executable in Test Run)
- Java (generated; JVM execution planned)
- Handlebars (canvas `text_handlebars` or nested Note `text_code` LANG=handlebars in Test Run), XQuery, and Go Template (generated and executed in Conversion Test Run)

**Generated conversion script(s)** shows the code. Download when ready for your integration pipeline.

Generated scripts accept a **defaults** map and **sheets** bag at convert time — the same structures you authored on the canvas.

## 11. Example Sets and languages

### Open an Example Set

1. In the toolbar, click **Example Sets** (or the ▾ beside it) and pick a catalog row.
2. Confirm if the canvas already has work — loading a set **replaces** the current Source Schema, Example Instances, target, and mapping.
3. Wait for the progress overlay; the status bar then names the loaded set.
4. Inspect the left pane (schema + instance tabs) and the Mapping Editor.

- **Unmapped** rows leave Template Skeleton mouths empty (yellow constraint triangles on mandatory slots).
- **Mapped** rows restore saved Blockly, and often Sheets and a **default context map**.
- Switch instance tabs, then **Run Test** in **Conversion Test Run(s)** against the **Active Example**.

Catalog ids (`dummy-json-vitals`, `Simple-vitals`, …) stay stable for Agent API `load_example_set`. What you read in the menu is the **title**.

### Unmapped vs mapped

Each **family** (same source + target) has at least two catalog rows. That is the difference that matters, not whether the word “example” appears in the title.

| Kind | What loads | Use it to |
|------|------------|-----------|
| **Unmapped** | Schema, instances, target only (no mouths filled) | Practise Click-to-Map, or let an agent `map_slot` / **Import AI suggestions** on a blank Template Skeleton |
| **Mapped** | The same files plus a saved mapping (and often Sheets / Defaults) | Inspect a known-good canvas and run **Conversion Test Run(s)** |
| **Mapped, decision tables** | Sibling of a mapped gold (lung-MDT and chemo only) | Same instances and target; Notes/TermIds authored as Decision tables with interpolating snippets instead of nested `if`/`eq`. Gold directories stay untouched ([#70](https://github.com/regionstockholm/intehrgrator/issues/70)) |

### Titles

Family and route first; mapping state always **last**, same punctuation ([#166](https://github.com/regionstockholm/intehrgrator/issues/166)):

`{family} ({route}) — unmapped` · `{family} ({route}) — mapped` · `{family} ({route}) — mapped, decision tables`

Paired unmapped/mapped rows share the family + route wording; only the trailing state differs. Dialect hints (Handlebars Notes, Go Template) live in the set **description** and in Output mode, not in the title.

| Family (route) | Unmapped | Mapped | Mapped, decision tables |
|----------------|----------|--------|-------------------------|
| Dummy vitals (JSON Schema → JSON Schema) | Dummy vitals (JSON Schema → JSON Schema) — unmapped | Dummy vitals (JSON Schema → JSON Schema) — mapped | — |
| Dummy vitals (JSON Schema → openEHR Template) | Dummy vitals (JSON Schema → openEHR Template) — unmapped | Dummy vitals (JSON Schema → openEHR Template) — mapped | — |
| Dummy vitals series (JSON Schema with repeating measurements → openEHR) | Dummy vitals series (JSON Schema with repeating measurements → openEHR) — unmapped | Dummy vitals series (JSON Schema with repeating measurements → openEHR) — mapped | — |
| OBX MHV1 (JSON → openEHR) | OBX MHV1 (JSON → openEHR) — unmapped | OBX MHV1 (JSON → openEHR) — mapped | — |
| Patient-reported chemotherapy symptoms (FLAT → TakeCare XML) | … — unmapped | … — mapped | … — mapped, decision tables |
| Lung MDT form (→ TakeCare XML) | … — unmapped | … — mapped | … — mapped, decision tables |
| Medication order data from Cytodos and TC via Karda (JSON → openEHR FLAT) | … — unmapped | … — mapped | — |
| Medication treatment data from Cytodos and TC via Karda (JSON → openEHR FLAT) | … — unmapped | … — mapped | — |

### Suggested first loads

1. **Dummy vitals (JSON Schema → JSON Schema) — unmapped** — Click-to-Map systolic/diastolic/unit; **Conversion Test Run(s)** on Mapping preview or TypeScript.
2. **Dummy vitals (JSON Schema → JSON Schema) — mapped** — three instances; Test Run should show `120` / `80` / `mm[Hg]` on `instance-1`.
3. A clinical **mapped** set: Dummy vitals → openEHR (*Dummy vitals (JSON Schema → openEHR Template) — mapped*), chemo with Output mode **Go Template**, or lung-MDT with **Mapping preview** or **Handlebars**.

Named-invalid vitals instances (filename contains `invalid` / `broken`) are negative tests; they should not produce a fully valid template instance.

Simple-vitals / series **valid** instances still show ⚠ (`outputValidation`) for remaining OPT messages (required attributes, unit list, CLUSTER vs ELEMENT, default-context `CODE_PHRASE`). Clinical magnitudes `120` / `80` / `72` (series `138`) are present; named-invalid instances stay negative tests.

Lung-MDT **Mapping preview** and **Handlebars** agree on evaluated TermId and Note pairs. Karda mapped sets emit Simplified FLAT with clinical content in TypeScript, and XQuery executes the same instances. Remaining Karda `outputValidation` messages (category, minimum cardinality, XQuery skeleton noise) are recorded in [karda-admin-mapping-benchmark.md](design/karda-admin-mapping-benchmark.md).

### Known gaps

- Lung-MDT VMS-Hbs `@first` / `@last` stays later ([#135](https://github.com/regionstockholm/intehrgrator/issues/135)).

**Language** (toolbar) switches Blockly UI messages (`en`, `sv`, `de`, `es`, `ca`, `fr`). Model/ontology language in the target pane is separate.

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

The web app (GitHub Pages) does not expose the Agent API to IDEs. Use **Call AI** (in-app tools against the open project), copy-paste, or the desktop build for MCP / remote Agent API.
