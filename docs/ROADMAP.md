## A. small fixes
- [x] .xml som ok filnamn i diverse file pickers
- [x] Komprimera bredd-åtgång inuti blockly genom att göra text tvåradig: lägg klassnamn och at-kod (at0001 etc.) i liten fontstorlek under själva namnet på noden istället för före respektive efter, fetstila namn. minska whitespace/marginal mellan saker inuti blocket  
- [x] snygga till överlappande block i blockbibliotek
- [x] Get allowed occurences visible on blockly slots
- [x] add a button for loading example sets with, source, target and sometimes mappings
- [x] add a defaults panel for providing things corresponding to Betters/Ehrbases CTX object (language, territory,  etc) Allow load and save of defaults. Add a map block for retreieving one of the defaults and using in a blockly slot.

## B. Robust good UI/UX
- [x] Change the way optional attributes are manually added to a block. Now we have an encircled plus sign that acts like a button opening a popup where fields can be added. CHange that to the more native blockly syle of block modification (that is used e.g for adding more "else if" and "else" statments to an "if" block) by clicking a cogwheel. THat way non-mandatory attirbutes can also be removed manually.
- [x] Improve the avove cogwheeel configuration approach: 1.  Now in the popup's editor ther is often just a single block with a dropdown thet can be pulled into the "optional fields" or "optional RM" etc. Thet is unpedagogical with low discoverability of options and unneccesary clicks since you first need to expand the dropdown to see what is available. Instead show one block for each option, and if it is only supposed to be one of that option then make sure it can only be added once. 2. having the cogwheel to the left of the openehr zipehr symbol reduces the pedagogical matchup instead put it to the tigt of the dual label Name/datatype
- [x] Activate Expand/collapse json etc i code mirror gutter
- [x] Add undo/redo for mapping editor
- [ ] Add a way to convert a dynamic defaults (or perhaps any table/map) lookup to inlined hardcoded block- perhaps as a right click menu item
- [ ] Integrate save functions with github repo (if logged in)
- [ ] Full application UI i18n — toolbar UI language already switches Blockly/stock messages; later translate the rest of the chrome (pane titles, buttons, tips, status) from the same setting. Keep model/ontology language (Target pane) separate.
- [ ] Anpassa för färgblindhet. Gör färger/mönster för in --> konv --> ut och använd konsekvent i syntax highlighting, blockfärg mm
- [ ] Synk highlight mellan mappning och conversion test run (ev conversion script)
- [ ] **Human multi-user collaboration** (late): live co-editing, CRDT/sync — Chunk 14; architecture prep in [`tasks/ARCHITECTURE-multi-user-collab-prep.md`](../tasks/ARCHITECTURE-multi-user-collab-prep.md)
- [x] add https://raspberrypifoundation.github.io/blockly-samples/plugins/toolbox-search/test/index.html
- [x] add markers in right scroll gutter of mapping spec codemirror so that all locations of errors can be found

## C. Better support for map and table data structures
- [x] Model blockly support for maps in the style of the blockly list blocks, check for already available implementations based on blockly, - i know such exist. Key/value pairs share a row (Blockly 11 `appendEndRowInput`), so the Defaults Map nested constructor stays compact.
- [x] De-uglify the maps implementation to look more like App Inventor / BlockPy: keys in a column of text fields, values as right-edge connectors that take ordinary Blockly blocks (`text`, `math_number`, source queries, nested maps). Layout follows App Inventor `dictionaries_create_with` (stacked, not inline, `Align.RIGHT`) plus Blockly JSON-object members (`FieldTextInput` + `:` + value socket). Legacy `KEY{n}` input JSON is migrated on load.
- [ ] Make it possible to digest CSV tables (including via UI cut & paste of grids from Excel and Google sheets) for setting up table structures (arbitrariy number of rows and columns). They can later via suitable blockly blocks for picking based on index and/or content be used e.g. to get both label and code for terminology bound texts - that could mean that the resulting map target is a DV_CODED_TEXT. Each row has an optional unique name (string) to the far left and, each column has an optional unique name on top. The rest of the cells do not need to be unique and can have any datatype that blockly supports including nested blocks, but it should be possible to restrict the datatype of a row or column to a certain data output type (boolean / number / string / object)
- [ ] Make it possible to digest FHIR terminology mappings for setting up maps/tables


