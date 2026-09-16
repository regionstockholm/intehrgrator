# Karda administration → openEHR mapping benchmark

Benchmark of AI mapping from Karda/Cytodos `AdministrationRCCV1` JSON onto template `AdministreradMedicinskOnkologiskBehandlingPerSubstans` via the intEHRgrator Agent API. Passes are independent first-cut mappings (no golden target/mapping inspection).

## Pass 1

Agent: `pass-1-mapper` on headless Agent API `http://127.0.0.1:8765/api/v1/`. Instance encoding left as `flat-json`. Example set `karda-administreringsdata-to-openehr-flat` (`includeMapping` false).

### What was mapped and how

**Loop.** `for_each_source` `substans` over `$.Substanser`, `attachSlotId` = `AdministreradMedicinskOnkologiskBehandlingPerSubstans//content/at0000`. That id is shared with EVALUATION `reason_for_encounter` (`0..1`), so `findAttachBlock` / `findSkeletonTrail` hit EVALUATION first and relative loop paths never filled ACTION leaves. Pass 1 therefore maps ACTION values with **absolute** `$.Substanser[*].…` (no `loopVar`). Preview `repeatingInstanceCount` then emits one ACTION per array item. Encounter-level fields stay scalar (`$.EncounterDate`, `$.Diagnosnamn_ICD10`, care-unit paths).

**Decision table.** Sheet `admin_ism` (`kind: "decision-table"`, `hitPolicy: FIRST`). Condition `status_desc`; outputs `current_state` and `careflow_step`. Rows for `Stoppad` / `Administrerad` / `Given` plus a catch-all. OPT `C_CODE_PHRASE` allows only openEHR `532` (completed) and local `at0007` (Medication course completed), so every row emits those rubrics. The table is documentation of source status plus the only legal pair; it is **not** a multi-state ISM map. Clinical mismatch: source `Stoppad` is closer to instruction state aborted (`531`) / careflow `at0015` Medication course stopped, which this template forbids.

**Optional RM.** Attempted `optional_rm_add` of `EVENT_CONTEXT.health_care_facility` (`PARTY_IDENTIFIED`). Canvas then threw `event_context` missing `OPT_health_care_facility` connection; later mutations failed until `POST /undo`. Facility add was reverted. Composer catalog only exposes `external_ref` (`PARTY_REF`); `name` / `identifiers` are primitive or DATA_VALUE and never appear as `list_slots` leaves. Party identity therefore **not** mapped from `SignatureUser_*` (source-over-defaults for composer/facility could not be applied).

**Encoding.** Unchanged `flat-json` on the composition Instance root.

**Source-over-defaults.** `context/start_time` and ACTION `time` remapped from `$.EncounterDate`. Language / territory / encoding left on `maps_get("defaults", …)`.

**Care unit / organisation (CLUSTER.organisation in `other_context`).**

- Outer cluster (vårdenhet): name `Vardenhet_namn` else `PDL_enhet_Namn`; identifier `Vardenhet_HSAID` else `PDL_enhet_HSAID`; role literal `vårdenhet` (OPT default / SNOMED `43741000`).
- Nested parent (vårdgivare): `$.PDL_vardgivare_Namn` / `$.PDL_vardgivare_HSAID` (present on instances, **absent from Avro schema**); role literal `vårdgivare` (OPT default / SNOMED `143591000052106`). Duplicate `at0003` identifier `slotId`s share one mapping.

**Clinical leaves.**

- Diagnosis EVALUATION `Diagnos vårdkontakt`: `$.Diagnosnamn_ICD10` as DV_CODED_TEXT **value only** (no `|code` / `|terminology` slots).
- Substance: `Innholdstoff_Navn` (ATC not bindable as `defining_code`).
- Dose: `Dose` as `source_query_number` into DV_QUANTITY **magnitude** only. `UnitCode` (`mg`) has no units slot (`C_DV_QUANTITY` has no unit list).
- Order id: `OrderLineId`.
- Category: literal `event` (openEHR `433`).
- Setting: literal `secondary medical care` (openEHR setting `232`; not in source).

**Import (canonical envelope).** `applied: 24`, `skipped: 0`, `errors: []`, `loopsAccepted: 1`, `unmappedMandatory: 0`. `PUT /sheets` for `admin_ism` succeeded but did not bump `revision`.

### Test Run results per example

`POST /run-test` after `set_active_example`. `testOk` is **false** on every example. Shared warning: `flat-json Instance encoding needs a Web Template on the openEHR target` — preview therefore serializes **canonical JSON**, not Simplified FLAT. `outputValidation.valid` is false for the same structural reasons (coded-text `defining_code` shape, `DV_IDENTIFIER.value` vs RM `id`, empty optional CLUSTER children from the skeleton). Mapping **payload content** is still useful:

