# Deferred: XQuery Export — Full openEHR Conversion

**Status:** Investigation only — not in initial implementation. Captured from design discussion 2026-07-02.

## Idea

Add a third **Export Target** that emits an **XQuery program** (or module) performing the **full conversion** from source JSON/XML to a valid openEHR Composition — not merely extracting source values, but constructing the RM tree, wrapping `DV_*` data types, and honouring template slot structure.

This would sit alongside existing **TypeScript** (`ehrtslib`) and **Java** (`Archie`) generators as an alternative runtime path for server-side integration pipelines.

## Motivation

| Driver | Detail |
|--------|--------|
| **Query-language alignment** | Source paths in intEHRgrator are already XPath/XQuery (fontoxpath). Exporting XQuery keeps source access and transform in one language instead of wrapping XPath inside imperative TS/Java. |
| **Existing server stacks** | Many integration platforms (Saxon on JVM, eXist-db, BaseX, MarkLogic, XML pipelines) already host XQuery. Teams may prefer deploying a `.xq` module over maintaining a bespoke Archie conversion class. |
| **Declarative pipelines** | XQuery fits ETL-style "source document in → composition XML/JSON out" workflows without a custom JVM entry point beyond the engine's standard invoke API. |
| **Separation of transform vs validation** | XQuery can produce a composition-shaped artifact; **Archie** (or another OPT validator) can run as a **post-step** for template conformance — lighter than generating a full Archie program for every mapping edit. |

## Current architecture (baseline)

```
Mapping Model (language-neutral)
        │
        ├──► TypeScript export (ehrtslib + fontoxpath)  → Test Run in browser (v1)
        ├──► Java export (Archie + fontoxpath)          → generator built; UI deferred
        └──► [proposed] XQuery export                   → server XQuery engines
```

Today, **source querying** and **RM construction** are separate concerns in codegen:

- **Source side:** `xpathString`, `xpathNumber`, … builtins map to fontoxpath evaluators ([SOURCE_QUERY.md](../SOURCE_QUERY.md)).
- **Target side:** generators wrap expression results in RM API calls (`new DvQuantity({…})`, `element.setValue(…)`, etc.) ([MAPPING_SPECIFICATION.md](../MAPPING_SPECIFICATION.md)).

An XQuery export must cover **both** halves — or define a clear boundary where RM assembly stops and an external library takes over.

## Deployment models under investigation

### Model A — Pure XQuery conversion

Single XQuery module:

1. Accept source document (XML DOM or JSON item — engine-dependent).
2. Evaluate mapping expressions (already XQuery-shaped at source).
3. Emit composition as **XML** (canonical RM XML) or **JSON** (if engine + serializer support it).

**Runtime:** `saxon:transform`, eXist `util:eval`, BaseX `basex:eval`, etc. No Archie on the hot path.

**Validation:** Optional second step — load emitted composition + OPT into Archie `Flattener` / validator.

### Model B — XQuery extract + Archie assemble (hybrid)

XQuery export produces only **slot value bindings** (a flat or shallow XML/JSON manifest):

```xml
<mapping-result template="vitals_encounter_v1">
  <slot id="systolic" rm-type="DV_QUANTITY">
    <magnitude>120</magnitude>
    <units>mm[Hg]</units>
  </slot>
  …
</mapping-result>
```

A small, **generic** Archie (or ehrtslib-server) assembler reads the manifest + OPT and materialises the Composition.

**Pros:** Easier codegen — XQuery handles what it is good at (source traversal); RM typing stays in a typed library.  
**Cons:** Two artifacts at runtime; not a single self-contained XQuery program.

### Model C — XQuery with RM XML generation templates

Codegen emits XQuery that builds RM XML via **literal element constructors**, guided by OPT skeleton metadata from the Mapping Model (archetype node names, `@archetype_node_id`, occurrences).

