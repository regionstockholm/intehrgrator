# Patient-Reported Chemotherapy Symptoms — Mapping Example

This example models a simplified version of a production Go template mapping
script that converts openEHR FLAT JSON (from the
*Patientrapporterade symptom inför medicinsk onkologisk behandling* template)
into TakeCare `ProfdocHISMessage` XML.

The Blockly mapping uses **schema-generated TakeCare blocks**
(`schema_ProfdocHISMessage`, `schema_TextKeyWord`, …) from
`examples/TakeCare/TakeCare-CasenoteWrite-edit01.xsd`, not generic `xml_element`
blocks. Load the example set to get that XSD as the mapping **target** so the
**Target schema** toolbox lists those types.

## Contents

| File | Description |
|------|-------------|
| `mapping/mapping.blockly.json` | Blockly workspace (TakeCare schema blocks) |
| `mapping/Mappningsscript 1.9.1 - PROD.txt` | Original Go template production script |
| `mapping/Mappningsscript 1.9.1 - XC.txt` | XC variant of the same script |
| `defaults.map.json` | Envelope parameters (`PatId`, `UserId`, `Time`, `TemplateId`, …) |
| `source-instance/*.txt` | openEHR FLAT composition examples |
| `../TakeCare/TakeCare-CasenoteWrite-edit01.xsd` | Canonical target schema |

## What the mapping does

1. Emits a `<ProfdocHISMessage>` envelope with header fields (`PatId`,
   `UserId`, `EventTime`, `Signer`, `TemplateId`, etc.) sourced from the
   Defaults Map (runtime parameters). `TemplateType` is the literal `1`;
   optional `Signed` is `0`.
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

- `schema_ProfdocHISMessage` / `schema_Keywords` / `schema_TextKeywords` /
  `schema_TextKeyWord` — TakeCare schema structure (Target schema toolbox)
- `source_query` — FLAT path lookups against openEHR data
- `maps_get` — retrieval from the Defaults Map (maps to `{{ .Parameters.X }}`)
- `controls_if` — conditional emission
- `logic_compare` — NEQ comparison against "Nej"
- `math_number` — TermId / Signed / TemplateType literals
- `text` — literal string values

Regenerate the Blockly JSON after schema-block changes:

`deno run -A scripts/build-chemo-symptoms-blockly.ts`
