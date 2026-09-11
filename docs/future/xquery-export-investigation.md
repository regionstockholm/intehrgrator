# XQuery Conversion Script Language

**Status:** Implemented (R1 / partial R2) — Conversion script language `xquery`
emits a self-contained `.xq` from the Mapping Model (slots, `for` from
`loops[]`, pruned `targetSignature`). Full COMPOSITION RM XML remains open.
Engine golden against BaseX is skip-if-missing (`docs/XQUERY_ENGINE.md`).

Captured from design discussion 2026-07-02; productised 2026-08-02.

## Idea

Add a **Conversion script language** that emits an **XQuery program** performing
conversion from source JSON/XML based on Blockly mapping choices — evaluating
Mapping Expressions and wrapping results in openEHR `DV_*` RM XML — suitable for
Saxon, BaseX, eXist, and similar server XQuery engines.

This sits alongside **TypeScript** (`ehrtslib`), **Java** (`Archie`), and
**Handlebars** as an alternative runtime path for server-side integration
pipelines.

## What shipped

| Piece | Location |
|-------|----------|
| `ExportTarget` includes `"xquery"` | `src/types/mod.ts` |
| `generateXQuery(model)` + expression emit | `src/core/codegen/xquery.ts` |
| Adapter registry (`.xq`, `application/xquery`) | `src/core/codegen/mod.ts` |
| Output Previews select option | `web/index.html` |
| Tests | `test/codegen_test.ts` |

### Emission model (Model B — slot manifest + IR loops)

`generate(model, "xquery")` produces an XQuery 3.1 module that:

1. Declares `external` variables `$source`, `$defaults`, and `$sheets`.
2. Compiles each Mapping Model slot expression to XQuery (`xpath*` → path
   navigation / lookup; `trim` → `normalize-space`; `concat` / `if` / …).
3. Emits `for $var in local:unbox(…)` from `loops[]` (`for_each_source` /
   `for_each_list`); relative Source Paths compile against the loop variable.
4. Wraps a pruned `targetSignature` as nested `element node` (not full
   COMPOSITION RM XML).
5. Wraps values in typed `DV_*` element constructors (`local:dv-quantity`, …).
6. Returns a `<mapping-result template="…">` document.

Literal fontoxpath JSON paths such as `$.patient.systolic` compile to
`$source?patient?systolic`. Literal XML paths such as `/patient/name` compile
to `$source/patient/name`. Dynamic XML paths error at runtime with guidance to
prefer compile-time literals.

**In-app Test Run does not execute the `.xq`.** It continues to evaluate the
Mapping Model through the Target instance format handler (same as Java export).

Recommended production pattern:

```
source ──► generated .xq (mapping-result) ──► generic OPT assembler / Archie
                                                      │
                                                      ▼
                                              CDR / downstream
```

## Motivation (unchanged)

| Driver | Detail |
|--------|--------|
| **Query-language alignment** | Source paths are already XPath/XQuery (fontoxpath). Exporting XQuery keeps source access and transform in one language. |
| **Existing server stacks** | Saxon, eXist-db, BaseX, MarkLogic, XML pipelines can host a `.xq` without a bespoke Archie conversion class. |
| **Declarative pipelines** | Fits ETL-style “source in → composition-shaped artifact out” workflows. |
| **Separation of transform vs validation** | XQuery produces values; Archie (or another OPT validator) can remain an optional post-step. |

## Architecture

```
Mapping Model (language-neutral, from Blockly)
        │
        ├──► TypeScript export (ehrtslib + fontoxpath)
        ├──► Java export (Archie stubs)
        ├──► Handlebars (user template / auto slot comments)
        └──► XQuery export → mapping-result .xq (+ DV_* helpers)
```

### Expression mapping

| Mapping Model builtin | XQuery emission |
|-----------------------|-----------------|
| `xpathString($expr)` | Compiled path or `local:string-at($source, …)` |
| `xpathNumber($expr)` | Compiled path or `local:number-at($source, …)` |
| `xpathBoolean($expr)` | Compiled path or `local:boolean-at($source, …)` |
| `trim($s)` | `normalize-space($s)` |
| `concat($a, $b, …)` | `concat($a, $b, …)` |
| `if($c, $t, $e)` | `if ($c) then $t else $e` |
| `switch(…)` | Nested `if … eq …` |
| Slot → `DV_*` | `local:as-value($rm-type, $value)` |

### Module shape (illustrative)

```xquery
xquery version "3.1";
declare namespace rm = "http://schemas.openehr.org/v1";
declare variable $source external;

declare function local:convert($source as item()*) as element(mapping-result) {
  element mapping-result {
    attribute template { "vitals" },
    element slot {
      attribute id { "s1" },
      attribute rm-type { "DV_QUANTITY" },
      local:as-value("DV_QUANTITY", xs:decimal(($source?systolic)[1]))
    }
  }
};

local:convert($source)
```

## Deployment models

| Model | Status |
|-------|--------|
| **B — XQuery extract + assembler** | **Implemented** — primary emit |
| **A — Pure XQuery full Composition** | Open — needs Template Skeleton at codegen time |
| **C — RM XML literal tree from skeleton** | Open — high risk; deferred |

## Remaining work

1. **Full COMPOSITION emit (Model A/C)** — walk Template Skeleton into RM XML,
   not only pruned `element node` / slot manifest. Child of #39.
2. **Engine golden tests in CI** — always-on BaseX (or Saxon-HE) job; the
   skip-if-missing runner in `test/xquery_engine_test.ts` is the seam.
   Install and bind notes: [XQUERY_ENGINE.md](../XQUERY_ENGINE.md).
3. **Units / coded-text fields** — multi-field DV shells beyond the primary
   expression attribute.

`for_each_source` / `for_each_list` → `for $x in … return` shipped with #39.
JSON `$source` must be an XPath 3.1 map (`parse-json` / `json-doc`), not
BaseX default JSON-as-XML.

## Related

- [MAPPING_SPECIFICATION.md](../MAPPING_SPECIFICATION.md) — Target instance format vs Conversion script language
- [SOURCE_QUERY.md](../SOURCE_QUERY.md) — fontoxpath and typed evaluators
- [BLOCKLY_INTEGRATION.md](../BLOCKLY_INTEGRATION.md) — dual generators pattern
- [CONTEXT.md](../../CONTEXT.md) — Conversion script language glossary
- [XQUERY_ENGINE.md](../XQUERY_ENGINE.md) — BaseX oracle, cloud install, JSON bind
