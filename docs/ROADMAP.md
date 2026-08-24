## small fixes
- .xml som ok format i diverse file pickers
- snygga till överlappande block i blockbibliotek
- Anpassa för färgblindhet. Gör färger/mönster för in --> konv --> ut och använd konsekvent i syntax highlighting, blockfärg mm


## target visualisation tree
- [ ] figure out if the extra pane for highligting missing mappings is still needed or if warning signs in blockly blocks is enough. Perhaps add warning markers in mapping codemirror pane too. Remove extra pane when no longer needed.

## open EHR reference model classes available as blockly blocks.
- [ ] check if any calsses are mnnissing
- [ ] improve sorting of blocks in blockly toolbox (put common ones eralier, possibly subdivide/group, fix colour/pattern semantics)


## Add support for Handlebars conversions
- [x] Conversion script language `handlebars` + Kintegrate helpers (`eq`/`ne`/…/`toUpperCase`)
- [x] Handlebars Template tab; click-to-map inserts Kintegrate paths
- [x] Target instance formats beyond openEHR: JSON Schema, XML Schema, free-form
- [x] Optional Better Form Bridge + `deno task setup:better-forms`
- [ ] Full Better form-viewer ScriptApi / formTestApi parity and Cypress generator port
- See [KINTEGRATE_MIGRATION.md](KINTEGRATE_MIGRATION.md) and [ADR 0001](adr/0001-mapping-and-target-seams.md)
- [ ] add blockly support for handlebars snippets inside new kind of text block based on variables/context/xpath etc

## Schema specific synamic blockly toolboxes
- [ ] test with TakeCare schema
- [ ] add special support for TakeCare term id (moltiple systems, e.g. both test and prod )

# conversion script generation

## Golden examples
- [ ] check if current typescript converter is correct, remova any bugs
- [ ] compare and improve other formats (Java, xquery, Handlebars etc) 
- [ ] make cloud environments with java/xquery access test such conversion output too


## XQuery conversion script language
- [x] `generate(model, 'xquery')` → Model B slot-manifest `.xq` with DV_* constructors
- [x] Expression builtins → XQuery 3.1 (`xpath*` / `trim` / `concat` / `if` / …)
- [ ] Full COMPOSITION RM XML emit from Template Skeleton (Model A/C)
- [ ] Engine-specific JSON notes + CI golden run against Saxon/BaseX
- See [future/xquery-export-investigation.md](future/xquery-export-investigation.md)

##