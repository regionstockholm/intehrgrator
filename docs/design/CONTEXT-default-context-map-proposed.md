# Proposed `CONTEXT.md` language (default context map)

**Do not apply this file to root `CONTEXT.md` until #158 ships.** Until then the running workbench glossary is still **Defaults Map** / **Defaults block** / **Open target Schema/Template**.

When #158 lands: replace the listed headings in root `CONTEXT.md` with the blocks below (keep surrounding terms). Then delete this file or leave a one-line pointer to git history. Spec: [default-context-map.md](default-context-map.md). ADR: [0011](../adr/0011-default-context-map-runtime-keys.md).

## Example Set

A catalogued bundle that loads a Source Schema, one or more Example Instances, a target, optionally a Blockly mapping, and optionally a **default context map**, all by HTTP(S) URI. intEHRgrator ships the catalog under `examples/example-sets.json`; in-repo asset URIs are relative under `test/fixtures/` (served from the built site). External targets may use absolute GitHub URLs. Toolbar: **Example Sets** (▾ lists sets and catalog URLs). A `defaults` URI hydrates the unique **default context map** block via the same path as picking a saved map.
_Avoid_: Sample pack, demo project (that is a saved Project Bundle)

## Target instance format

Shape of produced instances, adhering to `openehr-template`, `json-schema`, `xml-schema`, or `free-form`. Loaded via **Load target & default context map** in **Target & Previews**; drives the **Template Skeleton** (Blockly Target value slots). Separate from Conversion script language — a Handlebars script may emit non-openEHR text while slots still map into a schema target. Persisted as `targetFormat` / Project Bundle `target`. Distinct from **Instance encoding** (how that instance is serialized).
_Avoid_: Target Format alone, Output format (ambiguous with script language and with Instance encoding), template-only framing, a separate Target value slot tree pane, **Open** as the load action, prefix label `Target:`

## Map

A key-value collection in the Mapping Editor, parallel to a Blockly List. Entries are retrieved by key, not by index. Used for nested values, quantity unpack, and other 1D lookups. Not the **default context map**. Toolbox: list and map blocks share one **Lists & maps** drawer; **Sheets** is a separate drawer.
_Avoid_: Dictionary, hashmap, JSON object (the object/member stack is a different Blockly metaphor), **Sheet** (2D grid), treating the default context map as a plugged `maps_create_with`

## Default context map

The unique canvas declaration that *is* the convert-time defaults table. At most one per workspace. It is not a **Map** argument plugged into a second block. Rows are **default context map entries**. Carries folder / **Save as** / Browse / hardcode. A blank project has no factory rows; the informatician picks a catalogued map (per-family factory or named snapshot) together with the target, or uses **New** after the target schema is in the browser. Scaffolding **joins** **Default point**s to this block. See [ADR 0002](../adr/0002-convert-time-defaults.md) and [ADR 0011](../adr/0011-default-context-map-runtime-keys.md).
_UI label:_ **Default context map**.
_Avoid_: Defaults Map, Defaults block, Default context mapping, Context, CTX, Composition Context, default Blockly field values, model language, treating a FLAT/STRUCTURED `ctx` file as the canonical store, dumping an openEHR factory on a blank canvas

## Default context map entry

One row of the **default context map**: a **runtime key**, one or more **scaffold targets**, and a nested Blockly **value** (same sockets as today’s map `VAL`: **term pick**, `PARTY_IDENTIFIED`, text, …). Duplicate **runtime keys** are a **Constraint warning**.
_Avoid_: a Decision table or Sheet for this wiring, a sidecar table plus a plugged Map, putting RM paths in the convert-time argument

## Runtime key

The simple convert-time identifier on an **entry** (`language`, `territory`, `time`, `facility`, …). `maps_get("defaults", runtimeKey)` and the Conversion Script `defaults` argument use only these keys. Empty is invalid.
_Avoid_: `*.language` as a pipeline key, simplified-format `ctx` path names as the only allowed keys, a second `defaults_get` block type

## Scaffold target

An RM/schema path or wildcard on an **entry**, used only at a scaffold act (joint confirm, explicit **Apply default context map**, or later target refresh). OpenEHR grammar is #157’s: `Class.attribute`, ancestor paths, `*.attribute`. Most-specific match wins. Optional RM insert when a target matches. Never appears in the convert-time argument. Empty list → runtime-only key that lights no slot. JSON Schema / XML Schema path grammars wait until those family catalogs need them.
_Avoid_: convert-time keys, treating per-column `*` don't-care as this wildcard, putting wildcards in `maps_get`

## Map lookup