**Pros:** Self-contained, no Archie on transform path.  
**Cons:** Fragile — RM XML shape, `@xsi:type`, terminology attributes, and silent-mandatory fields must be correct; duplicates logic already in ehrtslib/Archie.

**Initial recommendation for investigation:** prioritise **Model A** for simple templates; fall back to **Model B** where RM construction in XQuery is impractical; treat **Model C** as high-risk unless a proven RM-in-XQuery library emerges.

## Why Archie may still matter

Archie excels at:

- Parsing and validating against OPT constraints
- RM object graph manipulation with type safety
- Canonical serialisation (XML/JSON) from in-memory `Composition`

XQuery excels at:

- Navigating and transforming hierarchical source documents
- Expressing mapping logic declaratively
- Running inside existing XML-centric integration buses

A plausible production pattern:

```
source (XML/JSON) ──► XQuery conversion module ──► composition (XML/JSON)
                                                          │
                                                          ▼
                                              Archie OPT validation (optional gate)
                                                          │
                                                          ▼
                                              CDR / downstream
```

Archie as **validator**, not as the **generated mapping program**, reduces regeneration churn when informaticians edit Blockly mappings — they export a new `.xq`, not recompile a Java project.

## Mapping Model → XQuery codegen (sketch)

The existing `generate(model, target)` contract ([PRD](../../tasks/PRD-intehrgrator-v1.md)) extends to `'xquery'`.

| Mapping Model / expression builtin | XQuery emission (illustrative) |
|-----------------------------------|--------------------------------|
| `xpathString($expr)` | `$expr` with `xs:string(…)` coercion, or inline path if `$expr` is a literal |
| `xpathNumber($expr)` | `number($expr)` / `xs:decimal` |
| `xpathBoolean($expr)` | `boolean($expr)` |
| `trim($s)` | `normalize-space($s)` or `replace` |
| `concat($a, $b, …)` | `concat($a, $b, …)` |
| `if($c, $t, $e)` | `if ($c) then $t else $e` |
| `switch(…)` | `typeswitch` or nested `if` |
| Slot → `DV_QUANTITY` | Element constructor or call to `intehrgrator:dv-quantity($mag, $units)` helper |

**Module shape (illustrative):**

```xquery
xquery version "3.1";
declare namespace rm = "http://schemas.openehr.org/v1";

declare variable $source external;

declare function local:convert($source as item()) as element(rm:COMPOSITION) {
  element rm:COMPOSITION {
    …
    element rm:content {
      …
    }
  }
};

local:convert($source)
```

Exact namespace prefixes, RM XML schema version, and JSON source handling depend on the target engine (see open questions).

## Technical challenges

### 1. JSON source in server XQuery

fontoxpath supports JSON in the browser; **Saxon** and other engines vary (XPath 3.1 `fn:json-doc`, extension functions, or XML-only). Investigation must pick:

- **XML-only server path** (source pre-normalised to XML), or
- **Engine-specific JSON** (document per deployment target), or
- **Dual emit** — two XQuery variants from the same Mapping Model.

### 2. RM tree construction

openEHR Compositions are deeply nested (`COMPOSITION` → `SECTION` / `OBSERVATION` → `HISTORY` → `ITEM_TREE` → `ELEMENT` → `DV_*`). Template skeleton metadata in the Mapping Model (`slotId`, `rmType`, parent path) must drive codegen.

Open question: is there an existing **openEHR RM XQuery function library** (community or internal) worth reusing, or must intEHRgrator emit constructors per slot?

### 3. Cardinality and loops

Repeatable slots (`0..*`, `1..*`) need `for`/`let` in XQuery. Blockly control-flow blocks (future loops) must map cleanly. v1 expression subset is mostly scalar — multi-value paths may need `evaluateXPathToArray` equivalents (`$source//item`).

### 4. Typed `DV_*` wrappers

