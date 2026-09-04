# Mapping preview interprets the Mapping Model; TypeScript executes Generated Export

Test Run used to always evaluate Mapping Model slot expressions (ADR 0001). **Output mode** now splits that:

- **Mapping preview** — evaluates slot expressions and renders through the Target instance format handler. For **free-form** targets (or legacy `exportTarget: "handlebars"`), renders the **Authored Handlebars Template** via `renderHandlebars(template, sourceData, { slots })`.
- **TypeScript** — executes the generated Conversion Script with bundled ehrtslib.
- **Handlebars** (Output mode) — executes the **same Authored Handlebars Template** as Mapping preview (`renderHandlebars` + slot bag). Does **not** execute a generated Handlebars Conversion Script (codegen remains export-only; see grill Q7).
- **Go Template** — executes the **generated** Go `text/template` script via vendored WASM (`{ Parameters: defaults, Data: source }`). See ADR 0004.
- **Java / XQuery** — generate a script; execution not implemented yet.

Output mode is session-only and defaults to Mapping preview after load. Generated Export and Test Run output are not persisted in the Project Bundle.

**Considered:** executing generated Handlebars scripts in Test Run. Deferred — harden the Authored Template path first (Chunk 7.1); Blockly→Handlebars codegen is a later chunk.
