# UI Architecture: Integration Workbench

This document details the split-screen mapping interface and its architectural considerations for both GitHub Pages and VS Code environments.

## Layout Overview

**Wireframe reference:** [docs/assets/prototype-ui-v1-consolidated.png](assets/prototype-ui-v1-consolidated.png) (consolidated v1 mockup; supersedes early `mapping-interface.pen` explorations).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ intEHRgrator  … [Copy AI Prompt] [Import Suggestions] [New Project] [Load Project]     │
│               [Save as] [Export Project] [Import Project]                              │
├───────────────┬──────────────────────────────┬──────────────────┬──────────────────────┤
│ LEFT PANE     │ CENTER PANE                  │ SLOTS PANE       │ RIGHT PANE           │
│ Source        │ Mapping Editor               │ Target value     │ Output Previews      │
│               │                              │ slots            │                      │
│ Schema        │ ┌─ Blockly (top) ──────────┐ │ [Open target     │ Generated conversion │
│ [Load Schema] │ │ nested RM blocks         │ │  Schema/Template]│ script(s) [Export TS]│
│               │ │ toolbox: Source/Literals/│ │ RTL slot tree    │                      │
│ Examples      │ │ Logic/Variables          │ │ click → arm slot │ Conversion Test      │
│ [+ Add Ex.]   │ ├─ Mapping Spec (bottom) ──┤ │                  │ Run(s) [Run][Autoplay│
│ [ex-a][ex-b]  │ │ DSL + expressions        │ │                  │                      │
│ instance tree │ └──────────────────────────┘ │                  │                      │
├───────────────┴──────────────────────────────┴──────────────────┴──────────────────────┤
│ #status-main: Template · Target · Example · unmapped · message │ #status-save │ build │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

Resizable split dividers between all four panes (and within Source / Mapping / Output sections) persist layout sizes in `localStorage`.

## Pane Details

### Left Pane: Source Browser

The left pane has two stacked sections: **schema** (upper) and **example instances** (lower, optional but central to testing).

#### Upper — Source Schema

- **Purpose:** Structural view for authoring mappings (field names, types, cardinality)
- **Pane action:** **Load Schema** button in the Schema section header
- **Inputs:** Schema file (JSON, XML, or other structural definition), or structure inferred when only instances are loaded
- **Interactions:** Click or drag tree nodes → insert fontoxpath expression into focused mapping slot
- **Note:** Mapping can proceed from schema alone; Test Run still needs an example tab

#### Lower — Example Instances (tabbed)

- **Purpose:** One or more JSON/XML **instance** files for click-to-map with concrete values and for Test Run
- **Pane action:** **+ Add Example** button in the Examples section header
- **UI:** Horizontal **example tabs** — one tab per loaded instance file, plus **+** to add another
- **Active tab:** Drives (1) the instance tree shown below the tabs, (2) **Test Run** input, (3) lower **Conversion Test Run(s)** label (`Running: patient-a.json`)
- **Switching tabs:** Instantly switches instance tree; re-runs Test Run if Autoplay is on, otherwise waits for **Run Test**
- **Close tab:** `×` on tab; if last tab closed, Autoplay disables and Test Run is unavailable

```
┌─ SCHEMA ────────────────────────────────┐
│ ▼ patient                               │
│   ├─ id          string                 │
│   └─ vitals[]    array                  │
├─ EXAMPLES ──────────────────────────────┤
│ [patient-a] [patient-b] [edge-case] [+] │
├─ instance tree (active tab) ────────────┤
│ ▼ patient                               │
│   └─ vitals[0]                          │
│       └─ systolic  120  ◄──             │  (click-to-map)
└─────────────────────────────────────────┘
```

- **Source querying:** [fontoxpath](https://github.com/FontoXML/fontoxpath) — see [SOURCE_QUERY.md](SOURCE_QUERY.md)
- **Technology:** Custom tree widget, tab bar for examples

**Click-to-map source:** User may click a node in the **schema tree** or the **active example instance tree**; both produce fontoxpath expressions. Example trees help when paths depend on concrete array indices or sampled values.

### Center Pane: Mapping Editor
- **Purpose:** The main workspace where the mapping logic is defined
- **Default layout:** Vertical split (not tabs):
  - **Top — Blockly canvas:** Nested puzzle-piece blocks representing the openEHR RM structure from the loaded OPT
  - **Bottom — Mapping Specification:** Block-aligned declarative DSL (not TypeScript). Structure read-only; expressions editable. Synced with Blockly via Mapping Model. See [MAPPING_SPECIFICATION.md](MAPPING_SPECIFICATION.md).
- **Blockly toolbox categories:** Source (orange), Literals (green), Logic (brown), Variables (magenta) — colour-coded in the flyout and category rail
- **Minimap:** Shown when the Blockly workspace content exceeds the visible canvas at the current zoom level, allowing quick navigation in deep templates
- **Sync pattern reference:** The Blockly ↔ text sync follows patterns demonstrated by [BlockMirror](https://blockpy-edu.github.io/BlockMirror/docs/); the text editor implementation uses [CodeMirror 6](https://codemirror.net/) directly
- **Template skeleton:** Auto-generated from loaded OPT. Includes template-constrained nodes **and** silent-mandatory RM fields (required by RM but absent from OPT) — all visible. Unmapped mandatory slots surface at Test Run validation.
- **Optional RM insertion:** `+` button on container blocks opens a **filtered picker** (only RM-valid types for that attachment point). Right-click → "Add RM structure…" opens the same picker. On selection, the parent block undergoes **block expansion** — it is modified to expose the new statement input before the child block is inserted. Pre-rendered empty slots are not shown by default.
- **Technology:** [Blockly](https://developers.google.com/blockly) + [CodeMirror 6](https://codemirror.net/)

### Slots Pane: Target Value Slots
- **Purpose:** Compact navigation rail for the template skeleton — arm a slot for click-to-map without scrolling the Blockly canvas
- **Header action:** **Open target Schema/Template** — load an OPT (or other target structure file) to generate the Template Skeleton
- **Layout:** Right-to-left tree (root on the right, leaves on the left) listing skeleton nodes and value slots
- **Visual states:** Unmapped mandatory (red border), mapped (green border), listening/armed (orange outline)
- **Interaction:** Click a slot row → arms that slot in Blockly (same as clicking the slot block)

### Right Pane: Output Previews
- **Purpose:** Live preview of generated code **and** test execution results — both required in v1
- **Header action:** **Export TS** — download the generated TypeScript mapping script
- **Upper section:** **Generated conversion script(s)** (glossary: [Generated Export](../CONTEXT.md#generated-export)) — executable TypeScript from Blockly generators (read-only CodeMirror). **Not** the same as the center Mapping Specification.
- **Lower section:** **Conversion Test Run(s)** (glossary: [Test Run](../CONTEXT.md#test-run)) — runs mapping against the **active example tab**; displays resulting Composition as JSON. Section header includes **Run Test** and **Autoplay / Pause**.
- **Deferred v1:** Export Java button and TypeScript / Java target toggle (Java generator exists; UI not wired yet)

## Toolbar & Pane Actions

Actions are split between the **header toolbar** (project-wide) and **pane headers/sections** (contextual).

### Header toolbar

| Button | Action | v1 |
|--------|--------|-----|
| Copy AI Prompt | Generate markdown prompt to clipboard (▾: embed / attach / browse URIs) | ✓ |
| Import Suggestions | Parse pasted `intehrgrator-suggestions` JSON and apply mappings | ✓ |
| New Project | Reset workspace to empty project (confirm if content present) | ✓ |
| Load Project | Open modal listing autosave + recent manual saves | ✓ |
| Save as | Open modal to name and persist a manual save to IndexedDB | ✓ |
| Export Project | Download self-contained `.intehrgrator` bundle | ✓ |
| Import Project | Load `.intehrgrator` bundle | ✓ |

### Pane actions

| Button | Location | Action | v1 |
|--------|----------|--------|-----|
| Load Schema | Source → Schema section | Split control: main click loads a schema file; chevron offers **From file**, **From URL**, and recent URLs | ✓ |
| + Add Example | Source → Examples section | Split control: main click opens a JSON/XML instance; chevron offers file, URL, and recent URLs | ✓ |
| Open target Schema/Template | Target value slots pane header | Split control: main click loads an OPT/schema file; chevron offers file, URL, and recent URLs | ✓ |
| Export TS | Output Previews pane header | Download the generated TypeScript mapping script | ✓ |
| Run Test | Output → Conversion Test Run(s) | Execute mapping once against active example (when Autoplay is paused) | ✓ |
| Autoplay / Pause | Output → Conversion Test Run(s) | Toggle debounced auto Test Run on mapping edits (ehrtslib demo pattern) | ✓ |

### Deferred (not in current Web Shell UI)

| Button | Notes |
|--------|-------|
| Export Java | Generator built; download button not wired in v1 Web Shell |
| Settings | Target language, theme, validation strictness — planned; export target defaults to TypeScript |

## Test Runner (v1)

The test runner is a core informatician workflow, not a nice-to-have.

1. User loads template + source schema (optional) + one or more **example instance tabs**
2. User authors mappings in Mapping Editor (schema and/or active example tree for click-to-map)
3. Test execution uses the **active example tab** as input:
   - **Autoplay / Pause toggle** — ehrtslib demo pattern
   - **Autoplay on:** debounced Test Run (~500ms) after **mapping edits only**
   - **Paused:** user clicks **Run Test** for a single execution against active tab
4. Lower **Conversion Test Run(s)** section shows converted output for active source example; **tab switch** shows the **cached last result** for that tab (no automatic re-run on switch)

**Per-tab result cache:** Each example tab remembers its last Test Run output. Switching tabs is instant. **Run Test** refreshes the active tab; Autoplay refreshes all tabs on mapping edits.

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
2. Clicks **Copy AI Prompt** (main button uses last delivery mode; ▾ chooses mode)
3. App copies markdown to clipboard containing:
   - Task description (map source → loaded **Target instance format**) and scope (`slot` | `full`)
   - Target: format, `targetId`, filename, origin (file or URI), structure summary
   - Source schema and example instance(s): format, filename, origin
   - Slot manifest: `{ slotId, valueType, label, targetPath?, multiplicity? }` for in-scope unmapped slots
   - **Artifact delivery** — one of:
     - **Embed files in prompt** (`inline`) — multipart file bodies in the clipboard text
     - **Attach files in chat** (`attach`) — checklist for chat UI uploads
     - **Browse URIs** (`uri`) — instruct agents that can fetch URLs; local-only files fall back to attach checklist
   - Link to [AI_SUGGESTION_FORMAT.md](AI_SUGGESTION_FORMAT.md) (deployed URL) specifying version 2 Blockly-subset response format
4. User pastes into external AI chat (ChatGPT, Claude, Cursor, etc.)

### Import Suggestions

1. User copies the `intehrgrator-suggestions` fenced JSON (or raw JSON) from the AI response
2. Clicks **Import Suggestions** → paste dialog (pre-filled from clipboard when the text looks like suggestions)
3. App validates version `"2"` against [AI_SUGGESTION_FORMAT.schema.json](AI_SUGGESTION_FORMAT.schema.json); matches `target` when present (otherwise uses the loaded target); resolves each `slotId`; converts Blockly `block` → Mapping Model expression; applies to the value slot
4. Applied / skipped / schema errors stay visible in the dialog; **Copy errors for AI** builds a follow-up the user can paste back into the chat; user verifies with **Run Test**

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

## Autosave & Status Bar

The footer status bar has three regions:

| Element | ID | Content |
|---------|-----|---------|
| Main status | `#status-main` | `Template · Target · Example · N unmapped mandatory · {transient message}` |
| Save status | `#status-save` | `unsaved changes` (red) or `autosaved at hh:mm` (green) after debounced autosave |
| Build stamp | `#status-build` | `{BUILD_ID} · {BUILD_TIMESTAMP}` |

**Autosave:** After any workspace edit, a **10 s debounced** timer writes the current Project Bundle to IndexedDB under storage key `__autosave__`. Successful autosave clears the dirty flag and updates `#status-save`. Autosave does not replace named manual saves.

**Manual save (Save as):** User names the project; bundle is stored under `manual:{uuid}`. Only the **last 5** manual saves are retained (older entries pruned). Clears dirty state and shows a transient confirmation in `#status-main`.

## Project Dialogs

### Save as

1. User clicks **Save as** in the header toolbar
2. Modal prompts for **Project name** (prefilled from current template id when available)
3. On confirm, bundle is written as a manual save; modal closes

### Load project

1. User clicks **Load Project**
2. Modal lists loadable entries in order:
   - **Last autosave** (`__autosave__`), if present
   - Up to **5 most recent manual saves** (`manual:{uuid}`), newest first
3. Each row shows kind label, display name, and save time (`hh:mm`)
4. Selecting an entry replaces the current workspace (confirm if content present)

### New project

1. User clicks **New Project**
2. Browser `confirm()` — stronger warning if workspace has content (template, schema, examples, or mappings)
3. On confirm, workspace resets to empty state (new `projectId`, cleared panes)

## Project Persistence (v1)

Projects are self-contained; see [PROJECT_PERSISTENCE.md](PROJECT_PERSISTENCE.md).

IndexedDB uses two stores: `projects` (legacy/by project id) and `saves` (autosave + manual snapshots).

| Storage key | Kind | UI label | Retention |
|-------------|------|----------|-----------|
| `__autosave__` | autosave | Last autosave | Single slot (overwritten) |
| `manual:{uuid}` | manual | Saved project | Last 5, pruned on new save |

- **Save as** writes a manual save to the `saves` store.
- **Load Project** reads from `saves` (autosave + recent manual list).
- **Export Project** downloads a `.intehrgrator` file containing the OPT, source/example content, Blockly workspace, settings, and metadata.
- **Import Project** restores the bundle after validating app/project version and template id (marks workspace dirty).
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

For a scale going from source to target we sometimes want to use 
https://colorbrewer2.org/?type=diverging&scheme=PRGn&n=9
['#762a83','#9970ab','#c2a5cf','#e7d4e8','#f7f7f7','#d9f0d3','#a6dba0','#5aae61','#1b7837']

## References

- [Blockly](https://developers.google.com/blockly) — Visual block programming
- [CodeMirror 6](https://codemirror.net/) — Text editor component
- [BlockMirror](https://blockpy-edu.github.io/BlockMirror/docs/) — Blockly + CodeMirror integration reference
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview) — Hosting web content in VS Code
- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model) — AI integration in VS Code