## D. Local (offline) version with AI agent/CLI/IDE integration
- [x] Optimize the local (os native) version intehrgrator to work together with the AI enabled IDE or AI CLI of choise. This can likely be done by primarily working with local files (should be doable when running as executable packaged by deno in our binary releases) -
(Web based Intehrgrator likely still needs to be primarily cut&paste integration.)
- [x] test and describe how the local app can run in parallel with a normal IDE working on same files and how the IDE's AI can help, at least write an installabel skill (ande possibly and MCP, see below)
- [x] make an "installable" AI skill that explains intehrgrator to the AI so that the AI can produce mapping suggestions in correct format
- [x] If the user turns it on and allows running a server, then expose an MCP API to a running instance of the executable (os native) version of intehrgrator. It could work in a way similar to how the Pencil/PEN (https://www.pen.dev/) MCP works. I believe it exposes operations that do work on the internal model of the pen/pencil editor so that the changes become visible as thery are performed by the agents. Same for intehrgrator would be to via MCP/API manipulate the blockly model and have the canvas update meanwhile.
- [ ] It would be good if the MCP (unless intehrgrator runs in a future headless mode) actually scrolls to and highlights the blocks it is editing.
- [x] Preferably the MCP-mediated edits should be atomic and free of race conditions so that several agents could work towards the same model simultaneousley, e.g. one teminology mapping agent and another source system mapping agent. Would exposing the undo/redo log via the MCP make it possible for agents to detect stuff done since they last looked?  Perhaps return a timestamp (or other identifier) for the last action done by the (atomic) MCP call would help the calling agents determine if the model has changed since thay started thinking (and thus may need reevaluation/rethinking depending on what changed). **Chunk 5 ships revision token + undo/redo on the Agent API;** IN the long run, perhaps a CRDT or operational transformation could be considered for multi agent and multi user simultaneous editing - but i hope blocklys built in undo/redo stack is enough to start with.


## E. target visualisation tree
- [x] figure out if the extra pane for highligting missing mappings is still needed or if warning signs in blockly blocks is enough. Perhaps add warning markers in mapping codemirror pane too. Remove extra pane when no longer needed.

## F. open EHR reference model classes available as blockly blocks.
- [x] Change the CLUSTER block into the same colour as the ELEMENT block and move ELEMENT up to below CLUSTER 
- [ ] check if any classes are missing
- [x] There are two similarly looking blocks for SECTION, compare, then remove one.
- [x] improve sorting of blocks in blockly toolbox (put common ones earlier, possibly subdivide/group, fix colour/pattern semantics)
- [x] The PARTY_IDENTIFIED and possibly related blockly blocks are missing some attributes (when not using party REF) — `name`, `identifiers`, and `external_ref` (`party_ref`) are now on PARTY_* blocks; full Demographics compositions remain future work
- [x] The ITEM_STRUCTRURE class is abstract but common in slots, follow the design of the EVENT blockly block that can be morphed to PONT_EVNT and INTERVAL_EVENT without dropping already connected sub blocks. HAeving the flexivility is important e.g. in not neccesarily archetyped FEEDER_AUDIT_DETAILS


## G. Template-language Conversion scripts (Handlebars + Go text/template)

### Handlebars (Kintegrate compatibility)
- [x] add blockly support for handlebars snippets inside new kind of text block based on variables/context/xpath etc
- [x] Conversion script language `handlebars` + Kintegrate helpers (`eq`/`ne`/…/`toUpperCase`)
- [x] Handlebars Template tab; click-to-map inserts Kintegrate paths
- [x] Target instance formats beyond openEHR: JSON Schema, XML Schema, free-form
- [x] Optional Better Form Bridge + `deno task setup:better-forms`
- [ ] Full Better form-viewer ScriptApi / formTestApi parity and Cypress generator port
- [ ] Harden **Mapping preview** Handlebars Template Test Run (helpers, nested `#with`/`#each`, FLAT paths, slot interop) — current path is shaky
- [ ] Execute Authored Handlebars Template in Conversion Test Run(s) (today: generate only; Mapping preview still runs the authored Handlebars Template) — Chunk 7 extends [ADR 0003](adr/0003-mapping-preview-vs-generated-script.md)
- [ ] Blockly→Handlebars codegen (deferred — harden Authored Template path first)
- [ ] Reverse-engineered Handlebars Blockly example set + non-Blockly test harness support for Handlebars example files and expected output (future, after Go template example set)
- See [KINTEGRATE_MIGRATION.md](KINTEGRATE_MIGRATION.md), [ADR 0001](adr/0001-mapping-and-target-seams.md), and [ADR 0003](adr/0003-mapping-preview-vs-generated-script.md)
- make the recently added JSON/XML subtree "source" blockly block also trigger/arm click to map so that source tree can be pointed at

### Go text/template (Chunk 7 — FLAT→legacy narrative codegen)
- [ ] Conversion script language `go-template` — **codegen-only** (no Authored Template tab; Blockly mapping is the source of truth)
- [ ] Go template codegen adapter: Mapping Model + Blockly → Go `text/template` syntax with curated Sprig-subset FuncMap (`replace`/`regexReplaceAll`/`trim`/`quote`/`lower`/`substr`/`int`/`ge`)
- [ ] In-browser WASM runtime for Go `text/template` execution in Conversion Test Run (Web Shell + desktop)
- [ ] Execute envelope `{ Parameters: defaults, Data: source }` — Defaults Map provides the Parameters bag
- [ ] Example Set: `examples/patient-reported-chemotherapy-symptoms/` — reverse-engineered Blockly mapping using `xml_element`/`xml_text` blocks for ProfdocHISMessage XML + reference hand-authored PROD Go template script
- [ ] FLAT as source is less than ideal (STRUCTURED would be one notch up) but must be supported for existing pipeline use cases; ehrtslib can convert other openEHR formats to FLAT
- See [ADR 0004](adr/0004-go-template-codegen-only.md) (pending adoption)


## H. Schema specific dynamic blockly toolboxes
- [ ] It should be possible to load any valid XML or JSON schema in a way similarly to how an openEHR template can be loaded and scaffolded as target, and have intehrgrator dynamically add a new drawer filled with blockly blocks representing that schema with blocks named after the schema's types and with mandatory attribute slots visible and a possibility for end user to add the non-mandatory slots. 
- [ ] **Always-visible generic JSON/XML drawers** remain for free-form structure authoring (Chunk 6 adopted grill).
- [ ] test with TakeCare schema - decide if it should be a design time (or via plugin?) or runtime load feature - Does blockly already handle plugins?
- [ ] add special support for TakeCare term id (multiple systems, e.g. both test and prod ) — **deferred** (late roadmap; not Chunk 6)

## I. Initial AI Assistance
- [x] validate that AI assistance (initial cut & paste variant) works, improve if needed.
- [x] Add hints in prompt/instruction-file regarding openehr-assistant (possibly with deepwiki link)
- [x] Clarify button label Import AI suggestions


# conversion script generation

## J. Golden examples
- [ ] check if current typescript converter is correct, remove any bugs
- [ ] compare and improve other formats (Java, xquery, Handlebars etc) 
- [ ] make cloud environments with java/xquery access test such conversion output too

## K. XQuery conversion script language
- [x] `generate(model, 'xquery')` → Model B slot-manifest `.xq` with DV_* constructors
- [x] Expression builtins → XQuery 3.1 (`xpath*` / `trim` / `concat` / `if` / …)
- [ ] Full COMPOSITION RM XML emit from Template Skeleton (Model A/C)
- [ ] Engine-specific JSON notes + CI golden run against Saxon/BaseX
- See [future/xquery-export-investigation.md](future/xquery-export-investigation.md)

 ## L. Robustness/correctness hardening
 - [ ] Check versions of source & target (in ehrtslib app) before running conversions. Perhaps use hash-codes to detect changes in dependencies since last load
