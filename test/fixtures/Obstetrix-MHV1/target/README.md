# MHV1 Prenatal visit openEHR target (OPT)

Operational template flattened from the Obstetrix MHV1 Better web template.

**Upstream (for refresh):**  
https://github.com/regionstockholm/CKM-mirror-via-modellbibliotek/blob/Obstetrix-openEHR/MHV1-%20Prenatal%20visit.encounter.v1.t.json  
(branch `Obstetrix-openEHR`, CKM mirror via Modellbibliotek)

**In-repo file:** `mhv1-prenatal-visit.encounter.v1.opt`

Regenerate after upstream template changes:

```bash
deno run -A scripts/fetch-mhv1-opt.ts
```

Example sets `obx-mhv1-*` point at this OPT so catalog load stays offline and deterministic.
