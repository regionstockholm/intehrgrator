# MHV1 Prenatal visit target (OPT)

Operational template flattened from the Obstetrix openEHR mirror:

- Upstream `.t.json`: https://github.com/regionstockholm/CKM-mirror-via-modellbibliotek/blob/Obstetrix-openEHR/MHV1-%20Prenatal%20visit.encounter.v1.t.json
- Branch: `Obstetrix-openEHR`
- Shipped file: `mhv1-prenatal-visit.encounter.v1.opt` (self-contained; no network fetch when loading Example Sets)

Regenerate after upstream template changes:

```bash
deno run -A scripts/fetch-mhv1-opt.ts
```
