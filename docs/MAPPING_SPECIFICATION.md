# Mapping Specification (center CodeMirror)

The **Mapping Specification** is the human-readable text shown in the **center pane, lower half** (CodeMirror). It is **not** TypeScript or Java export code.

| Pane | Content |
|------|---------|
| Center / bottom | **Mapping Specification** — declarative, block-aligned DSL + editable expressions |
| Right / upper | **Generated Export** — executable TypeScript or Java from codegen |

See [UI_ARCHITECTURE.md](UI_ARCHITECTURE.md). Canonical machine form: [Mapping Model](PROJECT_PERSISTENCE.md#mapping-serialization-dual).

## Design fork: how close to Blockly?

### Structure → block-aligned DSL (1:1 with Blockly, not Blockly XML)

The spec **structure** mirrors the Blockly workspace **logically**, not syntactically:

| Approach | Verdict |
|----------|---------|
| Raw Blockly XML/JSON in CodeMirror | **No** — unreadable, not for humans |
| Free-form JSON/YAML mapping file | **No** — poor sync with blocks, weak highlighting |
| Custom DSL with one construct per block/`slotId` | **Yes** — readable, deterministic round-trip |
| Full JavaScript object as the spec | **No** for structure — blurs into export code, hard to lock structure |

Each structural line maps to exactly one Blockly container or leaf metadata row. Container nesting in the DSL equals statement-input nesting in blocks. Each value slot has a stable `slotId` (shared with `AI_SUGGESTION_FORMAT.md`).

**Blockly codegen stays easy** because generators do not parse the DSL text — they walk **blocks** (or the parallel **Mapping Model**). The DSL is a **projection** for editing and review:

```
Blockly blocks  ⇄  Mapping Model (JSON)  ⇄  Mapping Specification (text)
        │                      │
        └──────────┬───────────┘
                   ▼
           Code generators → TS / Java export
```

Generators consume the **block tree** (or Mapping Model derived from it). The text spec never replaces that tree for codegen.

### Expressions → JavaScript-*shaped* subset (not full JS/TS)

**Expressions** inside value slots use a **restricted expression language** that looks like JavaScript but is **not** executable export code:

| Approach | Verdict |
|----------|---------|
| XPath only | Too weak — no `if`, `concat`, loops Blockly already supports |
| Full JavaScript / TypeScript | **No** — same syntax as export, unsafe to eval, breaks structure/expression boundary |
| JS-shaped expression subset with fixed builtins | **Yes** — familiar syntax, parseable, maps to expression blocks |

**Why JS-shaped works with Blockly:** expression slots in Blockly are already subtrees (`source_query`, `concat`, `if_then_else`, …). The text form is a **pretty-print of those subtrees**. Parsing an expression edit yields an AST that updates only the expression blocks — same as editing the blocks directly.

**Why not full JavaScript:** Test Run executes **generated TypeScript**, not the spec. Letting users write arbitrary JS in the spec would invite `fetch()`, `require()`, side effects, and confusion with the right-pane export.

## Example specification (illustrative)

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
| `trim(s)`, `concat(a,b,…)` | string ops | `trim`, `concat` |
| `if(cond, then, else)` | conditional | `if_then_else` |
| `+`, `-`, `*`, `/` | arithmetic | `arithmetic` |

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

## Related

- [BLOCKLY_INTEGRATION.md](BLOCKLY_INTEGRATION.md) — blocks and generators
- [PROJECT_PERSISTENCE.md](PROJECT_PERSISTENCE.md) — Mapping Model JSON
- [SOURCE_QUERY.md](SOURCE_QUERY.md) — fontoxpath evaluators
- [docs/future/text-first-mapping-editor.md](future/text-first-mapping-editor.md)
