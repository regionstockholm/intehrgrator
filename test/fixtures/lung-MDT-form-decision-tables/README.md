# Lung MDT form — decision-table sibling (#70)

Sibling of [`../lung-MDT-form/`](../lung-MDT-form/). **Do not edit** the original
Handlebars gold directory or catalog id `lung-mdt-form-to-tc-xml`.

This set keeps the TakeCare XSD, Defaults Map, and PROD Handlebars script as
references. Combinational Note / TermId logic is authored as Decision tables
(`kind: "decision-table"`) with VMS-Mustache snippet cells (no `#if (eq`).

| Table | Hit policy | Replaces |
|-------|------------|----------|
| `imaging_term` | FIRST | MR / Ultraljud / Röntgen TermIds 12683 / 4829 / 59 |
| `smoking_note` | FIRST | TermId 8754 never-smoked vs smoker snippet |
| `treatment_connector` | FIRST | Adjuvant / Neoadjuvant / Perioperativ glue |
| `regimen_phrase` | FIRST | `regim` × `antal_kurer` × `annan_regim` |
| `dose_phrase` | FIRST | fraktionsdos × totaldos |
| `chemoradiation_form` | FIRST | Kemoradioterapi form prefix |
| `treatment_frame` | FIRST | TermId 14351 sentence frame |

Repeating `#each` clusters stay on the original gold set. This sibling uses
JSONPath locals against the shared Example Instances in
`../lung-MDT-form/source-instance/`.

Regenerate:

`deno run -A --no-check scripts/build-decision-table-siblings.ts`
