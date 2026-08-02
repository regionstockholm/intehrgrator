# Mapping Specification (center CodeMirror)

The **Mapping Specification** is the human-readable text shown in the **center pane, lower half** (CodeMirror). It is **not** TypeScript or Java export code.

| Pane | Content |
|------|---------|
| Center / bottom | **Mapping Specification** — declarative, block-aligned DSL + editable expressions |
| Right / upper | **Generated conversion script(s)** (glossary: Generated Export) — executable TypeScript or Java from codegen |

See [UI_ARCHITECTURE.md](UI_ARCHITECTURE.md). Canonical machine form: [Mapping Model](PROJECT_PERSISTENCE.md#mapping-serialization-dual).

## Form

A custom **block-aligned DSL**: one construct per Blockly container or leaf metadata row, with stable `slotId`s shared with [AI_SUGGESTION_FORMAT.md](AI_SUGGESTION_FORMAT.md). Nesting in the DSL matches statement-input nesting in blocks.

This keeps the text readable and round-trippable with Blockly, without dumping Blockly XML/JSON into CodeMirror.

```
Blockly blocks  ⇄  Mapping Model (JSON)  ⇄  Mapping Specification (text)
        │                      │
        └──────────┬───────────┘
                   ▼
           Code generators → TS / Java export
```

The DSL is a **projection** for editing and review. Generators walk the **block tree** (or the Mapping Model derived from it); they do not parse the spec text.

## Expressions

Value slots use a **restricted, JS-shaped expression language** — familiar syntax that pretty-prints expression block subtrees (`source_query`, stock `text` / `math_number` / `text_join` / `logic_ternary`, …). Parsing an expression edit updates only those blocks, same as editing them in Blockly.

Expressions are not full JavaScript/TypeScript and are not executed directly. Test Run runs **generated TypeScript**; arbitrary JS in the spec would blur into export code and invite unsafe side effects.

## Example

```spec
@template vitals_encounter_v1

composition vitals_encounter {                    # block: composition
  category = "433"                              # fixed / read-only
  language   = "en"                             # read-only

  section vital_signs {                           # block: section
    observation openEHR-EHR-OBSERVATION.blood_pressure.v2 {
      data {
        element systolic :: DV_QUANTITY {         # slotId on element line
          = xpathNumber("/patient/vitals[1]/systolic")
        }
        element diastolic :: DV_QUANTITY {
          = trim(xpathString("/patient/vitals[1]/diastolic"))
        }
      }
    }
  }
}
```

- Lines with `# block:` comments are editor hints (optional, may be hidden).
- `:: DV_QUANTITY` binds RM type → fontoxpath `returnType`.
- `=` introduces an **editable expression** (JS-shaped subset).
- Structural braces and keywords are **read-only** in CodeMirror (decorations).

## Expression language (v1 builtins)

| Builtin | Meaning | Blockly block |
|---------|---------|---------------|
| `xpath(expr)` | fontoxpath, return type from slot | `source_query` |
| `xpathString(expr)` | `evaluateXPathToString` | `source_query` |
| `xpathNumber(expr)` | `evaluateXPathToNumber` | `source_query` |
| `xpathBoolean(expr)` | `evaluateXPathToBoolean` | `source_query` |
| `trim(s)`, `concat(a,b,…)` | string ops | `text_trim`, `text_join` |
| `if(cond, then, else)` | conditional | `logic_ternary` |
| `+`, `-`, `*`, `/` | arithmetic | `math_arithmetic` |

Literals: strings, numbers, booleans. No statements, no `function`, no `import`, no property access on arbitrary objects.

**Codegen:** each builtin maps to a Blockly generator fragment; TS and Java generators emit `ehrtslib` / Archie calls respectively.

## Sync rules

| Edit location | Allowed | Effect |
|---------------|---------|--------|
| Blockly structure | ✓ | Regenerates spec scaffolding; preserves expressions |
| Blockly expression blocks | ✓ | Updates `=` line in spec |
| Spec: expression after `=` | ✓ | Parse → update expression blocks + Mapping Model `slots[]` |
| Spec: structural lines | ✗ | Rejected or read-only; use Blockly or `+` RM picker |

## Relation to Generated Export

Example for one slot — **not** what appears in the center pane:

```typescript
// Generated Export (right pane) — ehrtslib TypeScript
element.setValue(new DvQuantity({
  magnitude: evaluateXPathToNumber("/patient/vitals[1]/systolic", sourceCtx),
  units: "mm[Hg]"
}));
```

The spec holds `xpathNumber("/patient/vitals[1]/systolic")`; the generator wraps it in RM construction code.

## Direction note

Architecture review candidate 3 proposes preferring **Blockly native JSON**
(`Blockly.serialization.workspaces.save`) as the Mapping Specification /
interchange surface, with Mapping Model kept as a derived `slotId` → expression
index — instead of growing this custom DSL. See
[reviews/architecture-review-openehr-source-dual-builds.html](reviews/architecture-review-openehr-source-dual-builds.html).
Until that lands, this document describes the current `toSpec` projection.

## Related

- [BLOCKLY_INTEGRATION.md](BLOCKLY_INTEGRATION.md) — blocks and generators
- [PROJECT_PERSISTENCE.md](PROJECT_PERSISTENCE.md) — Mapping Model JSON
- [SOURCE_QUERY.md](SOURCE_QUERY.md) — fontoxpath evaluators
- [docs/future/text-first-mapping-editor.md](future/text-first-mapping-editor.md)
- [reviews/architecture-review-openehr-source-dual-builds.html](reviews/architecture-review-openehr-source-dual-builds.html) — candidate 3
