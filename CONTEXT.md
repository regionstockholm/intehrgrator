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
The currently selected example instance tab. Its tree appears below the tab bar; Test Run and the lower **Conversion Test Run(s)** section in **Output Previews** always execute against and display results for this tab only.
_Avoid_: Current instance, selected tab

**Source Path**:
XPath or XQuery expression (fontoxpath) identifying a value in the loaded source. Click-to-map inserts the expression via the active Source Format Handler; typed evaluators (`xpathString`, `xpathNumber`, …) follow the Target value slot type.
_Avoid_: JSON path, get_source dot notation

**Source Format Handler**:
Small adapter interface (`loadSchema`, `loadInstance`, `pathToExpression`, `createContext`, `evaluate`) that isolates JSON / XML / openEHR-as-source quirks from Click-to-Map, Test Run, and codegen. See `docs/SOURCE_FORMATS.md`.
_Avoid_: Format switch, source parser union

**Target instance format**:
Shape of produced instances, adhering to `openehr-template`, `json-schema`, `xml-schema`, or `free-form`. Loaded via **Open target Schema/Template**; drives the Target value slot tree. Separate from Conversion script language — a Handlebars script may emit non-openEHR text while slots still map into a schema target. Persisted as `targetFormat` / Project Bundle `target`.
_Avoid_: Target Format alone, Output format (ambiguous with script language), template-only framing

**Target instance format handler**:
Adapter seam (`load`, `render`) that turns a target definition into a Template Skeleton / Target value slot tree and renders slot values into the produced instance (Composition JSON, generic JSON, XML document, or free-form passthrough).
_Avoid_: Target Format Handler (old name), Target parser union

**Source iteration (`for_each_source`)**:
Blockly loop that binds each node from a multi-valued Source Path to a named variable. Preferred way to map over a substructure — not a Source Pane “context root” framing (kintegrate Handlebars pattern). See `docs/future/source-context-root.md`.
_Avoid_: Context boundary, frame as context root (unless discussing kintegrate)