| Example | testOk | EVALUATION | ACTION count | Notable output |
| --- | --- | --- | --- | --- |
| `administration-example_source_used_for_mapping.json` | false (44 validation errors) | 1; diagnosis *Icke specificerad … bröstkörtel* | 2 | start_time `2024-05-21T00:00:00`; care unit Namn `S MBA B8`, CLUSTER.name `Vårdenhet`; substances Epirubicin **181**, Cyklofosfamid iv **1086** |
| `administration-TESTFALL-A-source-example.json` | false (44 errors) | 1; *Malign tumör i mellanlob…* | 2 | start_time `2026-04-27T13:03:11`; care unit `S MBA A10`; Pembrolizumab **150**, Atezolizumab sc **1104** |
| `administration-TESTFALL-C-source-example.json` | false (26 errors; one ACTION) | 1; *Icke specificerad … bronk och lunga* | 1 | start_time `2026-02-23T00:00:00`; care unit `S MBA G4`; Vinorelbin **140** |

Composer remains the scaffold dummy (`PARTY_IDENTIFIED` name `"composer"`). Dose **units** never appear. Category/ISM/role objects carry flattened `defining_code` **strings** plus sibling `code_string`/`terminology_id` (validator still reports missing nested CODE_PHRASE fields). Diagnosis has rubric only (no ICD-10 `defining_code`). Extra empty organisation/medication CLUSTERs (Adress, Kvantitet, …) are emitted from the Template Skeleton and add most of the remaining errors.

Remaining failures are explained (renderer / slot-surface / OPT coded-text), not silent mapping misses of Dose/Namn/substance.

### What was difficult for an agent

