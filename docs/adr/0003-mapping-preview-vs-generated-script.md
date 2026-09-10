# Mapping preview interprets the Mapping Model; TypeScript executes Generated Export

Test Run used to always evaluate Mapping Model slot expressions (ADR 0001). **Output mode** now splits that:

- **Mapping preview** — evaluates slot expressions and renders through the Target instance format handler. For **free-form** targets (or `exportTarget: "handlebars"`), renders the **Authored Handlebars Template** via `renderHandlebars(template, sourceData, { slots })`.
- **TypeScript** — executes the generated Conversion Script with bundled ehrtslib.
- **Handlebars** (Output mode) — executes the **same Authored Handlebars Template** as Mapping preview (`renderHandlebars` + slot bag). Does **not** execute a generated Handlebars Conversion Script (codegen remains export-only; see grill Q7).
- **Go Template** — executes the **generated** Go `text/template` script via vendored WASM (`{ Parameters: defaults, Data: source }`). See ADR 0004.
- **Java / XQuery** — generate a script; execution not implemented yet.

Output mode is session-only and defaults to Mapping preview after load. Generated Export and Test Run output are not persisted in the Project Bundle.

**Considered:** executing generated Handlebars scripts in Test Run. Deferred — harden the Authored Template path first (Chunk 7.1); Blockly→Handlebars codegen is a later chunk.

## Verification oracle (VMS golden tests — issue #38)

On the **Verifiable Mapping Subset (VMS)**, CI treats these paths as cross-check oracles:

| Role | Path | Notes |
|------|------|-------|
| **Primary execution oracle** | Mapping preview (`runTest` + `outputMode: "preview"`) | Evaluates Mapping Model slots + loops, sheets, and Target format render. Default Test Run truth for authors. |
| **Cross-check oracle** | Generated TypeScript (`outputMode: "typescript"`) | Executable today via bundled ehrtslib/fontoxpath. Golden tests require normalized clinical output ≡ preview on VMS fixtures (`test/vms_golden_test.ts`). |
| **Structural postcondition** | ehrtslib `TemplateValidator` | Wired in `validateConvertedOutput()` after preview/TS runs. |
| **Declarative parity (static)** | XQuery Model B slot manifest | `generate(model, "xquery")` must list the same `slots[]` ids and `loops[]` metadata as the Mapping Model IR; in-app `.xq` execution remains future work. |
| **Deferred external oracle** | Archie (Java) | Preferred when a Java toolchain is available for independent openEHR validation; not required for current CI. |

When preview and TypeScript disagree on a VMS mapping, treat it as a **mapping bug** (robustness violation per formal-verification-export.md), not an author workflow choice.

Silent `undefined` in generated TypeScript for VMS-kept block types is forbidden; see `test/vms_golden_test.ts`.
