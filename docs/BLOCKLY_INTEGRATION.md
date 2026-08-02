# Blockly Integration Design for openEHR

This document describes how [Google Blockly](https://developers.google.com/blockly) blocks map to openEHR structures, and the code generation strategy for TypeScript and Java targets.

## Blockly Overview

Blockly is a library for building visual block-based programming editors. Key concepts:
- **Blocks** — visual puzzle pieces representing code constructs
- **Inputs** — connection points on a block (value inputs, statement inputs)
- **Fields** — inline editable elements (text, dropdowns, checkboxes)
- **Generators** — convert visual blocks to target-language code
- **Toolbox** — categorized palette of available blocks

See: [Blockly Developer Guides](https://developers.google.com/blockly/guides/overview)

## Block Categories for openEHR

### 1. RM Structure Blocks (Container blocks)
These represent the RM containment hierarchy:

| Block | Inputs | Description |
|-------|--------|-------------|
| `composition` | `content` (statement), `context` (statement) | Root container |
| `section` | `items` (statement) | Organizer, recursive |
| `observation` | `data`, `state`, `protocol` (statements) | Measured data entry |
| `evaluation` | `data`, `protocol` (statements) | Assessment entry |
| `instruction` | `activities` (statement) | Order entry |
| `action` | `description` (statement) | Action performed |
| `item_tree` | `items` (statement) | Tree-structured data |
| `cluster` | `items` (statement) | Group of items, recursive |
| `element` | `value` (value input) | Leaf data node |

### 2. DATA_VALUE Blocks (Value shells)

Typed shells for every concrete `DATA_VALUE` leaf from ehrtslib
`subtypesOf("DATA_VALUE")` (`enhanced/meta`). Field layouts come from
`attributesFor(rmType)`: mandatory attributes shown inline; optional attributes
via progressive disclosure (`+ fields` on the shell).

| Role | Behavior |
|------|----------|
| Template Skeleton | Mandatory value slots auto-attach the matching shell |
| Optional / unmapped | Empty until Click-to-Map, then lazy-insert shell around the expression |
| Toolbox | **Data values** category for type replacement |
| ELEMENT.value check | Accepts the concrete `DV_*` shell (not raw String/Number) |

Authoritative RM facts: ehrtslib `docs/RM_ATTRIBUTES.md`. Attachment picker policy
(`getValidAttachments`) stays in intEHRgrator over `attributesFor`.

### 3. Cross-Reference / Optional RM Blocks
| Block | Inputs | Description |
|-------|--------|-------------|
| `feeder_audit` | via `+` picker / statement expansion | Provenance trail |
| `participation` | via `+` picker | Additional participant |
| `party_identified` | via `+` picker | Actor identity |
| `link` | via `+` picker | Cross-reference |

Optional RM Insertion uses ehrtslib attribute meta filtered by OPT/present context
(`src/core/rm_meta.ts` → `getValidAttachments`).

### 4. Control Flow & Utility Blocks

Toolbox layout and stock categories follow the Blockly DevSite landing demo
(Logic, Loops, Math, Text, Lists, Variables, Functions) plus intEHRgrator
categories **Source** and **Data values**. See [Attribution](#attribution).

- **Stock Blockly:** `controls_if`, `controls_whileUntil`, `controls_repeat_ext`,
  `math_arithmetic`, `text_join`, `text_trim`, `logic_ternary`, variables, procedures, …
- **Source:** `source_query` — XPath/XQuery via [fontoxpath](https://github.com/FontoXML/fontoxpath);
  typed `evaluateXPathTo*` from target slot `DV_*` type (see [SOURCE_QUERY.md](SOURCE_QUERY.md))
- **Loops (custom):** `for_each_source` — iterate nodes from a multi-valued source path
  into a named mapping variable (alongside stock `controls_forEach`). This is the
  supported way to scope mapping over a substructure; a kintegrate-style Source Pane
  “context root” is not required — see [future/source-context-root.md](future/source-context-root.md).

## Attribution

Toolbox category set, modest theme colours, thrasos renderer styling, and
category left-border CSS are adapted from the Blockly samples
[devsite-landing-demo](https://github.com/RaspberryPiFoundation/blockly-samples/tree/main/examples/devsite-landing-demo)
(Apache License 2.0; Copyright Google LLC / Raspberry Pi Foundation). Live
reference: [blockly.com](https://www.blockly.com/) and the
[hosted demo](https://raspberrypifoundation.github.io/blockly-samples/examples/devsite-landing-demo/index.html).

Relevant intEHRgrator files:
- `src/blockly/toolbox_demo.ts`
- `src/blockly/theme.ts` (`createModestTheme`)
- `web/styles.css` (category border rules)
- `src/blockly/i18n/` (locales: en, sv, de, es, ca, fr — stock strings from
  `blockly/msg/*`, custom Source / Data values / `for_each_source` strings in
  `custom_msg.ts`)

## Code generation pipeline

```
Blockly workspace
       │
       ├──────────────────► Mapping Model (JSON)
       │                            │
       │                            ▼
       │                   Mapping Specification (text, center CodeMirror)
       │
       ▼
 Code generators (per block type)
       │
       ├──► TypeScript export (ehrtslib)  → right pane / Export TS
       └──► Java export (Archie)            → Export Java
```

**Generators walk blocks** (or Mapping Model isomorphic to blocks) — they do **not** parse the Mapping Specification text. The spec is for human edit/review; Blockly remains the structural editor.

See [MAPPING_SPECIFICATION.md](MAPPING_SPECIFICATION.md) for DSL and expression language.

Each block type has two **export** generators — TypeScript (`ehrtslib`) and Java (`Archie`) — producing semantically equivalent Generated Export code.

### Example: `dv_quantity` block (Generated Export)

**TypeScript output:**
```typescript
new DvQuantity({ magnitude: 120, units: "mm[Hg]" })
```

**Java output:**
```java
new DvQuantity("mm[Hg]", 120.0, null)
```

### Generator Architecture
```
Block Definition (JSON)
    ├── TypeScript Generator → ehrtslib code
    └── Java Generator → Archie code
```

The block definitions are shared; only generators differ per target language.

**v1 delivery:** Both generators are implemented in Step 1; the web UI ships **Export TS** only. **Export Java** is disabled until the TS export + test path is validated. Blockly workspace XML is identical regardless of export target.

## Template-Driven Skeleton Generation

When a user loads an openEHR template (OPT), the system:
1. Parses the OPT structure (XML or JSON)
2. Walks the **OPT constraint tree** (schema, not instance)
3. Cross-references ehrtslib **`MANDATORY_RM_ATTRIBUTES`** (`enhanced/generation/rm_instance_generator.ts`) for silent-mandatory fields absent from the OPT — no direct BMM parsing
4. For each resulting node, generates the corresponding Blockly block pre-configured with:
   - Fixed values (e.g., `archetype_node_id`)
   - Constrained value sets (e.g., dropdown options from terminology bindings)
   - Mandatory sub-blocks already attached

**Not used for skeleton shape:** `RMInstanceGenerator` (`minimal` / `example` / `maximal`) — that produces instance data, not mapping structure. It may be used elsewhere (e.g. validation cross-check, example fixtures).

5. **Silent-mandatory RM fields** — required by RM but not in OPT — included visibly in the skeleton
6. **Optional RM attributes** — not in OPT, not RM-mandatory — **not** pre-rendered; added via `+` picker + block expansion

## Silent-Mandatory vs Optional RM

| Kind | In OPT? | RM required? | Skeleton behavior |
|------|---------|--------------|-------------------|
| Template field | Yes | per OPT | Always visible |
| Silent-mandatory | No | Yes | Always visible |
| Optional RM | No | No (but valid) | `+` picker + block expansion |

## Optional RM Block Expansion

RM container blocks (e.g. `observation`, `composition`) are defined with a dynamic input model:
- Initial skeleton includes OPT-required inputs **and** silent-mandatory RM inputs (always visible)
- When the user inserts an optional structure via the picker, `Blockly.Block` mutators or equivalent logic add the corresponding named statement input to the parent, then attach the new child block
- The picker options are computed from RM type metadata (valid child types, cardinality) at the selected attachment point

## References
- [Blockly Guides](https://developers.google.com/blockly/guides/overview)
- [Blockly GitHub](https://github.com/google/blockly)
- [BlockMirror](https://blockpy-edu.github.io/BlockMirror/docs/) — Blockly + CodeMirror integration inspiration
- [Blockly Custom Blocks](https://developers.google.com/blockly/guides/create-custom-blocks/overview)
- [Blockly Code Generators](https://developers.google.com/blockly/guides/create-custom-blocks/generating-code)
