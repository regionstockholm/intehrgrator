import { loadGitHubClinicalModel } from "../src/core/clinical_model/github_template.ts";

const url =
  "https://github.com/regionstockholm/CKM-mirror-via-modellbibliotek/blob/Obstetrix-openEHR/MHV1-%20Prenatal%20visit.encounter.v1.t.json";
const out = "test/fixtures/Obstetrix-MHV1/target/mhv1-prenatal-visit.encounter.v1.opt";
const r = await loadGitHubClinicalModel(url);
await Deno.writeTextFile(out, r.optXml);
console.log("wrote", out, "slots", r.skeleton.length);
