# UI Architecture: Integration Workbench

This document details the split-screen mapping interface and its architectural considerations for both GitHub Pages and VS Code environments.

## Layout Overview

**Wireframe reference:** [docs/assets/prototype-ui-v1-consolidated.png](assets/prototype-ui-v1-consolidated.png) (consolidated v1 mockup; supersedes early `mapping-interface.pen` explorations).

```
┌──────────────────────────────────────────────────────────────────────┐
│ Toolbar: … [Load Schema] [+ Add Example] [Run Test] [▶ Autoplay] … │
├────────────────┬─────────────────────────┬───────────────────────────┤
│ LEFT PANE      │ CENTER PANE             │ RIGHT PANE                │
│ Source         │ Mapping Editor          │ Output Preview            │
│                │                         │                           │
│ ┌─ SCHEMA ───┐ │ ┌─ Blockly (top) ─────┐ │ ┌─ Generated Code ─────┐ │
│ │ patient    │ │ │ nested RM blocks    │ │ │ TS/Java export       │ │
│ │ ├─ id      │ │ │ + minimap           │ │ └──────────────────────┘ │
│ │ └─ vitals[]│ │ ├─ Mapping Spec (bot)─┤ │ ┌─ Test Run ───────────┐ │
│ └────────────┘ │ │ DSL + expressions   │ │ │ Result for active    │ │
│ [ex-a][ex-b][+]│ │                     │ │ │ example tab          │ │
│ ┌─ instance ─┐ │ └─────────────────────┘ │ └──────────────────────┘ │
│ │ vitals[0]  │ │                         │                           │
│ │ └ systolic │ │                         │                           │
│ └────────────┘ │                         │                           │
├────────────────┴─────────────────────────┴───────────────────────────┤
│ Status: [Template] [Target: TS] [Example: patient-a.json] [Mapping …]  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Pane Details

### Left Pane: Source Browser

The left pane has two stacked sections: **schema** (upper) and **example instances** (lower, optional but central to testing).

#### Upper — Source Schema

- **Purpose:** Structural view for authoring mappings (field names, types, cardinality)
- **Inputs:** JSON schema, or structure inferred when only instances are loaded
- **Interactions:** Click or drag tree nodes → insert fontoxpath expression into focused mapping slot; search/filter
- **Note:** Mapping can proceed from schema alone; Test Run still needs an example tab

#### Lower — Example Instances (tabbed)

- **Purpose:** One or more JSON/XML **instance** files for click-to-map with concrete values and for Test Run
- **UI:** Horizontal **example tabs** — one tab per loaded instance file, plus **+** to add another
- **Active tab:** Drives (1) the instance tree shown below the tabs, (2) **Test Run** input, (3) lower Output Preview label (`Running: patient-a.json`)
- **Switching tabs:** Instantly switches instance tree; re-runs Test Run if Autoplay is on, otherwise waits for **Run Test**
- **Close tab:** `×` on tab; if last tab closed, Autoplay disables and Test Run is unavailable

```
┌─ SCHEMA ─────────────────────┐
│ ▼ patient                    │
│   ├─ id          string      │
│   └─ vitals[]    array       │
├─ EXAMPLES ───────────────────┤
│ [patient-a.json*] [patient-b] [edge.xml] [+] │
├─ instance tree (active tab) ─┤
│ ▼ patient                    │
│   └─ vitals[0]               │
│       └─ systolic  120  ◄──  │  (click-to-map)
└──────────────────────────────┘
```

- **Source querying:** [fontoxpath](https://github.com/FontoXML/fontoxpath) — see [SOURCE_QUERY.md](SOURCE_QUERY.md)
- **Technology:** Custom tree widget, tab bar for examples

**Click-to-map source:** User may click a node in the **schema tree** or the **active example instance tree**; both produce fontoxpath expressions. Example trees help when paths depend on concrete array indices or sampled values.

### Center Pane: Mapping Editor
- **Purpose:** The main workspace where the mapping logic is defined
- **Default layout:** Vertical split (not tabs):
  - **Top — Blockly canvas:** Nested puzzle-piece blocks representing the openEHR RM structure from the loaded OPT
  - **Bottom — Mapping Specification:** Block-aligned declarative DSL (not TypeScript). Structure read-only; expressions editable. Synced with Blockly via Mapping Model. See [MAPPING_SPECIFICATION.md](MAPPING_SPECIFICATION.md).
- **Minimap:** Shown when the Blockly workspace content exceeds the visible canvas at the current zoom level, allowing quick navigation in deep templates
- **Sync pattern reference:** The Blockly ↔ text sync follows patterns demonstrated by [BlockMirror](https://blockpy-edu.github.io/BlockMirror/docs/); the text editor implementation uses [CodeMirror 6](https://codemirror.net/) directly
- **Template skeleton:** Auto-generated from loaded OPT. Includes template-constrained nodes **and** silent-mandatory RM fields (required by RM but absent from OPT) — all visible. Unmapped mandatory slots surface at Test Run validation.
- **Optional RM insertion:** `+` button on container blocks opens a **filtered picker** (only RM-valid types for that attachment point). Right-click → "Add RM structure…" opens the same picker. On selection, the parent block undergoes **block expansion** — it is modified to expose the new statement input before the child block is inserted. Pre-rendered empty slots are not shown by default.
- **Technology:** [Blockly](https://developers.google.com/blockly) + [CodeMirror 6](https://codemirror.net/)

### Right Pane: Output Preview (collapsible)
- **Purpose:** Live preview of generated code **and** test execution results — both required in v1
- **Upper section:** **Generated Export** — executable TypeScript/Java from Blockly generators (read-only CodeMirror). v1 shows TypeScript only. **Not** the same as the center Mapping Specification.
- **Lower section:** **Test runner** — runs mapping against the **active example tab**; displays resulting Composition as JSON. Tab name shown in pane header (e.g. `Running: patient-a.json`).
- **Toggle:** TypeScript / Java target selector (Java disabled in v1 until export ships)

## Toolbar Actions

| Button | Action | v1 |
|--------|--------|-----|
| Open Template | Load an OPT file (.opt, .opt2, .json) to generate the target skeleton | ✓ |
| Load Schema | Load JSON schema (or structural definition) into upper Source Pane | ✓ |
| + Add Example | Open a JSON/XML instance as a new example tab | ✓ |
| Export TS | Download the generated TypeScript mapping script | ✓ |
| Export Java | Download the generated Java mapping script | Deferred (generator built in Step 1) |
| Copy AI Prompt | Generate markdown prompt to clipboard for external AI chat | ✓ |
| Import Suggestions | Parse pasted `intehrgrator-suggestions` JSON and apply mappings | ✓ |
| Save Project | Save self-contained Project Bundle to IndexedDB | ✓ |
| Export Project | Download self-contained `.intehrgrator` bundle | ✓ |
| Import Project | Load `.intehrgrator` bundle | ✓ |
| Settings | Configure target language, theme, validation strictness | ✓ |
| Run Test | Execute mapping once against example instance (when Autoplay is paused) | ✓ |
| Autoplay / Pause | Toggle debounced auto Test Run on mapping edits (ehrtslib demo pattern) | ✓ |

† Export Java visible but disabled in v1 (tooltip: "Coming soon"). Both TS and Java Blockly generators are implemented in Step 1 so blocks stay language-agnostic.

## Test Runner (v1)

The test runner is a core informatician workflow, not a nice-to-have.

1. User loads template + source schema (optional) + one or more **example instance tabs**
2. User authors mappings in Mapping Editor (schema and/or active example tree for click-to-map)
3. Test execution uses the **active example tab** as input:
   - **Autoplay / Pause toggle** — ehrtslib demo pattern
   - **Autoplay on:** debounced Test Run (~500ms) after **mapping edits only**
   - **Paused:** user clicks **Run Test** for a single execution against active tab
4. Lower Output Preview shows Composition JSON for that example; **tab switch** shows the **cached last result** for that tab (no automatic re-run on switch)

**Per-tab result cache:** Each example tab remembers its last Test Run output. Switching tabs is instant. **Run Test** refreshes the active tab; Autoplay refreshes on mapping edits.

### Autoplay toggle rules

| Condition | Toggle state |
|-----------|--------------|
| At least one example instance tab open | Enabled |
| No example tabs (schema-only) | **Disabled** (tooltip: add an example instance to run tests) |
| Autoplay on + mapping edit | Debounced Test Run against active tab |
| Tab switch (any Autoplay state) | Show cached result only; no automatic re-run |
| Paused + **Run Test** | Runs once against active tab |

**Runtime:** Bundled `ehrtslib` in the web shell; generated mapping code is executed client-side (no server).

**Out of scope v1:** Java test execution, uploading results to a CDR.

## AI Assist — Copy-Paste (v1)

No in-app AI API in the web shell. Integrated AI is deferred to VS Code; see [docs/future/integrated-ai-assist.md](future/integrated-ai-assist.md).

### Copy AI Prompt

1. User optionally selects a single value slot (scopes prompt to that `slotId`) or leaves unselected (all unmapped slots)
2. Clicks **Copy AI Prompt**
3. App copies markdown to clipboard containing:
   - Task description and scope (`slot` | `full`)
   - Template id, filename, structure summary / reference
   - Source filename, structure summary / reference
   - Slot manifest: `{ slotId, rmType, label }` for in-scope unmapped slots
   - Link to [AI_SUGGESTION_FORMAT.md](AI_SUGGESTION_FORMAT.md) (deployed URL) specifying the deterministic response format
4. User pastes into external AI chat (ChatGPT, Claude, Cursor, etc.); may attach full source/OPT files there

### Import Suggestions

1. User copies the `intehrgrator-suggestions` fenced JSON block from the AI response
2. Clicks **Import Suggestions** → paste dialog
3. App validates format, matches `templateId`, resolves each `slotId` to a Blockly value slot, inserts expressions
4. Reports applied / skipped / errors; user verifies with **Run Test**

## Cross-Pane Interaction: "Click-to-Map"

The core user workflow:
1. User clicks on an **element value slot** in the Blockly canvas (top half of Mapping Editor)
2. The slot enters **listening mode** (highlighted)
3. User clicks a **source tree node** in the schema section **or** the active example instance tree
4. A `source_query` block (XPath via fontoxpath) is auto-inserted into the slot, with `returnType` set from the slot's `DV_*` type
5. The CodeMirror panel updates in real time

**Secondary interaction:** Drag a source tree node onto a Blockly value slot (skips listening mode).

**Deferred:** Wildcard placeholder blocks — see [docs/future/wildcard-source-mapping.md](future/wildcard-source-mapping.md).

## Optional RM Insertion

1. User clicks `+` on a container block (e.g. `OBSERVATION`) or right-clicks → "Add RM structure…"
2. **Filtered picker** shows only RM-valid structures for that attachment point (derived from ehrtslib RM definitions + template context)
3. **Block expansion:** the parent block definition is updated to include the corresponding statement input if not already present
4. The chosen structure is inserted as nested Blockly blocks in the new input
5. User maps the new structure's value slots via click-to-map as usual

Validation: the picker never offers types that violate RM cardinality or type constraints at that node.

## CodeMirror Sync Scope (Mapping Editor)

The center CodeMirror panel shows the **[Mapping Specification](MAPPING_SPECIFICATION.md)** — not Generated Export.

| Panel | Content | Editable |
|-------|---------|----------|
| Center / bottom | Mapping Specification (block-aligned DSL) | Expressions only (`=` lines) |
| Right / upper | Generated Export (TypeScript/Java) | Read-only |

| Editable in spec text | Read-only in spec text |
|-----------------------|-------------------------|
| JS-shaped expressions (`xpathNumber(...)`, `trim(...)`, `if(...)`) | `composition`, `section`, `observation`, `element` structure |
| | `slotId`, `:: DV_*` type annotations |
| | Optional RM insertion (use Blockly `+`) |

- Expression edits parse → update expression Blockly blocks + Mapping Model `slots[]`.
- Structural edits in text are rejected; use Blockly.
- Block selection ↔ spec region highlight in both directions.

**Later:** CodeMirror decorations mark read-only vs editable regions — see [text-first-mapping-editor.md](future/text-first-mapping-editor.md).

## Environment Abstraction

The app runs in two environments with shared core code. **v1 ships Web Shell only** (GitHub Pages); VS Code extension is a later milestone using the same Host Abstraction interface.

```
┌─────────────────────────────────────────────┐
│              Shared Core (TypeScript)        │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Blockly  │ │CodeMirror│ │ openEHR      │  │
│  │ Blocks & │ │ Sync     │ │ Template     │  │
│  │Generators│ │ Engine   │ │ Parser       │  │
│  └─────────┘ └──────────┘ └──────────────┘  │
├──────────────────────┬──────────────────────┤
│ Web Shell (GH Pages) │ VS Code Extension    │
│ - HTML host page     │ - Webview Panel      │
│ - File System API    │ - VS Code FS API     │
│ - IndexedDB storage  │ - Workspace storage  │
│ - Copy-paste AI      │ - Integrated AI (LM) │
└──────────────────────┴──────────────────────┘
```

| Milestone | Host | Storage | AI |
|-----------|------|---------|-----|
| **v1** | Web Shell (GitHub Pages) | IndexedDB | Copy-paste AI assist (no API) |
| **Later** | VS Code extension | Workspace storage | Integrated AI (Language Model API) |

## Project Persistence (v1)

Projects are self-contained; see [PROJECT_PERSISTENCE.md](PROJECT_PERSISTENCE.md).

- **Save Project** writes the Project Bundle to IndexedDB.
- **Export Project** downloads a `.intehrgrator` file containing the OPT, source/example content, Blockly workspace, settings, and metadata.
- **Import Project** restores the bundle after validating app/project version and template id.
- Browser file paths are not used as durable references in v1.

## Color Scheme (Karolinska-inspired)

Based on [Karolinska Universitetssjukhuset](https://www.karolinska.se/) and Region Stockholm branding:

| Role | Color | Usage |
|------|-------|-------|
| Primary | `#005C53` | Headers, primary buttons, active states |
| Primary Dark | `#003B49` | Sidebar background, toolbar |
| Accent Warm | `#E87722` | Highlights, call-to-action, AI suggestions |
| Surface | `#FFFFFF` | Main pane backgrounds |
| Surface Alt | `#F5F5F0` | Subtle panel backgrounds, tree pane |
| Text Primary | `#1A1A1A` | Body text |
| Text Secondary | `#666666` | Labels, metadata |
| Border | `#D9D9D9` | Panel dividers, tree lines |
| Success | `#2E7D32` | Validation passed |
| Warning | `#F9A825` | Validation warnings |
| Error | `#C62828` | Validation errors |

## References

- [Blockly](https://developers.google.com/blockly) — Visual block programming
- [CodeMirror 6](https://codemirror.net/) — Text editor component
- [BlockMirror](https://blockpy-edu.github.io/BlockMirror/docs/) — Blockly + CodeMirror integration reference
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview) — Hosting web content in VS Code
- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model) — AI integration in VS Code
