# Patient-Reported Chemotherapy Symptoms — Mapping Example

This example models a simplified version of a production Go template mapping
script that converts openEHR FLAT JSON (from the
*Patientrapporterade symptom inför medicinsk onkologisk behandling* template)
into TakeCare `ProfdocHISMessage` XML.

## Contents

| File | Description |
|------|-------------|
| `mapping/mapping.blockly.json` | Blockly workspace JSON representing the mapping logic |

## What the mapping does

1. Emits a `<ProfdocHISMessage>` envelope with header fields (`PatId`,
   `UserId`, `EventTime`, `Signer`, `TemplateId`, etc.) sourced from the
   Defaults Map (runtime parameters).
2. Inside `<Keywords>/<TextKeywords>`, conditionally emits `<TextKeyWord>`
   elements for each symptom section where the patient answered something
   other than "Nej":
   - **Trötthet (Fatigue)** — TermId 2811
   - **Andning (Breathing)** — TermId 1830
   - **Hjärta-kärl (Cardiovascular)** — TermId 6298
3. Always emits a `<TextKeyWord>` with TermId 13700 carrying the composition
   `_uid` as the document identifier.

The production script covers all 16 symptom sections; this example includes
the first three to demonstrate the repeating conditional pattern without
excessive size.

## Block types used

- `go_xml_element` — XML output nodes (Go template)
- `go_xml_comment` — inline documentation
- `source_query` — FLAT path lookups against openEHR data
- `maps_get` — retrieval from the Defaults Map (maps to `{{ .Parameters.X }}`)
- `controls_if` — conditional emission
- `logic_compare` — NEQ comparison against "Nej"
- `text` — literal string values
