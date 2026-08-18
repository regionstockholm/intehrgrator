# Mapping Specification

The canonical Mapping Specification is Blockly workspace JSON from
`Blockly.serialization.workspaces.save`. It is persisted in
`ProjectBundle.mapping.blocklyState`.

The Mapping Editor **Mapping Spec** tab shows a dense, line-numbered
**projection** of that JSON: recurring constructs become CodeMirror widgets
(containers, value slots, `DV_*` shells, `source_query`). Layout chrome such as
`x`/`y` is omitted from the view; an ⓘ control reveals those details. Only safe
fields are editable in the Spec (v1: `source_query` expression and return type);
structure changes stay in Blockly.

The former private `@template ...` DSL has been removed. It duplicated Blockly
structure and was not an interchange format used by other tools.

## Two representations, one structural truth

```text
Blockly workspace JSON (canonical structure)
                 │
                 ▼
Mapping Model slots[] (derived semantic index)
                 │
        ┌────────┴────────┐
        ▼                 ▼
 Test Run interpreter   Conversion script language adapter
```

- Blockly JSON owns block structure, fields, inputs, mutation state, ids, and
  workspace coordinates.
- Mapping Model is rebuilt from value-slot blocks after workspace changes. It
  remains the small migration-friendly index used by validation, AI
  suggestions, code generation, and Test Run.
- Project Bundles persist both. On load, Blockly JSON restores the workspace;
  subsequent changes regenerate the Mapping Model.
- Click-to-Map updates the Mapping Model and the corresponding Blockly
  expression block. The next workspace change reasserts Blockly JSON as the
  authority.

## Target instance format versus conversion script language

These are separate settings:

- **Target instance format** describes the shape of produced instances
  (adhering to `openehr-template`, `json-schema`, `xml-schema`, or
  `free-form`).
- **Conversion script language** describes the executable representation
  authored or generated (`typescript`, `java`, `handlebars`, or `xquery`).

This separation allows a Handlebars conversion script to produce clinical
prose, CSV, HTML, JSON, XML, or another non-openEHR format.

## Handlebars Template tab

The adjacent editable **Handlebars Template** tab is an explicit conversion
script language surface, not a replacement Mapping Model. It supports
existing Kintegrate templates and helpers (`eq`, `ne`, `lt`, `gt`, `lte`,
`gte`, `and`, `or`, `toLowerCase`, `toUpperCase`) plus:

- `{{slot "target-slot-id"}}` to access values evaluated by the Mapping Model.
- `{{{json value}}}` to serialize a value without HTML escaping.
- Direct source traversal with standard Handlebars `#with`, `#each`, `@index`,
  bracketed openEHR FLAT/STRUCTURED keys, and whitespace controls.

Source Pane clicks insert a Kintegrate-compatible Handlebars path when the
Handlebars tab is active and no Target value slot is in Listening Mode.

## Versioning

`MappingModel.modelVersion` is currently `2`. Blockly JSON is persisted in its
full native form; UI-only coordinates may be filtered in future review
projections, but are retained in Project Bundles for exact restoration.

Blockly is pinned through `deno.json`. Major Blockly upgrades must include a
Project Bundle migration test.
