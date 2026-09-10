# Mapping preview is the semantic oracle; Archie parses canonical COMPOSITION JSON

- Status: Accepted
- Date: 2026-09-10
- Issue: [#38](https://github.com/regionstockholm/intehrgrator/issues/38)

## Context

ADR 0003 splits Conversion Test Run by Output mode: Mapping preview interprets
the Mapping Model; TypeScript executes the generated Conversion Script. After
the Verifiable Mapping Subset toolbox (#35) and Mapping Model IR (#37), those
two engines must agree on clinical values for VMS mappings. ROADMAP § J asked
for a TypeScript converter oracle on that path.

Archie is a more vetted openEHR RM library than ehrtslib, but Example Sets load
OPT 1.4 / Web Template, which Archie 3.x does not consume (ADL2
`OperationalTemplate` only). `archie-all` is also a stub POM: a Java CI job
would need transitives and Maven, which this Deno repo does not ship.

## Decision

1. **Semantic oracle:** Mapping preview (`runTest` default Output mode) is the
   golden for VMS mappings. TypeScript Output mode must match on nominated
   clinical leaves (JSON Schema numbers; openEHR `DV_QUANTITY.magnitude`).
2. **XQuery:** emit must cover the same Mapping Model `slots[]` and `loops[]`
   as the IR. In-app `.xq` execution and nested COMPOSITION XML remain #39.
3. **Silent `undefined`:** canvas TypeScript codegen throws for unknown Blockly
   types instead of emitting the identifier `undefined`. CI asserts generated
   VMS scripts do not contain that identifier.
4. **RM parse (openEHR, optional later):** Archie **3.19.0**
   (`com.nedap.healthcare.archie:archie-all`, git default branch `master`)
   parses **canonical ITS-JSON** COMPOSITION. It is not the OPT 1.4 validator
   and is not a CI job in this change. OPT 1.4 postcondition stays ehrtslib
   `TemplateValidator`. File Archie vs ehrtslib divergences on
   `ErikSundvall/ehrtslib`.
5. **Out of scope:** in-browser Saxon/BaseX; Java / Handlebars / cloud-engine
   codegen comparison; re-implementing #35-removed blocks; property-based
   testing (#41).

The nominated Example Set is `dummy-json-vitals-mapped`. Blood-pressure OPT is
an additional openEHR VMS fixture for RM constructors.

## Consequences

- `test/vms_oracle_test.ts` fails CI when preview and TypeScript disagree, when
  XQuery omits IR loops, or when kept block types emit silent `undefined`.
- Canvas TypeScript wraps RM-constrained `CODE_PHRASE` attributes (language /
  territory / encoding) as terse `terminology::code` so Defaults Map codes such
  as `"en"` are valid ehrtslib input.
- Mapping Model IR for JSON Schema primitives records the schema type
  (`number`), not the field name, so preview `returnType` stays numeric.
