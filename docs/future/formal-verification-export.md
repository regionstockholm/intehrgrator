# Formal verification export

**Status:** Proposal — investigation captured 2026-09-05; no codegen or UI yet.

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
| Mapping Model (`slots[]`, loops, expressions) | Derived semantic index for codegen, Test Run, validation, AI import |
| Mapping expressions | Sandboxed AST: `xpath*`, `trim`, `concat`, `if`, `switch`, `maps_get`, sheet accessors, `for_each_source` |
| Source formats | JSON, XML, openEHR (via `fontoxpath` / Source Format Handler) |
| Target instance formats | openEHR template (OPT), JSON Schema, XML Schema, free-form |
| Output validation | `ehrtslib` `TemplateValidator` when target is `openehr-template` |

See [MAPPING_SPECIFICATION.md](../MAPPING_SPECIFICATION.md), [CONTEXT.md](../../CONTEXT.md),
and [ADR 0003](../adr/0003-mapping-preview-vs-generated-script.md).

## What “correctness” could mean

Layers worth supporting (not all need day-one proof):

1. **Syntactic / schema correctness** — output conforms to target schema/template.
2. **Structural correspondence** — source path *P* maps to target slot *S* under relation *R* (units, codes, cardinality).
3. **Completeness / totality** — required target slots populated for all sources matching the source schema.
4. **Semantic preservation** — no invented clinical meaning; terminologies and units respected.
5. **Pipeline / grain properties** — loops do not duplicate or drop rows; repeated-container grain is consistent.
6. **Round-trip** — forward ∘ inverse ≈ identity when an inverse mapping exists (interop scenarios).

Full machine-checked proofs of (4)–(6) are hard in healthcare because source
schemas are often partial and semantics under-specified. A practical goal is
**strong falsification** (counterexamples) plus **contract documentation**, with
optional proof slices for safety-critical mappings.

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

```text
Blockly workspace JSON
        │
        ▼
Mapping Model (slots[], loops, expressions)
        │
        ├──► TypeScript / Java / Handlebars / XQuery / Go template  (execution)
        └──► Mapping Contract DSL  (verification)
                    │
                    ├──► Property-based tests (fast-check / Hypothesis)
                    ├──► Output validation (TemplateValidator, JSON Schema, Schematron)
                    └──► Optional: Dafny / SMT for critical subsets
```

## Anti-patterns

- Treating Schematron or JSON Schema assertions alone as “proof” — they validate output, not mapping logic for all inputs.
- Expecting informaticians to write Dafny or SMT by hand — specs must be **generated** from Blockly.
- Replacing example-based Test Run — verification export **complements** Active Example testing.

## Open questions

1. **Contract language surface** — YAML vs JSON vs a dedicated `.mapping-contract` extension; alignment with [AI_SUGGESTION_FORMAT.md](../AI_SUGGESTION_FORMAT.md).
2. **Source schema as precondition** — how strongly to require a loaded Source Schema vs inferring from examples.
3. **Loop grain** — whether to adopt grain-correctness style rules for `for_each_source` (see recent data-pipeline formalization literature).
4. **Execution oracle** — verify against Mapping preview interpreter vs generated TypeScript/XQuery (ADR 0003 seam).

## Related

- [xquery-export-investigation.md](xquery-export-investigation.md) — declarative export precedent
- [MAPPING_SPECIFICATION.md](../MAPPING_SPECIFICATION.md) — Mapping Model pipeline
- [ADR 0001](../adr/0001-mapping-and-target-seams.md) — mapping and target seams
- [ADR 0003](../adr/0003-mapping-preview-vs-generated-script.md) — preview vs generated script

## External references

- Model transformation verification (OCL postconditions, preservation properties): [Verification of Model Transformations](https://shura.shu.ac.uk/12047/1/mtverif.pdf)
- Healthcare mapping formal specs: FHIRconnect, OMOCL (archetype path → target field)
- Verifiable declarative mappings (RML → OCaml + Gospel/Cameleer): [Towards Verifiable Declarative Mappings](https://edkamb.github.io/files/kgcw2026.pdf)
- Grain correctness in data pipelines: [Grain Theory (arXiv:2601.00995)](https://arxiv.org/abs/2601.00995)

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
