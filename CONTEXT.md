# Integration Workbench (intEHRgrator)

A visual mapping tool for healthcare informaticians to author conversion logic from source data either generic (JSON, XML) or openEHR Compositions (canonical/FLAT/STRUCTURED and other formats supported by ehrtslib) into a chosen **Target instance format** — instances adhering to openEHR templates, JSON Schema, XML Schema, or free-form text — with **Conversion script languages** TypeScript, Java, or Handlebars.

## Language

**Source Pane**:
The left pane with two sections: **Source Schema** (upper, structural tree for mapping) and **Example Instances** (lower, optional tabbed instance files). Source queries use `fontoxpath` behind the Source Format Handler.
_Avoid_: Left panel, input pane

**Source Schema**:
Upper section of the Source Pane — schema file (JSON Schema, XML/XSD sample, openEHR Web Template, or other structural definition) or inferred structure (field names, types, cardinality). Used for authoring mappings without requiring an example file. Empty state prompt: *Load a schema file.*
_Avoid_: Schema tree, structure view

**Example Instance**:
A loaded source data file representing one real source record (JSON, XML, or openEHR Composition/FLAT/STRUCTURED). Shown in its own tab; used for click-to-map with concrete values and as input to Test Run.
_Avoid_: Sample file, test data

**Active Example**:
The currently selected example instance tab. Its tree appears below the tab bar; Test Run and the lower **Conversion Test Run(s)** section in **Target & Previews** always execute against and display results for this tab only.
_Avoid_: Current instance, selected tab

**Example Set**:
A catalogued bundle that loads a Source Schema, one or more Example Instances, a target, optionally a Blockly mapping, and optionally a **Defaults Map**, all by HTTP(S) URI. The catalog JSON is maintained by ehrtslib developers; intEHRgrator ships a dummy first instance under `examples/example-sets.json`. Toolbar: **Example Sets** (▾ lists sets and catalog URLs). A `defaults` URI hydrates the **Defaults block** argument via the same path as picking a saved map.
_Avoid_: Sample pack, demo project (that is a saved Project Bundle)

**Source Path**:
XPath or XQuery expression (fontoxpath) identifying a value in the loaded source. Click-to-map inserts the expression via the active Source Format Handler; typed evaluators (`xpathString`, `xpathNumber`, …) follow the Target value slot type.
_Avoid_: JSON path, get_source dot notation

**Source Format Handler**:
Small adapter interface (`loadSchema`, `loadInstance`, `pathToExpression`, `createContext`, `evaluate`) that isolates JSON / XML / openEHR-as-source quirks from Click-to-Map, Test Run, and codegen. See `docs/SOURCE_FORMATS.md`.
_Avoid_: Format switch, source parser union

**Target instance format**:
Shape of produced instances, adhering to `openehr-template`, `json-schema`, `xml-schema`, or `free-form`. Loaded via **Open target Schema/Template** in **Target & Previews**; drives the **Template Skeleton** (Blockly Target value slots). Separate from Conversion script language — a Handlebars script may emit non-openEHR text while slots still map into a schema target. Persisted as `targetFormat` / Project Bundle `target`.
_Avoid_: Target Format alone, Output format (ambiguous with script language), template-only framing, a separate Target value slot tree pane

**Target instance format handler**:
Adapter seam (`load`, `render`) that turns a target definition into a Template Skeleton / Target value slot tree and renders slot values into the produced instance (Composition JSON, generic JSON, XML document, or free-form passthrough).
_Avoid_: Target Format Handler (old name), Target parser union

**Source iteration (`for_each_source`)**:
Blockly loop that binds each node from a multi-valued Source Path to a named variable. Click-to-Map under a repeating target container stores relative source paths and wraps that container with this block. Preferred way to map over a substructure — not a Source Pane “context root” framing (kintegrate Handlebars pattern). See `docs/future/source-context-root.md`.
_Avoid_: Context boundary, frame as context root (unless discussing kintegrate)

**Map**:
A key-value collection in the Mapping Editor, parallel to a Blockly List. Entries are retrieved by key, not by index. Used for a **Defaults Map** and other 1D lookups. Toolbox: list and map blocks share one **Lists & maps** drawer; **Sheets** is a separate drawer.
_Avoid_: Dictionary, hashmap, JSON object (the object/member stack is a different Blockly metaphor), **Sheet** (2D grid)

