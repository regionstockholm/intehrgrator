## small fixes
- .xml som ok format i diverse file pickers
- snygga till överlappande block i blockbibliotec
- Logik till blått
- Gör färger/mönster för in --> konv --> ut och använd konsekvent i syntax highlighting, blockfärg mm

## Testing full passthrough


## target visualisation tree
Node list as reverse tree


## Make open EHR reference model classes available as blockly blocks.

Start with the reference model classes.

## Add support for Handlebars conversions
- [x] Conversion script language `handlebars` + Kintegrate helpers (`eq`/`ne`/…/`toUpperCase`)
- [x] Handlebars Template tab; click-to-map inserts Kintegrate paths
- [x] Target instance formats beyond openEHR: JSON Schema, XML Schema, free-form
- [x] Optional Better Form Bridge + `deno task setup:better-forms`
- [ ] Full Better form-viewer ScriptApi / formTestApi parity and Cypress generator port
- See [KINTEGRATE_MIGRATION.md](KINTEGRATE_MIGRATION.md) and [ADR 0001](adr/0001-mapping-and-target-seams.md)

## XQuery conversion script language
- [x] `generate(model, 'xquery')` → Model B slot-manifest `.xq` with DV_* constructors
- [x] Expression builtins → XQuery 3.1 (`xpath*` / `trim` / `concat` / `if` / …)
- [ ] Full COMPOSITION RM XML emit from Template Skeleton (Model A/C)
- [ ] Engine-specific JSON notes + CI golden run against Saxon/BaseX
- See [future/xquery-export-investigation.md](future/xquery-export-investigation.md)