**Mapping Editor**:
The center pane where the user authors mapping logic. Default layout is a vertical split: nested Blockly blocks on top (with **Target value slots** rail), [CodeMirror](https://codemirror.net/) on the bottom showing the **Mapping Specification** (Blockly JSON with line numbers and Mapping Spec Widgets for density / safe field edits) and an editable **Handlebars Template** tab when Conversion script language is Handlebars. A minimap appears when the Blockly canvas exceeds the visible area at the current zoom level.
_Avoid_: Target pane, center panel, BlockMirror (that is a third-party sync pattern reference, not our editor library)

**Output Previews**:
The right pane showing generated conversion-script code (upper) and live conversion test-run results (lower). Collapsible. v1 runs TypeScript mappings in-browser against example source data.
_UI labels:_ pane title **Output Previews**; sections **Generated conversion script(s)** and **Conversion Test Run(s)**.
_Avoid_: Right pane (ambiguous — could mean mapping), test pane alone

**Test Run**:
Evaluating Mapping Model slot expressions against the Active Example, then rendering through the selected Target instance format handler (or Handlebars conversion script for free-form / Kintegrate scripts). Displays the produced instance (Composition JSON, generic JSON, XML, or text). Required in v1.
_UI label:_ section title **Conversion Test Run(s)**; action button **Run Test**.
_Avoid_: Preview, dry run

**Autoplay**:
When enabled, Test Run re-executes automatically (debounced) after mapping edits. Tab switches show cached results only. Toggle disabled when no example instance tabs are open.
_Avoid_: Auto-run, live preview

**Conversion Script**:
Executable TypeScript, Java, or Handlebars produced by a Conversion script language adapter from the Mapping Model (and optional Handlebars Template). openEHR Composition is one possible Target instance format, not the only one.
_Avoid_: Mapper, transformer (too generic)

**Template Skeleton**:
The Blockly block tree auto-generated by walking the loaded OPT constraint tree plus silent-mandatory RM fields from ehrtslib's `MANDATORY_RM_ATTRIBUTES` (see `ehrtslib` `rm_instance_generator.ts`) — schema-driven, not instance-driven. RM types are BMM-derived within ehrtslib; intEHRgrator does not parse BMM. Non-mandatory RM structures are added via Optional RM Insertion (`+` picker), not pre-rendered.
_Avoid_: Target structure, block template

**Silent-Mandatory RM Field**:
An RM attribute or child object required by the Reference Model but not explicitly constrained in the OPT. Included in the Template Skeleton visibly alongside template-defined content.
_Avoid_: Hidden mandatory, RM default

**Listening Mode**:
Transient state of a Blockly value slot after the user clicks it, waiting for a source tree node click to insert a `source_query` block.
_Avoid_: Focus mode, mapping mode

**Click-to-Map**:
The primary mapping interaction: click an empty value slot (enters Listening Mode) → click a source tree node → a `source_query` block (fontoxpath XPath) is inserted with typed evaluator from the slot's `DV_*` type. Drag-and-drop from source tree onto a value slot is supported as a secondary interaction.
_Avoid_: Wildcard mapping (deferred — see `docs/future/wildcard-source-mapping.md`)

**Optional RM Insertion**:
Adding a valid RM structure not present in the loaded OPT (e.g. `feeder_audit`) via a `+` button on a container block, which opens a filtered picker of RM-permitted types for that attachment point.
_Avoid_: RM insertion hook, extra fields menu

**Block Expansion**:
When an optional RM structure is chosen from the picker, the parent container block is automatically modified to expose the corresponding statement input, then the new child block is inserted there.
_Avoid_: Dynamic slot, mutating block

**Mapping Expression**:
Editable fragment inside a value slot in the Mapping Specification — XPath via fontoxpath builtins (`xpathNumber`, `xpathString`, …) plus JS-shaped helpers (`trim`, `concat`, `if`). Not TypeScript/Java export code.
_Avoid_: Value mapping, get_source

**DATA_VALUE Block**:
A typed Blockly shell for an openEHR `DV_*` (e.g. `DV_QUANTITY`) that wraps Mapping Expressions / literals into target RM fields. Structure still comes from the Template Skeleton or Optional RM Insertion — not free-form composition building from the toolbox. v1 covers the full RM leaf set (including `DV_INTERVAL`, `DV_MULTIMEDIA`, `DV_PARSABLE`, etc.). Field layouts are driven at runtime from ehrtslib’s type registry plus attribute metadata (not a hand-maintained DV field table); gaps in ehrtslib introspection are treated as library improvements. Mandatory value slots (RM- or template/archetype-mandatory) auto-attach the matching shell in the Template Skeleton; optional slots stay empty until Click-to-Map / Listening Mode, which then inserts the typed shell around the Mapping Expression. On each shell, only mandatory attributes are shown by default; optional attributes appear via progressive disclosure (“+ fields”) on that block. Authoritative sources for RM types and attributes are the openEHR specs and ehrtslib — not `docs/OPENEHR_PRIMER.md` (illustrative only). Implementation of registry-driven shells waits on the ehrtslib RM attribute introspection API (`docs/proposals/ehrtslib-rm-attribute-introspection.md`); no interim hand-maintained meta table in intEHRgrator.
_Avoid_: Value constructor block, DV builder, free-form RM block

**Modest Blockly Theme**:
Visual style aligned with the Blockly DevSite landing demo (thrasos renderer, Google Sans, pastel category accents) plus intEHRgrator Source / Data values categories. See `docs/BLOCKLY_INTEGRATION.md` Attribution.
_Avoid_: Default Blockly look, ad-hoc category colours unrelated to the demo palette

**Cross-Cutting RM Structure**:
Optional RM types attachable via Optional RM Insertion (`+` / context menu), not free toolbox construction — e.g. feeder audit, links, party proxies, participations — wherever the RM permits on the parent. Nested mandatory children auto-attach; optional children stay lazy. RM attribute facts come from ehrtslib introspection (proposed BMM-generated meta API); which optional attributes are offered in the picker (OPT context, already-present, product policy) stays in intEHRgrator — not an ehrtslib `validAttachments` helper.
_Avoid_: Primer-only RM list, toolbox free-build of LOCATABLE extras, library-level attachment picker API

**Mapping Specification**:
Canonical interchange is native Blockly workspace JSON (`ProjectBundle.mapping.blocklyState`), shown in the Mapping Editor Blockly JSON tab with **line numbers**. Dense recurring constructs are rendered via CodeMirror widgets; structure stays Blockly-owned. See `docs/MAPPING_SPECIFICATION.md` and ADR 0001.
_Avoid_: Private `@template` DSL, Mapping script as a third language

**Mapping Spec Widget**:
A CodeMirror decoration that collapses a common Blockly JSON construct into a compact, mostly read-only chrome row. v1 covers skeleton containers, value slots, `source_query`, and `DV_*` shells (stock logic/loop widgets later). Only **safe fields** on the widget are editable (e.g. dropdown choices, variable/expression text inputs); rearranging block structure, ids, and coordinates is not done by typing raw JSON. Layout chrome such as `x`/`y` is omitted from the Spec projection by default; an **info** control (encircled *i*) reveals those details in a tooltip-like balloon. Full Blockly JSON including coordinates remains in the Project Bundle for exact restore.
_Avoid_: Free-form JSON editing of the whole workspace, custom DSL, treating the Spec view as the persistence format byte-for-byte

**Mapping Model**:
Derived semantic index (`templateId`, `targetFormat`, `slotId`, `rmType`, `expression`, optional RM insertions). Rebuilt from Blockly JSON on workspace change; used by validation, AI suggestion import, codegen, and Test Run. Does **not** include Conversion script language.
_Avoid_: Mapping schema, parallel IR, structural language

**Generated Export**:
Executable TypeScript, Java, or Handlebars produced by Conversion script language adapters from the Mapping Model (+ optional Handlebars Template). Shown in the **right pane upper** CodeMirror only — not in the center pane.
_UI label:_ section title **Generated conversion script(s)**.
_Avoid_: Export code, preview TypeScript

**Sync Scope**:
Blockly workspace JSON (canonical structure) ⇄ Mapping Spec widgets for safe field edits only → Mapping Model slots[] (derived index) → codegen / Test Run. Widget edits patch the corresponding Blockly fields and regenerate the Model; canvas / Click-to-Map / AI structural changes rewrite the Spec view. v1 safe edits: Mapping Expression text on `source_query` (and equivalent expression blocks). Structure, Optional RM Insertion, ids, and coordinates are Blockly-only. Raw free-typing of block tree JSON is not the intended authoring path. Center CodeMirror is **not** Generated Export.
_Avoid_: Full handwritten Blockly JSON as primary editor, custom DSL as middle language

**Web Shell**:
Local-first web app (GitHub Pages) using browser file picker and IndexedDB behind `WebHostAdapter`. No in-app AI API in v1 — AI assist is copy-paste.
_Avoid_: GH Pages app, browser version

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

**Conversion script language** (settings key `exportTarget`; older docs said Export dialect / Export Target):
Workspace setting choosing which script language is generated or authored for Output Previews and Export (`typescript` | `java` | `handlebars` | `xquery`). Downstream of the Mapping Model — Blockly blocks and mappings are language-agnostic. Distinct from Target instance format.
_Avoid_: Export dialect, Export Target (prefer this term), Target language alone, conflating with Target instance format

**Handlebars Template**:
User-authored Kintegrate-compatible conversion template stored in `ProjectBundle.mapping.handlebarsTemplate`. Used when Conversion script language is `handlebars`; may walk the source tree directly and/or read Mapping Model slot values via `{{slot "…"}}`.
_Avoid_: Mapping Specification (that term means Blockly JSON)

**Better Form Bridge**:
Optional seam for Push/Pull against a licensed Better Form Renderer viewer (assets from Kintegrate via `deno task setup:better-forms`, never committed). See `docs/KINTEGRATE_MIGRATION.md`.
_Avoid_: formTestApi (kintegrate name for the form viewer API)

**Project Bundle**:
Self-contained saved workspace containing target definition (format-neutral `target` plus legacy `template` for openEHR), source/example content, Blockly workspace, Mapping Model, optional Handlebars Template, settings, and metadata. Persisted via the Host and exportable as a single `.intehrgrator` file.
_Avoid_: Mapping file, saved state

## Example dialogue

> **Informatician:** I loaded the vitals template and my HL7 JSON export. Where do I wire systolic pressure?
>
> **Developer:** Click the value slot on `systolic` in the Mapping Editor, then click `vitals[0].systolic` in the **active example tab** tree. Blockly JSON below is the canonical Mapping Specification; the Mapping Model slot index drives Test Run. Generated Export on the right shows the selected Conversion script language.
>
> **Informatician:** Can I test it without exporting?
>
> **Developer:** Yes — click **Run Test**. The lower **Conversion Test Run(s)** section evaluates your Mapping Model against the loaded example and renders through the Target instance format (Composition JSON for an OPT target). Export is only needed when you want the script in your own pipeline.
>
> **Informatician:** The template doesn't include feeder audit but I need provenance. How do I add it?
>
> **Developer:** Click `+` on the observation block, pick `feeder_audit` from the list — only valid options show. The block expands with a new slot and the structure appears nested inside. Map its fields the same way as template fields.
>
> **Informatician:** Can AI help me map the boring fields?
>
> **Developer:** Click **Copy AI Prompt** (▾ to choose embed files, chat attach, or URI browse), paste into your AI chat of choice. When you get a response, copy the JSON block and use **Import Suggestions**. Run Test to verify before exporting.