Each `DV_*` type has distinct XML/JSON representation (e.g. `DV_CODED_TEXT` terminology, `DV_QUANTITY` units). Codegen needs per-type emission tables — parallel to existing TS/Java generator fragments.

### 5. Template constraints vs RM validity

Producing **RM-valid** XML is necessary but not sufficient; **OPT-valid** composition may require default values, terminology bindings, and archetype details not present in source. Post-validation with Archie surfaces these gaps — document expected workflow for informaticians.

### 6. Test Run parity

Browser Test Run uses TypeScript + ehrtslib. XQuery export would not run in GH Pages without bundling an XQuery engine (heavy). Options:

- **No in-browser Test Run** for XQuery target — server-side test harness only
- **fontoxpath** as approximate preview (same expressions, different RM assembly) — risks false confidence
- **Remote test endpoint** (out of scope for local-first v1)

## Comparison matrix

| Aspect | TypeScript (v1) | Java (Archie) | XQuery (proposed) |
|--------|-----------------|---------------|-------------------|
| Primary runtime | Browser (GH Pages) | JVM integration service | XQuery engine on JVM or XML DB |
| Source query | fontoxpath | fontoxpath (Java port) or Saxon | Native XPath/XQuery on source |
| RM construction | ehrtslib | Archie API | XML literals / helper library / hybrid manifest |
| Template validation | ehrtslib + OPT load | Archie Flattener | External Archie step (recommended) |
| Test Run in app | Yes | Deferred | Unlikely in-browser |
| Fit for teams with | Front-end / Deno pipelines | Java/openEHR backends | XML-centric ESB, Saxon licenses, exist-db |

## Investigation spikes

Ordered questions to answer before committing to an export target:

1. **Engine target:** Saxon-EE on JVM vs open-source Saxon-HE vs eXist — which is the primary audience? JSON support requirements?
2. **Output format:** RM XML vs canonical JSON composition — which do downstream CDRs consume?
3. **RM-in-XQuery:** Spike a hand-written XQuery for one fixture template (e.g. vitals) → validate with Archie offline.
4. **Expression parity:** Prove Mapping Model expression subset maps 1:1 to XQuery 3.1 without extensions.
5. **Hybrid manifest:** Prototype Model B — measure lines of generic assembler vs generated XQuery for the same template.
6. **fontoxpath divergence:** Document XPath/JSON differences between fontoxpath (authoring) and server engine (execution) — may need lint at export time.
7. **Packaging:** Single `.xq` file vs XQuery module + `import` of intEHRgrator RM helper library.

## Dependencies

- Stable **Mapping Model** and expression AST ([MAPPING_SPECIFICATION.md](../MAPPING_SPECIFICATION.md))
- TypeScript and Java generators as reference implementations for semantic parity
- OPT skeleton / `slotId` manifest completeness
- Fixture templates and golden tests (reuse codegen test strategy from PRD)

## Phased delivery (if pursued)

| Phase | Deliverable |
|-------|-------------|
| **R0 — Spike** | Hand-written XQuery for one template; Archie validation script; feasibility report |
| **R1 — Extract only** | Export XQuery that returns slot manifest (Model B); generic assembler PoC |
| **R2 — Full emit** | `generate(model, 'xquery')` for scalar mappings + RM XML constructors |
| **R3 — Product** | Export XQuery UI, engine selection docs, CI golden tests, divergence lint |

## Related

- [MAPPING_SPECIFICATION.md](../MAPPING_SPECIFICATION.md) — expression builtins and codegen boundary
- [SOURCE_QUERY.md](../SOURCE_QUERY.md) — fontoxpath and typed evaluators
- [BLOCKLY_INTEGRATION.md](../BLOCKLY_INTEGRATION.md) — dual TS/Java generators pattern to extend
- [CONTEXT.md](../../CONTEXT.md) — Export Target, Conversion Script
- [PRD § Out of Scope](../../tasks/PRD-intehrgrator-v1.md) — original one-line deferral