A Blockly value block that retrieves a value from a named **Map**, or from the **default context map** when `NAME` is `"defaults"`. For defaults, `KEY` is the **runtime key**. Used in Target value slots. Refers to the map by name, not by a wire.
_Avoid_: `defaults_get` as a separate block type, connecting a Map constructor into multiple slots, looking up a scaffold target string at convert time

## Target & Previews

The right pane, tabbed and slide-away: **Target schema** (tree of the loaded target; pull leaf/subtree onto the canvas), **Generated conversion script(s)**, **Conversion Test Run(s)**. Header includes **Output mode** and **Load target & default context map**. Both script and test tabs are views of the **Mapping Specification**, not saved artifacts.
_UI labels:_ pane title **Target & Previews**; tabs **Target schema**, **Generated conversion script(s)**, **Conversion Test Run(s)**; load action **Load target & default context map**.
_Avoid_: Output Previews (old pane title), Right pane (ambiguous — could mean mapping), test pane alone, Slots Pane / slot rail, short **Open**, prefix `Target:`

## Test Run

When Output mode is **Mapping preview**: evaluate Mapping Model slot expressions against the Active Example (including **Map lookup**s against **runtime keys** on the **default context map**, and **Sheet** accessors against project Sheet JSON), then render through the selected Target instance format handler (then serialize each **Instance root** with its **Instance encoding**), or through canvas `handlebars()` when the target is free-form. When Output mode is TypeScript: execute the Generated Export Conversion Script (same text as **Generated conversion script(s)**) against the Active Example. Java Output mode generates an Archie conversion class but does not execute it in the Web Shell (see [JAVA_EXPORT.md](../JAVA_EXPORT.md)). Handlebars Output mode evaluates the canvas **Handlebars text block** (or a legacy `handlebarsTemplate` override) against the Active Example. XQuery Output mode lazy-loads fontoxpath and executes the generated `.xq` against the Active Example (`$source`, `$defaults`, `$sheets`); COMPOSITION emit currently follows **openEHR instance shape**. The conversion product is a payload string (juxtaposed fragments). The editor pretty-prints that payload when the **Product stack** is a single JSON-family root (Canonical JSON, Simplified FLAT, or Simplified STRUCTURED) or a single Canonical XML root; a glued or mixed stack shows as text. Displays the payload even when **Output validation** fails. Derived after the Mapping Specification is restored — not stored in the Project Bundle. Value edits on the **default context map** re-run with Autoplay; new **scaffold targets** wait for a scaffold act.
_UI label:_ section title **Conversion Test Run(s)**; action button **Run Test**.
_Avoid_: Preview, dry run, pretty-printing a MIME/glued stack as if it were one document

## Conversion Script

Executable TypeScript, Java, Handlebars, or XQuery produced by a Conversion script language adapter from the Mapping Model (and canvas **Handlebars text block** when present). Takes a convert-time `defaults` argument keyed by **runtime keys** (not **scaffold targets**) for **Map lookup**s and a convert-time **Sheet** bag for **Sheet** accessors. Walks the **Product stack** under **Conversion start** and returns one payload string (juxtaposed fragments; a single **Instance root** is the one-item case). Splitting that payload onto a queue or into files is the pipeline around the script.
_Avoid_: Mapper, transformer (too generic), baking default context map values into the script as the only way to hardcode, emitting several files from one script, a Kafka/MIME producer inside convert

## Template Skeleton

The Blockly block tree auto-generated by walking the loaded OPT constraint tree plus silent-mandatory RM fields from ehrtslib's `MANDATORY_RM_ATTRIBUTES` (see `ehrtslib` `rm_instance_generator.ts`) — schema-driven, not instance-driven. RM types are BMM-derived within ehrtslib; intEHRgrator does not parse BMM. Scaffolding copies usable OPT/Web Template constraints onto DATA_VALUE Blocks: a unique `C_QUANTITY`/`C_DV_QUANTITY` unit list item becomes `DV_QUANTITY.units`; a local coded value set becomes a Blockly list of complete `DV_CODED_TEXT` objects (rubric + `defining_code`), defaulting to the AOM `assumed_value`; a `C_ORDINAL`/`C_DV_ORDINAL` value set becomes a Blockly list of complete `DV_ORDINAL` / `DV_SCALE` objects (`value` + `symbol`), likewise defaulting to `assumed_value` when present. Non-mandatory RM structures are added via Optional RM Insertion (cogwheel mutator), not pre-rendered. For **JSON Schema** / **XML Schema** targets the same scaffold policy applies via `target_structure` / `target_value` blocks: mandatory schema fields on load, optional fields via `schema_fields_mutator`, plus always-visible generic JSON/XML toolbox drawers for ad-hoc editing. Scaffolding **joins** a **Conversion start** onto the skeleton **Instance root** rather than replacing the **default context map**.
_Avoid_: Target structure, block template

## Default point

