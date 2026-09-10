# Formal verification export

**Status:** Proposal for a verification-oriented export — investigation
captured 2026-09-05; no mapping-contract codegen or UI yet. The **Verifiable
Mapping Subset** (toolbox + Mapping Model IR) has landed (#35, #37). Remaining
VMS work: [#38](https://github.com/regionstockholm/intehrgrator/issues/38)
(oracle / golden), [#39](https://github.com/regionstockholm/intehrgrator/issues/39)
(XQuery loops/tree), [#40](https://github.com/regionstockholm/intehrgrator/issues/40)
(linter), [#41](https://github.com/regionstockholm/intehrgrator/issues/41) (PBT).

## Idea

Add a **verification-oriented export** alongside executable Conversion script
languages (TypeScript, Java, Handlebars, XQuery, Go template). The primary
purpose is not runtime execution but **checking mapping correctness** beyond
example-based Test Run.

intEHRgrator already validates openEHR output against the loaded OPT on concrete
instances (`TemplateValidator`) and warns on unmapped mandatory slots. That is
**example-based testing**, not proof over all valid inputs. A verification export
would state **pre/post conditions and invariants** derived from the Mapping
Model and check them with falsification tools (property-based testing, bounded
symbolic search) and, for critical subsets, stronger provers.

## Project context

| Piece | Role |
|-------|------|
| Blockly workspace JSON | Canonical Mapping Specification |
| Mapping Model (`slots[]`, `loops[]` grain/`kind`, `targetSignature`, `unsupported`) | Derived semantic index for codegen, Test Run, validation, AI import |
| Mapping expressions | Sandboxed AST: `xpath*`, `trim`, `concat`, `if`, `switch`, `maps_get`, sheet accessors, `for_each_source` |
| Source formats | JSON, XML, openEHR (via `fontoxpath` / Source Format Handler) |
| Target instance formats | openEHR template (OPT), JSON Schema, XML Schema, free-form |
| Output validation | `ehrtslib` `TemplateValidator` when target is `openehr-template` |

See [MAPPING_SPECIFICATION.md](../MAPPING_SPECIFICATION.md), [CONTEXT.md](../../CONTEXT.md),
and [ADR 0003](../adr/0003-mapping-preview-vs-generated-script.md).

## What “correctness” could mean

Layers worth supporting (not all need day-one proof). In an **integration**
setting, “the mapping is correct” is rarely a single clinical theorem; it is a
stack of **machine-checkable relations** between source schema, convert-time
environment (Defaults Map, Sheets), mapping, and target schema/template.

1. **Syntactic / schema correctness** — output conforms to target schema/template
   (`TemplateValidator`, JSON Schema, XSD).
2. **Structural correspondence** — source path *P* maps to target slot *S* under
   relation *R* (units, codes, cardinality).
3. **Completeness** — required target slots populated whenever the source
   actually has the corresponding data (and the mapping claims that path).
4. **Semantic preservation** — no invented clinical meaning; terminologies and
   units respected.
5. **Pipeline / grain properties** — loops do not duplicate or drop rows;
   repeated-container grain is consistent.
6. **Round-trip** — forward ∘ inverse ≈ identity when an inverse mapping exists
   (interop scenarios).
7. **Robustness / definedness (crash-freedom)** — see below.
8. **Metamorphic / sensitivity** — see below.

Full machine-checked proofs of (4)–(6) are hard in healthcare because source
schemas are often partial and semantics under-specified. A practical goal is
**strong falsification** (counterexamples) plus **contract documentation**, with
optional proof slices for safety-critical mappings. Layers **(7)** and **(8)**
are especially fitting for integration pipelines: they do not require a full
clinical gold standard, yet they catch mappings that “work on the three demo
files” and then explode or silently lie in production.

### Robustness: no valid source should break the mapping

Informally: *if the input is a legal source record, conversion must finish and
must not emit garbage that looks like a target instance.*

More formally, fix a source schema \(S\), convert-time environment \(E\)
(Defaults Map + static Sheets), mapping \(m\), and target schema/template \(T\).
For every source \(s \in S\):

| Outcome | Meaning | Verdict |
|---------|---------|---------|
| **Defined + valid** | \(m(s, E)\) terminates and \(m(s, E) \in T\) | Success |
| **Defined + incomplete** | Terminates; optional slots omitted; still in \(T\) (optionals allowed) | Success if those slots were optional |
| **Rejected** | \(s \notin S\) or \(E\) fails its precondition | Not a mapping bug — document the precondition |
| **Erroneous** | \(s \in S\) but convert **throws**, **hangs**, or returns a value **not in** \(T\) (half-built RM, wrong types, failed deserialize) | Mapping bug |

“Erroneous” includes: uncaught XPath errors, `undefined` leaking from unhandled
Blockly types, division by zero, template engines throwing on missing helpers,
and producing JSON that the OPT validator then rejects when the source was
schema-valid.

This is **totality of convert on \(S\)** plus **soundness of output wrt \(T\)**.
It is *not* “every optional clinical field is filled.” Empty optional slots are
fine; **crash** and **invalid structure** are not.

Testable today (PBT / generators from Source Schema):

- generate many \(s \in S\); assert convert does not throw;
- assert output passes `TemplateValidator` / JSON Schema / XSD;
- treat timeouts and `undefined` slots on **mandatory** paths as failures.

### Metamorphic / sensitivity: variation in input vs variation in output

Informally: *changing the source in a way the mapping cares about should change
the corresponding output; changing things the mapping ignores should not; adding
another repeating item should add another target child.*

This is **metamorphic testing**: relations between *pairs* of runs, without a
full expected COMPOSITION for every input. Useful relations for mappings:

| Relation | Typical check |
|----------|----------------|
| **Independence of unread fields** | Mutate JSON/XML nodes that no `source_query` reads → output unchanged (up to allowed metadata). Catches accidental whole-document Handlebars/`text_code` coupling. |
| **Sensitivity of mapped fields** | Change a source value that a slot’s expression reads → that slot’s value changes, *unless* the mapping’s `if`/`switch` puts both values in the same equivalence class (then document the class). Catches dead mappings and always-constant slots. |
| **Normalization invariance** | Extra whitespace, JSON key order, equivalent XML prefixes, Unicode NFC vs NFD on strings the mapping `trim`s → clinical values unchanged. |
| **Loop grain / monotonicity** | Add one node to a `for_each_source` collection → target repeating container grows by one (no fan-trap / chasm-trap). Delete the last node → count decreases. |
| **Determinism** | Same \((s, E)\) twice → identical output. Forbids `math_random_*` and hidden convert-time mutation (sheet mutators). |

“Reasonable variation” is **not** mathematical continuity (coded values are
discrete). It is: *the mapping’s declared dataflow explains the output delta.*
If systolic goes 120 → 130, `DV_QUANTITY.magnitude` should follow; territory
should not flip; an unread `comment` field should not rewrite `COMPOSITION.uid`.

Function-level decision tables ([function-test-harnesses.md](function-test-harnesses.md))
are the **specified points** on this surface; PBT plus metamorphic relations
fill the gaps between those points.

## Candidate formalisms (ranked)

### Tier 1 — Best practical fit

| Formalism | Fit | Verification style |
|-----------|-----|-------------------|
| **Mapping Contract DSL** (custom) | High — generated from Mapping Model + source/target schemas | PBT + schema/template oracles + optional SMT |
| **Property-based testing export** (fast-check, Hypothesis, QuickCheck) | High — bridges examples and full proof | Falsification with generated sources |
| **Schematron** (XML) / **JSON Schema `if/then`** (JSON) | Medium — output-side rules from mapping + constraints | Declarative validation of produced instances |

Illustrative contract shape:

```yaml
precondition: source conforms to SourceSchema
postcondition: output validates against TargetTemplate
invariants:
  - slot: vitals.blood_pressure.systolic
    from: "$.observations[?(@.code='8480-6')].value"
    ensures: "unit == 'mm[Hg]'"
  - slot: "*.language"
    from: defaults.language
```

### Tier 2 — Strong theory, higher cost

| Formalism | Notes |
|-----------|-------|
| **Dafny** | `requires` / `ensures` on generated `convert`; Z3-backed; best for critical slices (units, doses, identifiers), not all Blockly blocks initially. |
| **OCL / MDE postconditions** | Classic model-transformation contracts; good inspiration for Mapping Contract DSL even if OCL is not adopted literally. |
| **SMT-LIB / Rosette / CrossHair** | Bounded symbolic checks on the small expression language; XPath and unbounded collections need careful bounding. |

### Tier 3 — Weaker or heavier fit

| Formalism | Verdict |
|-----------|---------|
| XQuery static typing | Local path guarantees only; XQuery export already exists. |
| SHACL / RML | RDF pipeline; not openEHR-first today. |
| Alloy | Structural exploration for analysts; poor as primary user-facing export. |
| TLA+ / Isabelle / Coq / Lean | Hide behind generated specs only. |
| Catala | Regulatory rule fragments, not general field mapping. |
| Bidirectional lens languages | Poor fit for imperative Blockly + loops. |

## Recommendation

Do **not** add another general-purpose execution language for verification.

Add a **`mapping-contract`** (or **`properties`**) Output mode that:

1. **Generates** invariants from scaffolded slots, OPT/template constraints, and filled expressions.
2. Lets authors add custom properties in a **constrained predicate language** (reuse Mapping Expression AST where possible).
3. **Verifies** via property-based testing + existing `TemplateValidator` + optional bounded symbolic checks.
4. Optionally compiles **critical subsets** to Dafny or SMT for safety-critical domains.

Phased delivery:

| Phase | Deliverable |
|-------|-------------|
| **R1** | Mapping Contract DSL export (YAML/JSON); hand-run PBT harness against TypeScript/XQuery export |
| **R2** | In-app “Verify mapping” action; auto-generated properties from OPT + slot manifest |
| **R3** | Bounded symbolic checks on expression subset; CI integration |
| **R4** | Dafny/SMT slice for nominated critical slots (labs, medications, identifiers) |

## Architecture (target)

VMS is the authoring + IR surface. Mapping-contract export is still proposed.

```text
Blockly workspace JSON  (VMS toolbox — #35)
        │
        ▼
Mapping Model IR (#37): slots[], loops[] (kind), targetSignature,
                        optionalRm, unsupported, sheetNames
        │
        ├──► TypeScript / Java / Handlebars / XQuery / Go template  (execution)
        └──► Mapping Contract DSL  (verification — not built)
                    │
                    ├──► Property-based tests (fast-check / Hypothesis)
                    ├──► Output validation (TemplateValidator, JSON Schema, Schematron)
                    └──► Optional: Dafny / SMT for critical subsets
```

## Anti-patterns

- Treating Schematron or JSON Schema assertions alone as “proof” — they validate output, not mapping logic for all inputs.
- Expecting informaticians to write Dafny or SMT by hand — specs must be **generated** from Blockly.
- Replacing example-based Test Run — verification export **complements** Active Example testing.

## Blockly and product features that hinder declarative export / verification

Investigation 2026-09-08 against the Blockly surface, Mapping Model extractor
(`workspaceToModelJson`), and codegen adapters (`xquery.ts`,
`typescript_codegen.ts`, `go_template.ts`). Subsections keep those notes and
mark what **landed in #35 / #37** versus remaining issues.

### Summary

| Category | Post-#35/#37 | Remaining |
|----------|--------------|-----------|
| **Canvas vs Mapping Model gap** | IR carries `slots[]`, `loops[]`, `targetSignature`, `optionalRm`, `unsupported`, `sheetNames` | Nested COMPOSITION XML XQuery remains #39. Preview ≡ TypeScript golden is ADR 0009 / #38. |
| **Template / string DSL blocks** | Escape hatch: `slots[].hatch` + `unsupported` reason `escape` | Unbounded strings stay unverified; linter is #40 |
| **Sheet mutators** | Removed from toolbox; leftover JSON → `unsupported` reason `removed` | Do not codegen; PBT forbids convert-time mutation (#41) |
| **Stock imperative Blockly** | Removed from toolbox (`src/blockly/vms.ts`) | Leftover JSON deserializes; unknown types throw in TypeScript codegen (#38) |
| **Dynamic source paths** | Unchanged | Literal paths for proof obligations; runtime helpers otherwise |
| **Optional RM / schema mutators** | `optionalRm[]` + nested `targetSignature` | Include in mapping-contract target signature |
| **Finite enumerations (`term_pick`)** | Unchanged | **Positive** — DL-style value constraints |

### 1. Canvas semantics vs Mapping Model IR

**Landed (#37):** `workspaceToModelJson` (`src/blockly/mapping_ir.ts`) extracts
`slots[]`, `loops[]` (`for_each_source` / `for_each_list` with `kind`,
path/collection, attachSlotId), nested `targetSignature`, `optionalRm`,
`unsupported` (escape / removed / unsupported), and `sheetNames`.

**2026-09-08 note (historical):** the index was a flat `slots[]` plus a thin
`loops[]` / `optionalRm[]`; many canvas features existed only in a Blockly walk.

| Feature | In Mapping Model? | Codegen today |
|---------|-------------------|---------------|
| Value-slot expressions (`source_query`, `maps_get`, …) | Yes (`slots[].expression`, optional `hatch`) | All adapters |
| `for_each_source` / `for_each_list` | Yes (`loops[]` with `kind`) | TypeScript canvas; XQuery Model B `for` grain (#38); nested RM XML #39 |
| RM / schema tree shape | Yes (`targetSignature[]`, `optionalRm[]`) | TypeScript canvas; XQuery Model B slot manifest only (#39) |
| `lists_getIndex`, `lists_create_with` | Slot expressions when used in values | TypeScript canvas |
| Sheet **mutator** statements | `unsupported` reason `removed` | Not in toolbox |
| Stock `controls_whileUntil`, `controls_repeat_ext`, `controls_forEach`, `controls_if` | `unsupported` reason `removed` | Not in toolbox; leftover JSON throws in TypeScript codegen (#38) |

**Why it still hurts:** Declarative exports and verifiers want one **closed,
compositional IR consumer**. The IR exists. Mapping preview vs TypeScript on
VMS mappings is golden-tested (ADR 0009 / #38). XQuery covers IR slots and
`loops[]` as a Model B slot manifest; nested COMPOSITION XML is #39.
[ADR 0003](../adr/0003-mapping-preview-vs-generated-script.md) is the seam.

**Remaining:**

1. All declarative exports (XQuery nested tree, mapping-contract, future DL emit) consume
   the IR, not ad-hoc canvas walks — XQuery tree is #39.
2. Verification oracle for VMS mappings is ADR 0009 (Mapping preview ≡ TypeScript).

### 2. `text_handlebars`, `text_code`, and the Authored Handlebars Template

| Construct | Issue |
|-----------|--------|
| `text_handlebars` | Serializes to `handlebars(script, context)` — a **template engine** with unbounded string logic. XQuery stub emits only the script literal. |
| `text_code` | CodeMirror `LANG` dropdown (Plain, Handlebars, Go Template, JSON, XML, HTML, JS, TS) is **UI-only**; serialization is always a string literal. Verification cannot see which sub-language applies. |
| **Handlebars Template tab** | Parallel specification in `ProjectBundle.mapping.handlebarsTemplate`, outside Blockly / Mapping Model. |

**Why it hurts:** Formal methods need a **fixed-term expression algebra** or an
explicit escape hatch. Arbitrary Handlebars/Go/JS snippets are effectively opaque
functions `string × context → string`.

**Suggestions:**

1. For verification track: treat `text_code` / `text_handlebars` as
   **unverified escape hatches** — contract export marks affected slots
   `trust: author` and skips proof obligations.
2. Prefer **structured blocks** (`logic_ternary`, `switch`, `concat`, `term_pick`)
   over nested template languages for mapped values.
3. Either **serialize `LANG`** into the Mapping Model (`text_code:go-template`) or
   split into distinct block types (`text_go_template`, `text_handlebars_snippet`)
   so exporters know the semantics.
4. Long term: migrate Kintegrate-style prose to Blockly `text_handlebars` with a
   **restricted helper subset** that can be compiled to the Mapping Expression AST.

### 3. Sheets: accessors vs mutators

**Accessors** (`sheet_get_*`, `sheet_lookup`) are in the Mapping Expression AST
and Test Run (`evalSheetCall`). **Mutators** (`sheet_set_*`, `sheet_insert_row`,
`sheet_delete_*`, …) mutate a convert-time `SheetBag` (`applySheetMutator`) and
are **statement blocks**, not slot expressions.

XQuery export currently stubs all sheet calls as `(: … :) ()`.

**Why it hurts:** Mutators introduce **imperative state** and order dependence.
`sheet_lookup` depends on tabular data that may be edited outside the mapping;
proving “for all sources” requires quantifying over sheet contents too.

**Suggestions:**

1. VMS allows **read-only** sheet accessors with **static** sheet documents
   bundled in the Project Bundle. Mutators are not in the toolbox (#35).
2. For terminology grids: prefer `maps_create_with` / `term_pick` when the lookup
   table is small and static; reserve `sheet_lookup` for large tables with
   explicit sheet content in the contract precondition.
3. Emit sheet tables as **finite map literals** in mapping-contract export so
   provers can inline them.

### 4. Stock imperative Blockly (removed from toolbox)

**Landed (#35):** `controls_if`, `controls_whileUntil`, `controls_repeat_ext`,
`controls_for`, `controls_forEach`, `controls_flow_statements`, random, `text_print`,
list-index mutators, and sheet mutators are **not** in the default toolbox.
Authoritative lists: [`src/blockly/vms.ts`](../../src/blockly/vms.ts)
(`VMS_REMOVED_BLOCK_TYPES`). Types stay registered so Blockly can deserialize
leftover JSON without throwing; they are not IR (recorded `unsupported` reason
`removed`).

**2026-09-08 note (historical):** those blocks were still in `toolbox_demo.ts`.
Only a subset was partially supported in Go template codegen; TypeScript canvas
codegen silently emitted `undefined` for unhandled types.

**Why leftover still hurts:** Verification tools need **bounded control flow**
or pure fold/map comprehensions. While-loops and arbitrary variable mutation are
hostile to SMT, description logics, and static XQuery typing.

**Remaining:**

1. Keep `for_each_source` / `for_each_list` as the sanctioned iteration primitives
   ([BLOCKLY_INTEGRATION.md](../BLOCKLY_INTEGRATION.md)).
2. Workspace lint for leftover Remove-list JSON and escape hatches is #40.
3. TypeScript codegen throws for unhandled leftover types instead of emitting `undefined` (#38).
4. Conditional mapping uses `logic_ternary` / expression `if()` / `switch`, not
   statement-level `controls_if`.

### 5. Dynamic and scope-dependent source paths

`source_query` stores a free-text `EXPRESSION`. Click-to-map inserts literals;
authors can edit to dynamic forms. Effects:

- **XQuery:** `compileLiteralPath` inlines `$.patient.vitals[1]`; non-literals
  fall back to `local:*-at($source, $path)` or **error** for dynamic XML paths.
- **`for_each_source`:** inner paths are **relative** to the loop node; grain of
  the output array depends on source cardinality (fan-trap / chasm-trap risk).

**Suggestions:**

1. Verification export should require **literal paths** (or a normal form
  compilable at export time) for slots in the proof obligation; dynamic paths
  remain runtime-only with a warning.
2. `loops[]` records **kind**, source collection path or list collection
   expression, and target attach slot. Contract-level grain-correctness rules
   (fan-trap / chasm-trap) remain open for mapping-contract / #41.
3. Prefer XPath over ad-hoc JSON `$.` syntax in contracts when targeting XQuery
  engines; keep fontoxpath as the Test Run reference implementation.

### 6. Optional RM and schema-field mutators

Cogwheel mutators (`optional_rm_mutator`, `schema_fields_mutator`, `dv_fields_mutator`)
add optional RM attributes or schema fields after scaffold load. Presence is
recorded in `optionalRm[]`; nested shape is in `targetSignature` (optional
nodes marked). Slot expressions still come from the slot scan.

**Why it hurts:** For description-logic / schema reasoning, the **target shape**
must be fixed or explicitly enumerated. “Optional fields added ad hoc” expands the
output signature in ways a verifier must know.

**Suggestions:**

1. Include `optionalRm[]` and nested `targetSignature` (optional nodes marked)
   in mapping-contract **target signature** generation.
2. When an optional attachment is added, auto-emit a **completeness** property
   (“if source has X, optional slot Y must be populated”).

### 7. Ad-hoc `json_object` / `xml_element` vs schema-driven `target_structure`

For JSON/XML targets, generic JSON/XML drawers allow **free-form trees** alongside
schema-scaffolded `target_structure` blocks.

**Why it hurts:** Free-form trees lack a stable slot manifest for correspondence
rules; JSON-LD / SHACL / description-logic approaches want a fixed target schema.

**Suggestions:**

1. For verification track: prefer **`target_structure` / `target_value`** slots
   tied to the loaded schema; treat generic `json_object` as escape hatch (like
   `text_code`).
2. When Source Schema and Target Schema are both loaded, auto-generate
   **path correspondence** candidates for the contract.

### 8. Features that help verification (preserve and lean into)

| Feature | Why it helps |
|---------|--------------|
| `term_pick` / constrained `DV_CODED_TEXT` lists | Finite domains — easy to emit as DL disjointness / value-set constraints |
| `switch()` in Mapping Expression AST | Finite case split — compiles to nested `if` in XQuery and to decision tables in contracts |
| `maps_get` with literal keys | Pure environment lookup — model as `defaults` map in preconditions |
| Sandboxed expression parser (`validateExpressionSource`) | Already rejects `import`, `function`, `eval` — keep verification on this AST |
| OPT / `TemplateValidator` | Strong **postcondition** oracle for openEHR targets |
| `for_each_source` (vs kintegrate context roots) | Explicit iteration boundary — can compile to `for $x in … return` in XQuery |

### Verifiable Mapping Subset (VMS)

**Landed.** Toolbox cut ([#35](https://github.com/regionstockholm/intehrgrator/issues/35))
and Mapping Model IR ([#37](https://github.com/regionstockholm/intehrgrator/issues/37)).
Type lists live in [`src/blockly/vms.ts`](../../src/blockly/vms.ts)
(`VMS_REMOVED_BLOCK_TYPES`, `VMS_ESCAPE_BLOCK_TYPES`). Tests:
`test/vms_toolbox_test.ts`, `test/mapping_ir_test.ts`.

**Remaining:**

| Issue | Work |
|-------|--------|
| [#38](https://github.com/regionstockholm/intehrgrator/issues/38) | Unify Mapping preview vs TypeScript vs XQuery (oracle / golden / undefined-emit) |
| [#39](https://github.com/regionstockholm/intehrgrator/issues/39) | XQuery `for_each_*` + nested tree |
| [#40](https://github.com/regionstockholm/intehrgrator/issues/40) | Workspace linter for leftover Remove-list JSON and escape hatches |
| [#41](https://github.com/regionstockholm/intehrgrator/issues/41) | Robustness / metamorphic PBT |

Do **not** add codegen / Mapping Model coverage for Remove-list types. Escape
hatches stay in the toolbox for Kintegrate / Go snippets (`text_code`,
`text_handlebars`, Authored Handlebars Template tab) and are marked unverified.

```text
VMS allowed (toolbox + IR + exporters):
  source_query_* (prefer literal paths), maps_get, sheet_get_* / sheet_lookup
  (static sheets), trim, concat, text_append, if, switch, math_arithmetic / round /
  modulo / constrain, logic_compare / operation / negate / boolean / ternary,
  term_pick, for_each_source and for_each_list (kind + grain via attach slot),
  lists_create_with / getIndex (read-only), target_structure / RM scaffold slots,
  variables_set / variables_get (`let` in the enclosing for_each_* grain, or mapping
  root)

VMS escape hatch (toolbox; IR records hatch / unsupported reason escape):
  text_code, text_handlebars, ad-hoc json_object / xml_element trees,
  dynamic (non-literal) source paths, procedures_defreturn (until function
  harness lands)

VMS remove from toolbox (do not implement; leftover JSON deserializes only):
  controls_whileUntil, controls_repeat_ext, controls_for, stock controls_forEach,
  controls_flow_statements, controls_if (statement; keep logic_ternary),
  math_random_int / math_random_float, text_print,
  lists_setIndex, lists_repeat, sheet mutators
```

A workspace linter ([#40](https://github.com/regionstockholm/intehrgrator/issues/40))
still warns on leftover escape hatches (`text_code`, `text_handlebars`, dynamic paths)
and Remove-list types if they appear on the canvas.

## Open questions

1. **Contract language surface** — YAML vs JSON vs a dedicated `.mapping-contract` extension; alignment with [AI_SUGGESTION_FORMAT.md](../AI_SUGGESTION_FORMAT.md).
2. **Source schema as precondition** — how strongly to require a loaded Source Schema vs inferring from examples.
3. **Loop grain** — whether to adopt grain-correctness style rules for `for_each_source` (see recent data-pipeline formalization literature).
5. **Execution oracle** — Mapping preview vs TypeScript on VMS mappings is ADR 0009 / #38; in-app XQuery execution is not.
6. **Robustness generators** — how complete must Source Schema be before PBT can claim “no valid source crashes convert”?
7. **Sensitivity vs equivalence classes** — when `switch` maps many codes to one target, how to declare that class so sensitivity checks do not false-fail.

## Related

- [textual-mapping-languages.md](textual-mapping-languages.md) — authoring languages (distinct from this verification export)
- [decision-tables-for-mapping.md](decision-tables-for-mapping.md) — mapping-local rule grids (UNIQUE/COLLECT); UNIQUE rows are contract-ready invariants
- [function-test-harnesses.md](function-test-harnesses.md) — unit tests of **Blockly Function**s and decision-table-shaped oracles; specified points under PBT
- [xquery-export-investigation.md](xquery-export-investigation.md) — declarative export precedent; documents slot-manifest limits and open loop emit
- [BLOCKLY_INTEGRATION.md](../BLOCKLY_INTEGRATION.md) — block categories and `for_each_source` policy
- [ADR 0004](../adr/0004-go-template-codegen-only.md) — Blockly canvas as source of truth vs flat Mapping Model
- [MAPPING_SPECIFICATION.md](../MAPPING_SPECIFICATION.md) — Mapping Model pipeline
- [ADR 0001](../adr/0001-mapping-and-target-seams.md) — mapping and target seams
- [ADR 0003](../adr/0003-mapping-preview-vs-generated-script.md) — preview vs generated script

## External references

- Model transformation verification (OCL postconditions, preservation properties): [Verification of Model Transformations](https://shura.shu.ac.uk/12047/1/mtverif.pdf)
- Healthcare mapping formal specs: FHIRconnect, OMOCL (archetype path → target field)
- Verifiable declarative mappings (RML → OCaml + Gospel/Cameleer): [Towards Verifiable Declarative Mappings](https://edkamb.github.io/files/kgcw2026.pdf)
- Grain correctness in data pipelines: [Grain Theory (arXiv:2601.00995)](https://arxiv.org/abs/2601.00995)
- Metamorphic testing of transformations (relations between paired runs, no gold output per input): Chen et al., *Metamorphic Testing: A Review of Challenges and Opportunities*

## Question for parallel research

> **Context:** intEHRgrator is a Deno/TypeScript visual integration workbench.
> Users author mappings in Blockly from JSON/XML/openEHR sources into openEHR
> templates, JSON Schema, XML Schema, or free-form targets. Blockly JSON is
> canonical; a derived Mapping Model drives Test Run, validation, and codegen.
> We export TypeScript, Java, Handlebars, XQuery, and Go template, and validate
> openEHR output on example instances — not over all inputs.
>
> **Question:** What formalism is most suitable as a **verification export**
> (not runtime execution)? Compare mapping-contract DSL, property-based testing,
> Dafny, Schematron/JSON Schema assertions, SMT-LIB, and OCL/MDE
> postconditions on: expressiveness for healthcare integration properties,
> feasibility of generation from a Mapping Model, tool/CI maturity, usability
> for non–proof-assistant experts, and realistic goals (full proof vs strong
> falsification). Recommend a phased approach.