**Sheet** (matrix / spreadsheet):
A named 2D grid in the Mapping Editor: optional unique **column headers** (top), optional unique **row names** (left), cells that need not be unique. Chunk 8 embeds a spreadsheet widget for edit/paste and persists a project-owned grid (headers + values), then Blockly accessor/mutator blocks wrap get/set/insert/delete/lookup. Distinct from **Map** and from openEHR `ITEM_TABLE`.
_Avoid_: table (ambiguous with RM `ITEM_TABLE`), Excel (the desktop app), treating a Sheet as a 1D Map

**Defaults block**:
The unique canvas declaration that binds a **Map** argument as the named Map `defaults`. At most one per workspace; present before a **Template Skeleton** exists so the informatician can edit or add keys, then load a target. **Map lookup**s read that binding by name, not by a wire to the argument. Carries the control to pick or **Save as** a **Defaults Map**. Scaffolding a target **joins** the Template Skeleton and lookups to this block rather than replacing it.
_Avoid_: Defaults panel as the source of truth, a second defaults declaration, wiring the Map argument into Target value slots

**Defaults Map**:
A saved or authored **Map** of conversion-time key/value defaults (a Blockly map constructor instance) plugged into the **Defaults block**. Keys align with openEHR simplified-format `ctx` (`language`, `territory`, `composer_name`, `time`, `health_care_facility`, …) plus ENTRY `encoding` and any extra keys the informatician adds. The bundled factory instance seeds `language` from **UI language**, `territory` `SE`, `encoding` `UTF-8` (built-in IANA character-set CODE_PHRASE), empty `time` and `composer_name`, and `health_care_facility` “St. Dummy Demo Hospital”. Canonical store is that Blockly instance. Named snapshots (**Save as**) live in Host storage — different maps for openEHR vs other targets are user-named, not auto-switched. Distinct from **Silent-Mandatory RM Field** and from **model language**.
_Avoid_: Context, CTX, Composition Context, default Blockly field values, model language, treating a FLAT/STRUCTURED `ctx` file as the canonical store