A Target value slot that a scaffold act fills with a **Map lookup** of the matching **default context map entry**’s **runtime key**, chosen by matching **scaffold targets** to that slot. One wildcard may bind many slots (`*.language` → COMPOSITION and ENTRY language). `Class.attribute` and ancestor paths select a narrower set; the most specific matching **scaffold target** wins. When the entry **value** is a built-in **term pick** (full `CODE_PHRASE`), the lookup plugs into the RM attribute mouth (`COMPOSITION.language`, `ENTRY.encoding`, …), not into `code_string` on an embedded `CODE_PHRASE` shell. Object-valued party values (`COMPOSITION.composer`, `EVENT_CONTEXT.health_care_facility` as `PARTY_IDENTIFIED`) likewise plug into the RM attribute mouth. Scalar timestamps still plug into the leaf of the typed shell. Party `*.subject` plugs into `PARTY_PROXY.KIND`. RM `terminology_id` stays a fixed field on leftover shells. Optional RM attributes are inserted so the lookup has a slot when an entry has a matching **scaffold target**. **COMPOSITION.category** is not a default point: scaffolding attaches the built-in `openehr:composition_category` term pick and auto-selects the template’s constrained code (`433` event, `431` persistent, `451` episodic). Hardcoding that slot is replacing the lookup with a literal on the canvas (padlock still keys off the **runtime key**), not a generator bake mode. Structure apply is discrete; value edits are live.
_Avoid_: Silent-Mandatory RM Field (that is why a mandatory slot exists), treating a `ctx/` path as a slot id, replacing the typed shell with a bare Map lookup, simplified-format `ctx` aliases as **runtime keys** that also do matching, live re-walk of the skeleton on every entry edit

## Mapping Specification

Canonical interchange is native Blockly workspace JSON (`ProjectBundle.mapping.blocklyState`). The Mapping Spec tab shows a compact projection of that JSON, not the JSON document itself. Blockly is used **declaratively**: the canvas is a slot tree plus constructors (including a **default context map**) and lookups — not an imperative program. **Conversion start** designates the **Product stack**; stack order is juxtaposition of fragments, not “then do this.” Optional **Blockly Function**s are reusable fragments of that tree, not a sequential script. See `docs/MAPPING_SPECIFICATION.md`, ADR 0001, ADR 0006, ADR 0008, ADR 0010, and ADR 0011.
_Avoid_: Private `@template` DSL, Mapping script as a third language, treating the canvas as a sequential script

## Generated Export

Executable TypeScript, Java, Handlebars, or XQuery produced by Conversion script language adapters from the Mapping Model (and canvas **Handlebars text block** when present). Shown in **Generated conversion script(s)** only when Output mode is a Conversion script language — not in the center pane, and not while Mapping preview is selected. Derived from the Mapping Specification after restore; not stored in the Project Bundle. Scripts that contain **Map lookup**s take a convert-time `defaults` argument keyed by **runtime keys** (see [ADR 0002](../adr/0002-convert-time-defaults.md) and [ADR 0011](../adr/0011-default-context-map-runtime-keys.md)).
_UI label:_ section title **Generated conversion script(s)**.
_Avoid_: Export code, preview TypeScript

## UI language

The application locale for Blockly messages (toolbar setting; later full chrome i18n). ISO 639-1 codes (`en`, `sv`, `de`, `es`, `ca`, `fr`). Distinct from **model language** (ontology labels in **Target & Previews**) and from composition language on a **default context map** — a factory openEHR map may copy UI language into **runtime key** `language` (scaffold target `*.language`) once, when the factory instance is created, and does not rewrite it if the toolbar locale later changes.
_Avoid_: Model language, conflating with default context map `language`

## Dialogue replacements

Replace the “St. Dummy Demo Hospital” exchange and the “Open target now lives…” line:

> **Informatician:** I want every composition to say St. Dummy Demo Hospital and Swedish.
>
> **Developer:** **Load target & default context map** and pick the openEHR factory (or a clinic snapshot). Confirm scaffolds **Default point**s with `maps_get("defaults", …)` on **runtime keys**. `language` on a fresh factory follows **UI language**; it is not **model language**. To build a new map, load the target into the **Target schema** tab first, pull PARTY / term pieces onto value sockets, chip the **scaffold targets**, then **Save as**. Generated Conversion Scripts still take `{ language, territory, … }` at convert time — not `*.language`.
>
> **Informatician:** The old Target slot list is gone. How do I find an unmapped field and wire it?
>
> **Developer:** **Constraint warning** triangles on Blockly and in the Mapping Specification mark unmet slots. Click a spec row to **Select** it — the canvas pans with a yellow border. If that row is a **Source query block** still showing `/path`, **Listening Mode** starts; then click the source tree. Load target now lives in **Target & Previews**.
