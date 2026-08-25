## A. small fixes
- [ ] .xml som ok filnamn i diverse file pickers
- [x] Komprimera bredd-åtgång inuti blockly genom att göra text tvåradig: lägg klassnamn och at-kod (at0001 etc.) i liten fontstorlek under själva namnet på noden istället för före respektive efter, fetstila namn. minska whitespace/marginal mellan saker inuti blocket  
- [x] snygga till överlappande block i blockbibliotek
- [x] Get allowed occurences visible on blockly slots
- [x] add a button for loading example sets with, source, target and sometimes mappings
- [x] add a defaults panel for providing things corresponding to Betters/Ehrbases CTX object (language, territory,  etc) Allow load and save of defaults. Add a map block for retreieving one of the defaults and using in a blockly slot.

## B. Robust good UI/UX
- [x] Aktivera Expand/collapse json etc i code mirror
- [ ] Add undo/redo for mapping editor
- [ ] Integrate save functions with github repo (if logged in)
- [ ] Full application UI i18n — toolbar UI language already switches Blockly/stock messages; later translate the rest of the chrome (pane titles, buttons, tips, status) from the same setting. Keep model/ontology language (Target pane) separate.
- [ ] Anpassa för färgblindhet. Gör färger/mönster för in --> konv --> ut och använd konsekvent i syntax highlighting, blockfärg mm
- [ ] Synk highlight mellan mappning och conversion test run (ev conversion script)
- [ ] add https://raspberrypifoundation.github.io/blockly-samples/plugins/toolbox-search/test/index.html

## C. Better support for map and table data structures
- [x] Model blockly support for maps in the style of the blockly list blocks, check for already available implementations based on blockly, - i know such exist. Key/value pairs share a row (Blockly 11 `appendEndRowInput`), so the Defaults Map nested constructor stays compact.
- [x] De-uglify the maps implementation to look more like App Inventor / BlockPy: keys in a column of text fields, values as right-edge connectors that take ordinary Blockly blocks (`text`, `math_number`, source queries, nested maps). Layout follows App Inventor `dictionaries_create_with` (stacked, not inline, `Align.RIGHT`) plus Blockly JSON-object members (`FieldTextInput` + `:` + value socket). Legacy `KEY{n}` input JSON is migrated on load.
- [ ] Make it possible to digest CSV tables (including via UI cut & paste of grids from Excel and Google sheets) for setting up table structures (arbitrariy number of rows and columns). They can later via suitable blockly blocks for picking based on index and/or content be used e.g. to get both label and code for terminology bound texts - that could mean that the resulting map target is a DV_CODED_TEXT. Each row has an optional unique name (string) to the far left and, each column has an optional unique name on top. The rest of the cells do not need to be unique and can have any datatype that blockly supports including nested blocks, but it should be possible to restrict the datatype of a row or column to a certain data output type (boolean / number / string / object)
- [ ] Make it possible to digest FHIR terminology mappings for setting up maps/tables

## target visualisation tree
- [x] figure out if the extra pane for highligting missing mappings is still needed or if warning signs in blockly blocks is enough. Perhaps add warning markers in mapping codemirror pane too. Remove extra pane when no longer needed.

## open EHR reference model classes available as blockly blocks.
- [x] Change the CLUSTER block into the same colour as the ELEMENT block and move ELEMENT up to below CLUSTER 
- [ ] check if any classes are missing
- [x] There are two similarly looking blocks for SECTION, compare, then remove one.
- [ ] improve sorting of blocks in blockly toolbox (put common ones earlier, possibly subdivide/group, fix colour/pattern semantics)
- [ ] The PARTY_IDENTIFIED and possibly related blockly blocks are missing some attributes (when not using party REF)

## Add support for Handlebars conversions
- [ ] add blockly support for handlebars snippets inside new kind of text block based on variables/context/xpath etc
- [x] Conversion script language `handlebars` + Kintegrate helpers (`eq`/`ne`/…/`toUpperCase`)
- [x] Handlebars Template tab; click-to-map inserts Kintegrate paths
- [x] Target instance formats beyond openEHR: JSON Schema, XML Schema, free-form
- [x] Optional Better Form Bridge + `deno task setup:better-forms`
- [ ] Full Better form-viewer ScriptApi / formTestApi parity and Cypress generator port
- [ ] Harden **Mapping preview** Handlebars Template Test Run (helpers, nested `#with`/`#each`, FLAT paths, slot interop) — current path is shaky
- [ ] Execute a generated Handlebars Conversion Script in Conversion Test Run(s) (today: generate only; Mapping preview still runs the authored Handlebars Template)
- [ ] Blockly-owned Handlebars authoring that round-trips with the Handlebars Template tab
- See [KINTEGRATE_MIGRATION.md](KINTEGRATE_MIGRATION.md), [ADR 0001](adr/0001-mapping-and-target-seams.md), and [ADR 0003](adr/0003-mapping-preview-vs-generated-script.md)


## Schema specific dynamic blockly toolboxes
- [ ] test with TakeCare schema - decide if it should be a design time (or via plugin?) or runtime load feature - Does blockly already handle plugins?
- [ ] add special support for TakeCare term id (multiple systems, e.g. both test and prod )

## AI Assistance
- [ ] validate that AI assistance (initial cut & paste variant) works, improve if needed.
- [ ] Add hints in prompt/instruction-file regarding openehr-assistant (possibly with deepwiki link)
- [ ] Clairfy button lable inport AI suggestion

# conversion script generation

## Golden examples
- [ ] check if current typescript converter is correct, remove any bugs
- [ ] compare and improve other formats (Java, xquery, Handlebars etc) 
- [ ] make cloud environments with java/xquery access test such conversion output too

## XQuery conversion script language
- [x] `generate(model, 'xquery')` → Model B slot-manifest `.xq` with DV_* constructors
- [x] Expression builtins → XQuery 3.1 (`xpath*` / `trim` / `concat` / `if` / …)
- [ ] Full COMPOSITION RM XML emit from Template Skeleton (Model A/C)
- [ ] Engine-specific JSON notes + CI golden run against Saxon/BaseX
- See [future/xquery-export-investigation.md](future/xquery-export-investigation.md)

 ## Robustness/correctness hardening
 - [ ] Check versions of source & target (in ehrtslib app) before running conversions. Perhaps use hash-codes to detect changes in dependencies since last load

 # Demo

  enklare template
  har testat lagra
  PPT om flöden verktyg --> konverteringsscript --> pipeline: in / konv / ut