**Map lookup**:
A Blockly value block that retrieves an entry from a named **Map** (including the **Defaults block**'s bound **Defaults Map**) by key. Used in Target value slots. Refers to the Map by name.
_Avoid_: `defaults_get` as a separate block type, connecting a Map constructor into multiple slots

**Mapping Editor**:
The center pane where the user authors mapping logic. Default layout is a vertical split: nested Blockly blocks on top; the bottom slice (adjustable) holds **Mapping Specification**, **Handlebars Template**, and **Sheets** tabs. **Sheets** embeds a spreadsheet widget (Excel/Sheets paste, CSV import/export, optional fullscreen) bound to project-owned Sheet JSON. A minimap appears when the Blockly canvas exceeds the visible area at the current zoom level.
_Avoid_: Target pane, center panel, BlockMirror (that is a third-party sync pattern reference, not our editor library), Target value slots rail / Slots Pane (removed)

**Target & Previews**:
The right pane: **Output mode** in the header, **Generated conversion script(s)** above, **Conversion Test Run(s)** below. Collapsible. Both sections are views of the **Mapping Specification**, not saved artifacts.
_UI labels:_ pane title **Target & Previews**; sections **Generated conversion script(s)** and **Conversion Test Run(s)**.
_Avoid_: Output Previews (old pane title), Right pane (ambiguous — could mean mapping), test pane alone, Slots Pane / slot rail (removed; Target value slots live on the Blockly canvas)

**Output mode**:
The **Target & Previews** header select: **Mapping preview**, or a **Conversion script language** (TypeScript, Java, Handlebars, XQuery). Chooses what those two sections show. Mapping preview is not a script dialect. Session-only — after app start or Project Bundle load the select is Mapping preview; a Conversion script language is chosen only for the current session.
_UI label:_ first option **Mapping preview**.
_Avoid_: Export Target as the name of this control, treating Mapping preview as a Conversion script language, persisting this select in the Project Bundle

**Mapping preview**:
Output mode whose **Conversion Test Run(s)** interpret the Mapping Model against the Active Example (today's Test Run), including **Handlebars Template** rendering for free-form / Kintegrate. **Generated conversion script(s)** shows a prompt to pick a Conversion script language rather than a script. Not itself a Conversion Script.
_Avoid_: Preview (collides with the pane title and with Test Run), dry run, calling this a Conversion script language

**Test Run**:
When Output mode is **Mapping preview**: evaluate Mapping Model slot expressions against the Active Example (including **Map lookup**s against the Map plugged into the **Defaults block**, and **Sheet** accessors against project Sheet JSON), then render through the selected Target instance format handler, or through the **Handlebars Template** when the target is free-form. When Output mode is TypeScript: execute the Generated Export Conversion Script (same text as **Generated conversion script(s)**) against the Active Example. Java, Handlebars, and XQuery Output modes generate a script but do not execute it yet. Displays the produced instance even when **Output validation** fails. Derived after the Mapping Specification is restored — not stored in the Project Bundle.
_UI label:_ section title **Conversion Test Run(s)**; action button **Run Test**.
_Avoid_: Preview, dry run

**Autoplay**:
When enabled, Test Run re-executes automatically (debounced) after mapping edits. Tab switches show cached results only. Toggle disabled when no example instance tabs are open.
_Avoid_: Auto-run, live preview

**Conversion Script**:
Executable TypeScript, Java, or Handlebars produced by a Conversion script language adapter from the Mapping Model (and optional Handlebars Template). Takes a convert-time **Defaults Map** argument for **Map lookup**s and a convert-time **Sheet** bag for **Sheet** accessors; openEHR Composition is one possible Target instance format, not the only one.
_Avoid_: Mapper, transformer (too generic), baking Defaults Map values into the script as the only way to hardcode

**Template Skeleton**:
The Blockly block tree auto-generated by walking the loaded OPT constraint tree plus silent-mandatory RM fields from ehrtslib's `MANDATORY_RM_ATTRIBUTES` (see `ehrtslib` `rm_instance_generator.ts`) — schema-driven, not instance-driven. RM types are BMM-derived within ehrtslib; intEHRgrator does not parse BMM. Scaffolding copies usable OPT/Web Template constraints onto DATA_VALUE Blocks: a unique `C_QUANTITY`/`C_DV_QUANTITY` unit list item becomes `DV_QUANTITY.units`; a local coded value set becomes a Blockly list of complete `DV_CODED_TEXT` objects (rubric + `defining_code`), defaulting to the AOM `assumed_value`; a `C_ORDINAL`/`C_DV_ORDINAL` value set becomes a Blockly list of complete `DV_ORDINAL` / `DV_SCALE` objects (`value` + `symbol`), likewise defaulting to `assumed_value` when present. Non-mandatory RM structures are added via Optional RM Insertion (cogwheel mutator), not pre-rendered. For **JSON Schema** / **XML Schema** targets the same scaffold policy applies via `target_structure` / `target_value` blocks: mandatory schema fields on load, optional fields via `schema_fields_mutator`, plus always-visible generic JSON/XML toolbox drawers for ad-hoc editing.
_Avoid_: Target structure, block template

**Silent-Mandatory RM Field**:
An RM attribute or child object required by the Reference Model but not explicitly constrained in the OPT. Included in the Template Skeleton visibly alongside template-defined content.
_Avoid_: Hidden mandatory, RM default

**Default point**:
A Target value slot that scaffolding fills with a **Map lookup** of a **Defaults Map** key. One key may bind many slots (e.g. `language` → COMPOSITION and ENTRY language; `encoding` → ENTRY encoding). The lookup plugs into the leaf (`code_string`, time string, name), not in place of the `CODE_PHRASE` / `DV_*` / `PARTY_IDENTIFIED` shell; RM `terminology_id` stays a fixed field. Optional RM attributes that are default points (e.g. EVENT_CONTEXT `health_care_facility`) are inserted so the lookup has a slot. v1 identifies points from an openEHR RM attribute table, not from JSON Schema. Hardcoding that slot is replacing the lookup with a literal on the canvas, not a generator bake mode. **COMPOSITION.category** is not a default point: scaffolding attaches the built-in `openehr:composition_category` term pick and auto-selects the template’s constrained code (`433` event, `431` persistent, `451` episodic).
_Avoid_: Silent-Mandatory RM Field (that is why a mandatory slot exists), treating a `ctx/` path as a slot id, replacing the typed shell with a bare Map lookup

**Source query block**:
One of the typed Blockly blocks that hold a **Source Path**: `source_query` (string), `source_query_number`, `source_query_boolean`, or `source_query_node` (JSON/XML subtree). Orange Source category on the canvas and in the toolbox. The node variant outputs a **Source** value — a root or subtree via fontoxpath — used as Handlebars context (or other Map-shaped inputs), not a scalar string/number/boolean.
_Avoid_: generic “source block”, xpath block (the expression helpers are different)

**Code text block**:
Text-category Blockly block (`text_code`) that emits a multiline string. Instead of Blockly’s one-line string field it embeds a resizable CodeMirror editor (default 3 rows × 40 characters) with a language dropdown (Plain, Handlebars, Go Template, JSON, XML, HTML, JavaScript, TypeScript). Used for Handlebars or Go `text/template` snippets nested in XML/text slots, and other literal scripts.
_Avoid_: stock `text` block (single-line), Mapping Editor Handlebars Template tab (workspace-level template)

**Handlebars text block**:
Text-category Blockly block (`text_handlebars`) that takes a Handlebars script (String — typically a **Code text block**) and a context (**Map** or **Source query** node) and emits rendered prose/text.
_Avoid_: Handlebars Template tab, generated Handlebars Conversion Script

**Placeholder source path**:
The unmapped factory **Source Path** on a **Source query block**: empty, or the default field value `/path`. A real mapped path such as `$.systolic` is not a placeholder.
_Avoid_: treating every XML `/path` in source data as unmapped (a real map to `/path` looks like the placeholder)

**Selection**:
One shared selected Blockly block, shown in two places: the matching **Mapping Spec Widget** row is marked selected (and scrolled into view), and the canvas pans to that block with a yellow border. Clicking either the widget or the block selects the same block. Selection does not enter **Listening Mode**, except when the block is a **Source query block** whose path is still a **Placeholder source path**.
_Avoid_: Listening Mode (that is arming for Click-to-Map), Constraint warning (that is the triangle), a second highlight that is not Blockly's selected block

**Listening Mode**:
Transient state waiting for a source tree node click to write a **Source Path**. Entered by clicking an empty Target value slot on the Blockly canvas, or by **Selection** of a **Source query block** that still has a **Placeholder source path**. If that source query is plugged into a Target value slot, the next source click maps that **slot** (same as today’s Click-to-Map). If it is free-floating, only that block’s `EXPRESSION` is filled — no Mapping Model slot until it is plugged in.
_Avoid_: Focus mode, mapping mode, arming on every spec click

**Click-to-Map**:
The primary mapping interaction: enter **Listening Mode** → click a source tree node → the waiting Target value slot (or free-floating **Source query block**) receives a fontoxpath **Source Path**. Typed evaluator follows the slot's `DV_*` type, or the source query's string/number/boolean kind when there is no slot. Drag-and-drop from source tree onto a value slot is supported as a secondary interaction. When the Mapping Editor **Handlebars Template** tab is showing, a source click inserts a Handlebars path (`{{path}}` or nested `#with`/`#each`) instead of a Blockly block — the Tree insert toolbar applies only to that tab, not to Blockly.
_Avoid_: Wildcard mapping (deferred — see `docs/future/wildcard-source-mapping.md`)

**Optional RM Insertion**:
Adding a valid RM structure not present in the loaded OPT (e.g. `feeder_audit`) via the native Blockly **cogwheel mutator** on a container block (same family as `controls_if` elseif/else). The mini-workspace lists optional attributes; adding one expands the parent and auto-attaches a typed child when the mouth is empty. Removing an optional attribute disconnects its child onto the canvas (does not delete it). Template-mandatory and silent-mandatory mouths stay locked. Replaces the former encircled-`+` HTML picker.
_Avoid_: RM insertion hook, extra fields menu, treating the old `+` popup as current UI

**Block Expansion**:
When an optional RM structure is chosen in the cogwheel mutator, the parent container block is automatically modified to expose the corresponding statement input, then the new child block is inserted there if the mouth was empty.
_Avoid_: Dynamic slot, mutating block

**DATA_VALUE Block**:
A typed Blockly shell for an openEHR `DV_*` (e.g. `DV_QUANTITY`) that wraps Mapping Expressions / literals into target RM fields. Structure still comes from the Template Skeleton or Optional RM Insertion — not free-form composition building from the toolbox. v1 covers the full RM leaf set (including `DV_INTERVAL`, `DV_MULTIMEDIA`, `DV_PARSABLE`, etc.). Field layouts are driven at runtime from ehrtslib’s type registry plus attribute metadata (not a hand-maintained DV field table); gaps in ehrtslib introspection are treated as library improvements. Mandatory value slots (RM- or template/archetype-mandatory) auto-attach the matching shell in the Template Skeleton; optional slots stay empty until Click-to-Map / Listening Mode, which then inserts the typed shell around the Mapping Expression. On each shell, only mandatory attributes are shown by default; optional attributes appear via the same cogwheel mutator as Optional RM Insertion. Authoritative sources for RM types and attributes are the openEHR specs and ehrtslib — not `docs/OPENEHR_PRIMER.md` (illustrative only). Implementation of registry-driven shells waits on the ehrtslib RM attribute introspection API (`docs/proposals/ehrtslib-rm-attribute-introspection.md`); no interim hand-maintained meta table in intEHRgrator.
_Avoid_: Value constructor block, DV builder, free-form RM block, “+ fields” image button

**Mapping Expression**:
Editable fragment inside a value slot in the Mapping Specification — XPath via fontoxpath builtins (`xpathNumber`, `xpathString`, …) plus JS-shaped helpers (`trim`, `concat`, `if`). Not TypeScript/Java export code.
_Avoid_: Value mapping, get_source

**Constraint warning**:
A yellow warning triangle on a Blockly block (and the matching **Mapping Spec Widget**) when a contained constraint is unmet — unmapped mandatory value, abstract EVENT, or unmet slot cardinality. It does not light up merely because a node is template/RM-mandatory.
_Avoid_: the former slot-rail red/green borders, treating Mapping Model `validateModel` as a second warning UI

**DATA_VALUE Block**:
A typed Blockly shell for an openEHR `DV_*` (e.g. `DV_QUANTITY`) that wraps Mapping Expressions / literals into target RM fields. Structure still comes from the Template Skeleton or Optional RM Insertion — not free-form composition building from the toolbox. v1 covers the full RM leaf set (including `DV_INTERVAL`, `DV_MULTIMEDIA`, `DV_PARSABLE`, etc.). Field layouts are driven at runtime from ehrtslib’s type registry plus attribute metadata (not a hand-maintained DV field table); gaps in ehrtslib introspection are treated as library improvements. Mandatory value slots (RM- or template/archetype-mandatory) auto-attach the matching shell in the Template Skeleton; optional slots stay empty until Click-to-Map / Listening Mode, which then inserts the typed shell around the Mapping Expression. On each shell, only mandatory attributes are shown by default; optional attributes appear via the cogwheel mutator on that block. Authoritative sources for RM types and attributes are the openEHR specs and ehrtslib — not `docs/OPENEHR_PRIMER.md` (illustrative only). Implementation of registry-driven shells waits on the ehrtslib RM attribute introspection API (`docs/proposals/ehrtslib-rm-attribute-introspection.md`); no interim hand-maintained meta table in intEHRgrator.
_Avoid_: Value constructor block, DV builder, free-form RM block, “+ fields” image button

**Modest Blockly Theme**:
Visual style aligned with the Blockly DevSite landing demo (thrasos renderer, Google Sans, pastel category accents) plus intEHRgrator Source / Data values categories. See `docs/BLOCKLY_INTEGRATION.md` Attribution.
_Avoid_: Default Blockly look, ad-hoc category colours unrelated to the demo palette

**Cross-Cutting RM Structure**:
Optional RM types attachable via Optional RM Insertion (cogwheel mutator / context menu **Optional attributes…**), not free toolbox construction — e.g. feeder audit, links, party proxies, participations — wherever the RM permits on the parent. Nested mandatory children auto-attach; optional children stay lazy. RM attribute facts come from ehrtslib introspection (proposed BMM-generated meta API); which optional attributes are offered in the mutator (OPT context, already-present, product policy) stays in intEHRgrator — not an ehrtslib `validAttachments` helper.
_Avoid_: Primer-only RM list, toolbox free-build of LOCATABLE extras, library-level attachment picker API

**Mapping Specification**:
Canonical interchange is native Blockly workspace JSON (`ProjectBundle.mapping.blocklyState`), shown in the Mapping Editor Blockly JSON tab with **line numbers**. Blockly is used **declaratively**: the canvas is a slot tree plus constructors (including a **Defaults Map**) and lookups — not an imperative program with statement order. Dense recurring constructs are rendered via CodeMirror widgets; structure stays Blockly-owned. See `docs/MAPPING_SPECIFICATION.md` and ADR 0001.
_Avoid_: Private `@template` DSL, Mapping script as a third language, treating the canvas as a sequential script

**Mapping Spec Widget**:
A CodeMirror decoration that collapses a common Blockly JSON construct into a compact, mostly read-only chrome row. v1 covers skeleton containers, value slots, `source_query`, and `DV_*` shells (stock logic/loop widgets later). When the block fills a named RM/DV attribute slot, the attribute name (`language`, `magnitude`, `value`, …) is shown at the start of the row. Only **safe fields** on the widget are editable (e.g. dropdown choices, variable/expression text inputs); rearranging block structure, ids, and coordinates is not done by typing raw JSON. Layout chrome such as `x`/`y` is omitted from the Spec projection by default; an **info** control (encircled *i*) reveals those details in a tooltip-like balloon. Full Blockly JSON including coordinates remains in the Project Bundle for exact restore. A widget whose Blockly block has a **Constraint warning** shows the same yellow warning triangle.
_Avoid_: Free-form JSON editing of the whole workspace, custom DSL, treating the Spec view as the persistence format byte-for-byte

**Mapping Model**:
Derived semantic index (`templateId`, `targetFormat`, `slotId`, `rmType`, `expression`, optional RM insertions). Rebuilt from Blockly JSON on workspace change; used by validation, AI suggestion import, codegen, and Test Run. Does **not** include Conversion script language.
_Avoid_: Mapping schema, parallel IR, structural language

**Generated Export**:
Executable TypeScript, Java, Handlebars, or XQuery produced by Conversion script language adapters from the Mapping Model (+ optional Handlebars Template). Shown in **Generated conversion script(s)** only when Output mode is a Conversion script language — not in the center pane, and not while Mapping preview is selected. Derived from the Mapping Specification after restore; not stored in the Project Bundle. Scripts that contain **Map lookup**s take a convert-time **Defaults Map** argument (see [ADR 0002](docs/adr/0002-convert-time-defaults.md)).
_UI label:_ section title **Generated conversion script(s)**.
_Avoid_: Export code, preview TypeScript

**Sync Scope**:
Blockly workspace JSON (canonical structure) ⇄ Mapping Spec widgets for safe field edits only → Mapping Model slots[] (derived index) → codegen / Test Run. Widget edits patch the corresponding Blockly fields and regenerate the Model; canvas / Click-to-Map / AI structural changes rewrite the Spec view. Canvas undo/redo is the single history: spec widget edits, Click-to-Map, and cogwheel add/remove are Blockly events (grouped per user action). Open template / Example Sets / Load Project / New project restore a document snapshot; Save / Export do not push undo steps. v1 safe edits: Mapping Expression text on `source_query` (and equivalent expression blocks). Structure, Optional RM Insertion, ids, and coordinates are Blockly-only. Raw free-typing of block tree JSON is not the intended authoring path. Center CodeMirror is **not** Generated Export.
_Avoid_: Full handwritten Blockly JSON as primary editor, custom DSL as middle language

**Web Shell**:
Local-first web app (GitHub Pages) using browser file picker and IndexedDB behind `WebHostAdapter`. No in-app AI API in v1 — AI assist is copy-paste.
_Avoid_: GH Pages app, browser version

**Desktop app**:
The same workbench, packaged with `deno desktop` as a native window (OS webview) that serves the built `dist/` on `127.0.0.1`. File pickers and IndexedDB still go through `WebHostAdapter`. Rebuild with `deno task compile:desktop`.
_Avoid_: Electron, ehrtslib CLI release, treating the desktop binary as a different mapping engine

**VS Code / Cursor Host**:
Second Host adapter (`VsCodeWebviewHostAdapter` + `extension/`) packaging the same Mapping Editor webview bundle; workspace FS and extension storage replace IndexedDB/file picker.
_Avoid_: Separate fork of the workbench

**AI Assist (copy-paste)**:
v1 workflow: **Copy AI Prompt** generates a markdown prompt (target/source origins as file or URI; delivery mode: inline multipart, chat attach, or URI browse; slot manifest; link to response format spec); user pastes into an external AI chat; **Import Suggestions** parses the structured response and applies mappings. No API calls from the web app.
_Avoid_: AI Suggest button (implies in-app API), AI integration

**Mapping Suggestion Import**:
Applying parsed suggestions from an external AI response in `intehrgrator-suggestions` JSON version 2 (slot-keyed Blockly block subset). See `docs/AI_SUGGESTION_FORMAT.md`.
_Avoid_: AI paste, bulk map

**Host Abstraction**:
Shared interface (`pickTextFile` / bytes, storage, clipboard, download, `resolveAppUrl`) so core mapping logic is host-agnostic. Adapters: Web (IndexedDB) and VS Code/Cursor webview. No DOM `File` types cross the seam.
_Avoid_: Environment abstraction layer, platform bindings

**Workbench Test API**:
Programmatic seam exposed as `window.intehrgratorTestApi` when the Web Shell is opened with `?testMode=1`. Loads Template Skeleton / Source Schema / Example Instance fixtures without file pickers; reports Mapping Model, Blockly block summary, and Test Run results. UI tests still click Target value slots, Example Instance tree rows, and **Run Test** so Click-to-Map is exercised through the real DOM. See `docs/UI_TESTING.md`.
_Avoid_: formTestApi (kintegrate name), Cypress-only harness

**Workbench Agent API**:
Headless localhost HTTP surface on the **desktop app** (`/api/v1/*`), backed by **`WorkbenchService`** (Blockly JSON / Mapping Model / Project Bundle — no DOM). IDE agents and the stdio **MCP** server call import, map-slot, build-prompt, run-test, undo/redo, and bundle load/export. Mutations return a **session revision** token (`If-Match` / 409 on conflict). The open UI polls `/api/v1/snapshot` and reloads the bundle when revision changes. Disabled with `INTEHR_AGENT_API=0`. See `docs/AGENT_WORKFLOW.md`.
_Avoid_: conflating with Workbench Test API, treating the GitHub Pages web shell as the Agent API host

**Session revision**:
FNV-style hash of Mapping Model + Blockly workspace JSON (+ Handlebars template) returned as `revision` / `r<hex>` on Agent API reads and after each mutation. Agents pass **`If-Match: <revision>`** (or MCP `revision`) for optimistic concurrency; **`undo` / `redo`** walk a joint **attributed semantic history** (user + registered agents). Blockly canvas undo remains for direct block edits; service history merges UI semantic commits via `/ui-commit`. Open **observer** for timeline scrub, destructive rollback, and patch-undo prompts.
_Avoid_: wall-clock timestamps, assuming revision survives a full browser reload without re-fetching snapshot

**Agent actor**:
Registered MCP session identity `{ agentId, displayName, color }` returned from **`register_agent`**. Mutations carry **`X-Agent-Id` / `X-Agent-Name`** headers; history entries record actor + summary. Desktop assigns colour from id hash when omitted.
_Avoid_: anonymous agent rows when registration is available

**Agent observer**:
**Open observer** extends the Open canvas popup: live Blockly snapshot, per-agent legend, and **history timeline** (scrub preview, destructive rollback with optional **discarded-branch** `.intehrgrator` download, copy patch-undo prompt). Main canvas shows subtle pulse on agent-touched slots; **Follow agent** (opt-in) pans the main workspace.
_Avoid_: auto-scrolling the main canvas by default while a human is editing elsewhere

**Conversion script language** (older docs said Export dialect / Export Target; code key `exportTarget` was a persisted setting — no longer saved):
An **Output mode** value that generates a Conversion Script (`typescript` | `java` | `handlebars` | `xquery`). Downstream of the Mapping Model — Blockly blocks and mappings are language-agnostic. Distinct from Target instance format and from Mapping preview. Not stored in the Project Bundle.
_Avoid_: Export dialect, Export Target (prefer this term), Target language alone, conflating with Target instance format or Mapping preview

**UI language**:
The application locale for Blockly messages (toolbar setting; later full chrome i18n). ISO 639-1 codes (`en`, `sv`, `de`, `es`, `ca`, `fr`). Distinct from **model language** (ontology labels in **Target & Previews**) and from composition `language` in a **Defaults Map** — a factory Defaults Map may copy UI language into that key once, when the factory instance is created, and does not rewrite it if the toolbar locale later changes.
_Avoid_: Model language, conflating with Defaults Map `language`

**Handlebars Template**:
User-authored Kintegrate-compatible conversion template stored in `ProjectBundle.mapping.handlebarsTemplate`. **Mapping preview** Test Run renders it for free-form / Kintegrate targets. Distinct from a generated Handlebars Conversion Script (Output mode Handlebars), which is not executed in Conversion Test Run(s) yet.
_Avoid_: Mapping Specification (that term means Blockly JSON), treating Handlebars as a Target instance format

**Output validation**:
ehrtslib `TemplateValidator` check of a Conversion Test Run instance against the loaded operational template (RM specification plus template constraints), when Target instance format is `openehr-template`. ✅ on the Conversion Test Run tab if valid; ⚠ with a formatted error list if not. Distinct from Source Pane example-tab ⚠ (instance vs Source Schema). Invalid output still appears in the editor.
_Avoid_: copying Source Schema mismatch onto Conversion Test Run tabs, RM-only validation when an OPT is loaded

**Better Form Bridge**:
Optional seam for Push/Pull against a licensed Better Form Renderer viewer (assets from Kintegrate via `deno task setup:better-forms`, never committed). See `docs/KINTEGRATE_MIGRATION.md`.
_Avoid_: formTestApi (kintegrate name for the form viewer API)

**Project Bundle**:
Self-contained saved workspace containing target definition (format-neutral `target` plus legacy `template` for openEHR), source/example content, Blockly workspace, Mapping Model, optional Handlebars Template, settings, and metadata. Persisted via the Host and exportable as a single `.intehrgrator` file. Does **not** include Generated Export or Test Run output — those are regenerated from the Mapping Specification after the bundle is loaded.
_Avoid_: Mapping file, saved state

## Example dialogue

> **Informatician:** I loaded the vitals template and my HL7 JSON export. Where do I wire systolic pressure?
>
> **Developer:** Click the value slot on `systolic` in the Mapping Editor, then click `vitals[0].systolic` in the **active example tab** tree. Blockly JSON below is the canonical Mapping Specification; **Mapping preview** Test Run reads the Mapping Model. Pick a Conversion script language in Output mode when you want Generated Export.
>
> **Informatician:** Can I test it without exporting?
>
> **Developer:** Yes — stay on **Mapping preview** and click **Run Test**. **Conversion Test Run(s)** evaluates your Mapping Model against the loaded example and renders through the Target instance format (Composition JSON for an OPT target). A Conversion Script is only needed when you want the mapping in your own pipeline.
>
> **Informatician:** The template doesn't include feeder audit but I need provenance. How do I add it?
>
> **Developer:** Click the cogwheel on the observation block, add `feeder_audit` in the mutator mini-workspace — only valid optional attributes show. The block expands with a new slot and the structure appears nested inside. Map its fields the same way as template fields. To drop it again, remove it from the same cogwheel (the child is left on the canvas, not deleted).
>
> **Informatician:** Can AI help me map the boring fields?
>
> **Developer:** Click **Copy AI Prompt** (▾ to choose embed files, chat attach, or URI browse), paste into your AI chat of choice. When you get a response, copy the JSON block and use **Import Suggestions**. Run Test to verify before exporting.
>
> **Informatician:** I want every composition to say St. Dummy Demo Hospital and Swedish, and I want to set that before I load the OPT.
>
> **Developer:** The **Defaults block** is already on the canvas. Edit the plugged-in **Defaults Map** (or **Save as** a named snapshot). `language` on a fresh factory map follows **UI language**; it is not **model language**. Open the template afterward — scaffolding **joins** and fills **Default point**s with **Map lookup**s. Generated Conversion Scripts still take that map as a convert-time argument.
>
> **Informatician:** The old Target slot list is gone. How do I find an unmapped field and wire it?
>
> **Developer:** **Constraint warning** triangles on Blockly and in the Mapping Specification mark unmet slots. Click a spec row to **Select** it — the canvas pans with a yellow border. If that row is a **Source query block** still showing `/path`, **Listening Mode** starts; then click the source tree. Open target now lives in **Target & Previews**.