1. **Slot labels vs paths.** Many leaves are labelled `DV_CODED_TEXT` / `DV_TEXT` / `Identifierare` with no `pathLabel` or `attachSlotId` in `GET /slots`. Distinguishing EVALUATION vs ACTION, care unit vs parent org, and which `at0003` is HSA vs org-number required walking the OPT definition tree.
2. **Duplicate `slotId`s.** EVALUATION `at0000` (`0..1`) and ACTION `at0000` (`0..*`) share `…//content/at0000`. Nested parent org has two `ELEMENT at0003` with identical ids. `applyExpressionEdit` keeps **one** mapping-model row per id. Relative `loopVar` paths on ACTION leaves evaluated empty; ACTION repeat only worked after switching to `$.Substanser[*]` arrays.
3. **Missing units slot.** Dose is `…/at0139/value/value/value` (magnitude). Unconstrained `C_DV_QUANTITY` does not create a units leaf, so `UnitCode` cannot be mapped via `map_slot` / `import_suggestions`.
4. **Coded text is a single value socket.** Diagnosis, substance, role, category, setting, ISM: one `DV_CODED_TEXT/value` slot. Envelope cannot set `defining_code` + `value` + `terminology_id`. `term_pick` is not a v2 suggestion type. Render does `output.value = <expr>; Object.assign(fixedFields)` — unique OPT codes may survive as fixed fields, external ICD-10/ATC will not.
5. **Missing composer / facility value slots.** `PARTY_IDENTIFIED.name` is a primitive String mouth; `identifiers` is a DATA_VALUE list skipped by Optional RM catalog. After a failed `health_care_facility` insert, no new slots appeared. Source `SignatureUser_FullName` / `_UserName` and facility HSA cannot be bound as the skill describes.
6. **Repeating multiplicity not on value slots.** `GET /slots` omitted `attachSlotId` / `multiplicity` on children of the ACTION. The prompt had to name `…//content/at0000` as the loop target.
7. **Schema vs instance extra fields.** Avro schema has no `PDL_vardgivare_*`; examples do. Source tree from schema hides them; Active Example tree shows them.
8. **MCP / OPT friction.** `terminology_resolve` is excellent for openEHR groups. Template-local careflow at-codes and Swedish role SNOMED defaults had to come from the OPT. Assistant FLAT examples did not include this template. DeepWiki was not needed for ehrtslib once Test Run was available.
9. **Decision table API friction.** `PUT /sheets` returned success but **did not bump `revision`**, so `If-Match` after sheets still used the pre-sheets revision. Grid shape (`decisionColumns`, `rowCatchAll`, don't-care `—`) is documented in CONTEXT.md more clearly than in the Agent workflow table. DT eval cannot emit a full `DV_CODED_TEXT` object (string outputs only).
10. **Optional RM canvas bug.** Adding `health_care_facility` (a documented default-point insert) broke Blockly (`OPT_health_care_facility` connection). Undo recovered. Agent mutations that `syncBlocklyFromModel` then 500 until undo.

### Suggested improvements

**Skills / docs**

- Copy AI Prompt / `list_slots` should emit `pathLabel`, `attachSlotId`, RM parent type, and `allowedValues` / `unitsFixed` on every row (inspect.ts already has some of these; the running API omitted them).
- Document that party `name` / `identifiers` are **not** suggestion slots today, and that `optional_rm_add` of `health_care_facility` can break `event_context`.
- Spell out DV_CODED_TEXT: one socket = rubric/`value` only unless unique OPT `defining_code` is in `fixedFields`. Recommend a three-leaf coded-text mapping or `|raw`.
- `PUT /sheets` should bump revision (or docs should say If-Match is unchanged).
- Warn that `content/at0000` can be both EVALUATION and ACTION in this template; loop attach is first-match. Document the `$.array[*].field` preview workaround when attach hits the wrong duplicate.
- Document that `flat-json` Test Run needs a Web Template on the target; otherwise preview is canonical JSON and `testOk` stays false.

**Agent API / app**

- Unique `slotId`s when two C_ARCHETYPE_ROOT nodes reuse `at0000` (include RM type or archetype id). Until then, `evaluateLoopSlots` / `findAttachBlock` should prefer the repeating (`0..*` / `1..*`) container when ids collide.
- Emit DV_CODED_TEXT `defining_code` as a CODE_PHRASE object (not a flattened string on the DV). Emit DV_IDENTIFIER `id` (not `value`).
- Attach a Web Template to example-set openEHR targets so `flat-json` Test Run can serialize.
- Expose DV_QUANTITY `units` as a value slot when unconstrained (or when source has a unit).
- Expose `PARTY_IDENTIFIED.name` and `identifiers[].id` as mappable leaves; include `identifiers` in Optional RM even though the item type is DATA_VALUE.
- Allow `term_pick` (or `text_code` JSON) in the v2 envelope for RM-coded attributes (category, setting, ISM).
- Fix `event_context` mutator: `health_care_facility` is already an RM-optional mouth (`ATTR_` vs `OPT_` prefix mismatch).
- `list_slots` should list container ids eligible for `loops[].attachSlotId`.

**openEHR assistant MCP**

- Return instruction-state **and** typical medication ACTION careflow at-codes together.
- ICD-10 / ATC resolve is out of scope today; a “external terminology id for this coded ELEMENT” hint from the OPT would help.

### Uncertainties (no invented codes)

- **ISM vs Stoppad.** Source `AdministrationStatus=4` / `Stoppad` is not “completed”. Mapped to OPT-mandated `532` / `at0007` rather than inventing a different openEHR state the template rejects. `at0015` / `531` would be a better clinical guess **if** the template allowed it.
- **Setting `232` secondary medical care.** Source has no care setting. Alternative `233` secondary nursing care was considered; oncology chemo encounter is assumed secondary medical. Not taken from source.
- **ICD-10 / ATC `defining_code`.** Not mapped. Terminology ids (`ICD-10`, `ATC`) were not confirmed from the OPT (substance and diagnosis `DV_CODED_TEXT` unconstrained).
- **Role SNOMED.** Rubrics `vårdenhet` / `vårdgivare` taken from OPT `default_value` / term_definitions, not invented. Codes themselves could not be written into the slot.
- **Two parent-org identifiers.** OPT has two `at0003` ELEMENTs (HSA `1.2.752.29.4.19` vs org-number `2.5.4.97`). Only HSA is in the source; both slots receive it.
- **Loop attach target.** Relative `loopVar` paths did not fill ACTION; `$.Substanser[*]` arrays did, so attach almost certainly resolved to EVALUATION. Canvas wrap was not inspected.

### Artefacts

- `test/fixtures/administrerad-medicinsk-onkologisk-behandling/mapping/pass-1-ai.intehrgrator-suggestions.json`
- `test/fixtures/administrerad-medicinsk-onkologisk-behandling/mapping/pass-1-ai.sheets.json`
- Optional bundle export: `/tmp/karda-pass1/pass1.bundle.json` (revision `r7ee7baab` after canonical import).

## After Pass 1 — inspect / runtime landed

These address Pass 1 hazards 1, 3, 6, 7 (partial):

- `list_slots` now includes `pathLabel`, `attachSlotId`, `repeatable[]`, `unitsFixed` / `allowedUnits`, `codeFixed` / `terminologyFixed` / `allowedValues`. Duplicate `slotId` rows are collapsed.
- Copy AI Prompt slot manifest carries the same fields plus a `maps_create_with` magnitude+units example.
- Test Run unpacks a `map("magnitude", …, "units", …)` (and coded-text maps) instead of coercing the record to `NaN` / `"[object Object]"`. Unconstrained `UnitCode` maps onto the quantity slot this way; there is still no sibling units slot.
- Avro schema includes `PDL_vardgivare_Namn` / `PDL_vardgivare_HSAID` so schema-driven mapping sees the instance fields.

Still open from Pass 1: unique `slotId`s for EVALUATION vs ACTION `content/at0000`; party name/identifiers as value slots; `optional_rm_add` health_care_facility canvas 500; `PUT /sheets` revision bump; DV_CODED_TEXT three-leaf mapping.
