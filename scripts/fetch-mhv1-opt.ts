#!/usr/bin/env -S deno run -A
/** One-off helper to refresh MHV1 OPT fixture from CKM mirror (issue #195). */
import { loadGitHubClinicalModel } from "../src/core/clinical_model/github_template.ts";

const url =
  "https://github.com/regionstockholm/CKM-mirror-via-modellbibliotek/blob/Obstetrix-openEHR/MHV1-%20Prenatal%20visit.encounter.v1.t.json";
const out = "test/fixtures/Obstetrix-MHV1/target/mhv1-prenatal-visit.encounter.v1.opt";

const loaded = await loadGitHubClinicalModel(url);
await Deno.writeTextFile(out, loaded.optXml);
console.log(`Wrote ${out} (${loaded.optXml.length} bytes, ${loaded.fetched} GitHub files)`);
