# PRD: Constraint Overlay on RM Blocks

**Status:** Ready for implementation (Phase 1)  
**GitHub issue:** [#46](https://github.com/regionstockholm/intehrgrator/issues/46)  
**Triage label:** `ready-for-agent` (tracker currently has `enhancement` on #46; add the role label when it exists)  
**Glossary:** [CONTEXT.md](../CONTEXT.md)  
**ADR:** [0007 — Constraint Overlay is RM vs effective OPT](../docs/adr/0007-constraint-overlay-on-rm-block-mouths.md)  
**Related:** [prd-openehr-blockly-scaffolding.md](./prd-openehr-blockly-scaffolding.md), [docs/BLOCKLY_INTEGRATION.md](../docs/BLOCKLY_INTEGRATION.md)

---

## Introduction / Overview

openEHR two-level (really multi-level) modelling is RM → archetype → (specialisation)* → template → operational template. The Web Shell already walks a flattened OPT into a **Template Skeleton** of typed **RM Block**s. Informaticians therefore *use* the specialized model, but the canvas does not *teach* it: Attribute mouths show a single `[min..max]` taken from the OPT (or falling back to RM), value-domain constraints are only partially copied onto DATA_VALUE Blocks, and Optional RM Insertion can still offer attributes the template prohibited.

This PRD defines a condensed pedagogical **Constraint Overlay** on those RM Blocks — starting with the user’s Better Archetype Designer-style cardinality delta — plus which other AM constraint kinds to show, enforce, or defer.

## Problem Statement

After scaffolding from a template, RM Block mouths do not distinguish “this is the RM” from “the archetype/template narrowed this.” Several OPT constraints never reach the canvas at all (magnitude intervals, type choice, prohibited attributes still in the cogwheel). The result is a skeleton that looks like a generic composition builder rather than a specialized clinical model, which is the opposite of the teaching goal.

## Solution

Keep one Blockly vocabulary (**RM Block**s). When the operational template’s *effective* existence or cardinality is narrower than the RM BMM interval for that attribute, the **Attribute mouth** shows a **Constraint Overlay**:

- a delta glyph `Δ` (as in Better Archetype Designer)
- the effective interval in overlay colour
- the RM interval with strikethrough

Mouths that still match the RM keep today’s single caption. Live mapping failures stay **Constraint warning** triangles (unmet effective interval), not overlay colour.

Phase 1 implements that structural overlay and stops the mutator offering template-prohibited attributes. Later phases overlay value-domain constraints (units, codes, magnitude ranges, type narrowing) using the same quiet-unless-narrowed rule.

## Goals

1. Make two-level modelling visible on the scaffolded canvas without a second tree or a three-layer caption.
2. Use the user’s Better-style delta (Δ + colour + strikethrough) for structural intervals.
3. Enforce the *effective* OPT interval (warnings, mutator lock/hide), not only decorate it.
4. Leave unchanged mouths and unconstrained RM attributes visually quiet.

## User Stories

1. As an informatician, I want an Attribute mouth that the template made mandatory to show `Δ [1..1]` with the RM `[0..1]` struck through, so that I see mandation as narrowing rather than as “the RM was always required.”
2. As an informatician, I want a container mouth whose OPT cardinality is `1..1` while the RM is `0..*` / `1..*` to show that overlay, so that I understand why I cannot add a second sibling.
3. As an informatician, I want mouths that still match the RM to keep a single `[min..max]`, so that blood-pressure-sized templates stay readable.
4. As an informatician, I want the overlay colour plus Δ and strikethrough, so that I can still read the delta if I cannot distinguish the overlay hue.
5. As an informatician, I want a Constraint warning when the live child count is outside the *effective* interval, so that mapping mistakes stay distinct from “this was narrowed.”
6. As an informatician, I want template-prohibited attributes omitted from the cogwheel mutator, so that I cannot re-insert `protocol` (or similar) after the template set `max=0`.
7. As an informatician, I want template-mandatory and silent-mandatory mouths to stay locked, so that I cannot delete required structure.
8. As an informatician, I want Optional RM Insertion to still offer RM-optional attributes the template left unconstrained, so that feeder_audit and friends remain available.
9. As an informatician, I want a DATA_VALUE Block whose units were uniquely constrained (e.g. `mm[Hg]`) to keep that unit on the shell, so that existing scaffolding is not regressed.
10. As an informatician, I want a coded leaf with a local value set to keep its Blockly list of complete `DV_CODED_TEXT` objects, defaulting to `assumed_value` when present.
11. As an informatician, I want a hover/help on an overlaid mouth that names the RM interval and the effective interval, so that I can explain the glyph to a colleague.
12. As a student of openEHR, I want the canvas to use RM Block types (COMPOSITION, OBSERVATION, ELEMENT, DV_*) rather than a parallel “sRM” toolbox, so that specialized = constrained RM, not a new class model.
13. As a developer, I want the skeleton to carry both RM and effective intervals per attribute, so that Blockly fields are a view, not the source of truth.
14. As a developer, I want fixture tests on a small OPT that narrows occurrences (optional → mandatory, `0..*` → `1..1`, exclude-via-0) to assert overlay vs quiet captions.
15. As a developer, I want unmet-cardinality tests to keep using the effective interval, so that overlay styling cannot hide a failed mapping.

## Functional Requirements

1. The system must compare, for each RM attribute shown as an Attribute mouth, the RM BMM multiplicity (ehrtslib introspection) with the effective OPT interval (existence for single-valued attributes, cardinality for containers).
2. When those intervals differ, the mouth caption must render a Constraint Overlay: `Δ`, effective interval in overlay colour, RM interval struck through.
3. When they are equal, the mouth caption must remain a single `[min..max]` / `[n..*]` as today.
4. Object **occurrences** must not replace attribute existence/cardinality on the mouth caption. If a later phase shows occurrences, they belong on the child RM Block, not the parent mouth.
5. Constraint warning triangles must evaluate the *effective* interval (current behaviour, re-confirmed). Overlay colour must not mean “unmet.”
6. Optional RM Insertion must omit attributes prohibited by the OPT (`C_ATTRIBUTE.is_prohibited` / occurrences `0..0`). Flattened OPTs that already dropped those nodes still need an exclusion list so the cogwheel cannot resurrect them from RM meta alone.
7. Template-mandatory and silent-mandatory mouths stay locked (existing rule).
8. Overlay signalling must not be colour-only (Δ + strikethrough are required companions).
9. JSON Schema / XML Schema targets are unchanged by this PRD (no Constraint Overlay).
10. Phase 1 must not regress existing DATA_VALUE scaffolding: unique units → `fixedFields.units`; coded/ordinal lists → Blockly lists; `assumed_value` as list default.

## Implementation Decisions

Settled from AM facts, current scaffolding behaviour, and the user’s Better-style proposal. Reopen on the GitHub issue if a choice is wrong.

1. **Comparison pair:** RM BMM vs effective flattened OPT. Not a three-layer RM / archetype / template caption on the mouth (ADR 0007). Archetype-versus-template deltas are a later phase if the clinical-model fileset still has overlays.
2. **Quiet unless narrowed:** Δ only when the effective interval is a strict narrowing of the RM interval.
3. **Mouth shows attribute constraints:** existence (single) or cardinality (container). Occurrences stay off the mouth.
4. **Visual language:** Unicode `Δ` + overlay colour for the effective interval + strikethrough on the RM interval. Unmet stays bold `--unmet` as today. Overlay hue must remain readable on the Modest Blockly Theme pastels; do not reuse the warning-triangle yellow as overlay colour.
5. **Custom field, not two FieldLabels:** Blockly `FieldLabel` cannot mix strikethrough and colour on one string. Phase 1 adds one overlay-capable caption field (two tspans or equivalent), replacing the single-string slot-cardinality label when a delta exists.
6. **Enforcement vs illustration:** illustrate on the mouth; enforce via existing Constraint warning + mutator lock/hide. Do not invent a new hard-block UI for extra children (statement stacks already fail the count check).
7. **Prohibited nodes:** remain absent from the canvas (OPT flattening already drops `existence matches {0}`). Phase 1 adds mutator exclusion so RM meta cannot bring them back.
8. **Value-domain overlay:** not in Phase 1. Unique units / coded lists / ordinals stay as today’s scaffolding. Phase 2 applies the same quiet-unless-narrowed overlay to units, codes, magnitude `Interval<Real>` from `C_QUANTITY_ITEM`, and RM-type narrowing (`DV_TEXT` → `DV_CODED_TEXT`).
9. **Defaults vs assumed values:** unchanged. Template `default_value` appears in data; archetype `assumed_value` does not. Overlay work must not conflate them.
10. **Seam:** extend the Template Skeleton node (or a sibling attribute map on the parent) with `rmCardinality` + `effectiveCardinality` per RM attribute. Blockly reads that pair. Do not parse BMM in intEHRgrator; RM multiplicity comes from ehrtslib as today.
11. **sRM:** not a new block family. An RM Block plus Constraint Overlay *is* the specialized/semantic RM.

## Testing Decisions

- Test external behaviour: given a small OPT that narrows an optional RM attribute to `1..1`, the parent RM Block’s mouth caption is an overlay (Δ, effective `1..1`, RM interval struck through). A sibling attribute left at RM multiplicity has no Δ.
- Given an OPT that sets `max=0` on an optional RM attribute, that name is absent from the cogwheel mutator list even though RM meta still lists it.
- Unmet effective cardinality still sets `--unmet` and a Constraint warning; overlay mouths use the effective bounds for that check.
- Do not assert pixel colours or x/y. Assert field CSS classes / structured caption model (`hasOverlay`, `effective`, `rm`).
- Prior art: slot-cardinality tests, Blockly RM block tests, skeleton tests (blood-pressure units already prove constraint *copying*; add overlay *comparison* fixtures).

## Out of Scope

- Authoring archetypes or templates (ADL/OET editors).
- Three-layer RM / archetype / template captions on the mouth (ADR 0007).
- Phase 2 value-domain overlay (magnitude ranges, tuple `C_ATTRIBUTE_TUPLE`, type-narrowing badges).
- Phase 3 differential overlay from `.t.json` + ADL fileset; `rules` / BEL; `ARCHETYPE_SLOT` include/exclude assertions after flatten (filled roots already appear as nested RM Blocks).
- `hide_on_form` and other non-normative UI annotations.
- JSON Schema / XSD Constraint Overlay.
- Replacing Output validation (`TemplateValidator`) with canvas-only checks.

## Design Considerations

- Better Archetype Designer is the visual citation for Δ + colour + strikethrough, not a requirement to clone its chrome.
- Condensation rule: overlay is a *delta*, not a legend. Unchanged structure should look like today’s skeleton.
- Existence vs cardinality vs occurrences are easy to confuse in UI copy; captions should keep `[n..m]` and let the help text name the AM property.
- AOM 2 `C_ATTRIBUTE.existence` / `cardinality` are “only set if they override the RM or parent.” Flattened OPT 1.4 objects in ehrtslib may always carry effective intervals — comparison against BMM is then mandatory.

## Technical Considerations

- AM sources used for this PRD: `openehr://guides/archetypes/structural-constraints`, `openehr://guides/specs/am-Overview`, `openehr://guides/specs/am2-AOM2`, `openehr://guides/specs/am2-OPT2`, `openehr://guides/templates/principles`, `openehr://guides/templates/rules`, `openehr://guides/templates/oet-idioms-cheatsheet`, `openehr://spec/type/AM2/C_ATTRIBUTE`, `openehr://spec/type/AM2/C_OBJECT`, `openehr://spec/type/AM2/C_DEFINED_OBJECT`, `openehr://spec/type/AM2/C_PRIMITIVE_OBJECT`, `openehr://spec/type/AM2/ARCHETYPE_SLOT`, `openehr://spec/type/AM2/TEMPLATE_OVERLAY`, `openehr://spec/type/AM/C_QUANTITY`.
- Narrowing only: templates may mandata or exclude optional nodes, subset value sets, tighten quantity units/ranges, pick one type from a choice, set `default_value`. They must not relax archetype minima or expand value sets (`openehr://guides/templates/principles`).
- OPT flattening drops zero-existence nodes and inlines slot fillers (`openehr://guides/specs/am2-OPT2`). The canvas therefore never sees excluded subtrees unless Optional RM Insertion rebuilds them from RM meta — which Phase 1 must prevent.
- Today’s skeleton already copies some leaf constraints (`C_QUANTITY` unique units, `C_CODE_PHRASE` lists, `C_ORDINAL` lists, `assumed_value`). It does not extract `C_QUANTITY_ITEM.magnitude` intervals or keep an RM-vs-effective pair on mouths. Mouth labels currently prefer OPT `slotCardinality` / `multiplicity` and otherwise RM meta — so an overlaid delta is new data, not just new CSS.

## Success Metrics

- A newcomer can point at a Δ mouth and explain “the RM allowed this to be absent; the template made it required” without opening Archetype Designer.
- Blood-pressure scaffolding tests still pass (units, coded category, silent-mandatory language).
- No Constraint warning fires merely because a mouth has an overlay.

## Grill record (recommended answers taken as contract)

Background-agent session: facts from openEHR Assistant + AM BMM + current skeleton; the user’s Better-style mouth proposal accepted. Override on the implementation issue if needed.

1. **Pedagogical goal** — Hybrid: effective constraint is primary; overlay is the delta vs RM. (Not OPT-only, not a three-layer stack.)
2. **Phase 1 surface** — Attribute mouths (existence/cardinality) + mutator exclusion of prohibited attributes.
3. **“Original” interval** — RM BMM via ehrtslib, not a guessed ADL default.
4. **Glyph** — `Δ` + overlay colour + strikethrough, as proposed.
5. **sRM** — reading of an RM Block with overlay, not a new toolbox.

---

## Appendix A — AM constraint kinds (what can change)

| Kind | AM home | Who may narrow | Phase 1 canvas | Later |
| --- | --- | --- | --- | --- |
| Attribute existence `{0}`, `{0..1}`, `{1..1}` | `C_ATTRIBUTE.existence` | Archetype, template | Overlay on single-valued mouths; hide `{0}` from mutator | — |
| Container cardinality (interval, ordered, unique) | `C_ATTRIBUTE.cardinality` | Archetype, template | Overlay on container mouths (interval only) | ordered/unique in help |
| Object occurrences | `C_OBJECT.occurrences` | Archetype, template | Drives skeleton include/mandatory; not drawn on the parent mouth | Child-block occurrences if they differ from the mouth |
| RM type narrowing / choice | `C_OBJECT.rm_type_name` | Template picks one of a choice (rule B3) | Already: concrete `DV_*` shell | Δ badge when `DV_TEXT`→`DV_CODED_TEXT` |
| Prohibit / exclude | existence or occurrences `0..0` (`max="0"`) | Template | Absent on canvas + mutator omit | Ghost node (rejected) |
| Primitive interval / pattern | `C_INTEGER`, `C_REAL`, `C_STRING`, `C_DATE*` | Archetype, template | No | Magnitude/range overlay |
| Quantity units + magnitude | `C_QUANTITY` / `C_QUANTITY_ITEM` | Archetype, template | Unique unit already copied | Multi-unit list overlay; magnitude `Interval<Real>` |
| Coded value set / limit-to-list | `C_TERMINOLOGY_CODE` / `C_CODE_PHRASE` | Subset only | List scaffolding | Overlay vs unconstrained |
| Ordinal / scale rungs | `C_ORDINAL` | Subset only | List scaffolding | Overlay vs unconstrained |
| Tuple (covariant units+range) | `C_ATTRIBUTE_TUPLE` | Archetype, template | No | Help / Phase 2 |
| Assumed value | `C_PRIMITIVE_OBJECT.assumed_value` | Archetype | List default; not in data | — |
| Default value | `C_DEFINED_OBJECT.default_value` | Template | Unchanged (Defaults / literals) | Show as prefilled, distinct from assumed |
| Term / label override | Template terminology | Template | Already: term text on labels | — |
| Slot fill / close | `ARCHETYPE_SLOT`, `C_ARCHETYPE_ROOT` | Template composition | Nested RM Block with `archetypeRef` | Include/exclude assertions |
| Rules | BEL / `rules` | Archetype | No | Out of scope |
| Annotations / `hide_on_form` | Tooling, not OPT 2 | Tooling | No | Out of scope |

Sources: structural-constraints guide; template principles (narrowing, defaults vs assumed); AOM 2 `C_ATTRIBUTE` / `C_OBJECT` / `C_DEFINED_OBJECT` / `C_PRIMITIVE_OBJECT`; OPT 2 flattening; OET idioms (`max=0`, mandatory escalation, limit-to-list, quantity hardening).
