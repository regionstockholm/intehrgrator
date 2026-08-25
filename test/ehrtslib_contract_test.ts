/**
 * Smoke-import the ehrtslib symbols intEHRgrator depends on.
 * `deno task vendor` tracks origin/main; if upstream moves these paths or
 * signatures, this file should fail first with a clear module/API error.
 */
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import {
  collectTemplateJsonExternalRefsFromText,
  parseTemplateInput,
  parseTemplateJson,
} from "ehrtslib/parser/mod.ts";
import {
  attributesFor,
  hasRmType,
  isAbstractType,
  isDataValueType,
  isSubtypeOf,
  subtypesOf,
} from "ehrtslib/meta/mod.ts";
import {
  webTemplateToOpt,
} from "ehrtslib/serialization/simplified/mod.ts";
import {
  asArray,
  parseLegacyTemplateXml,
  textValue,
} from "ehrtslib/parser/legacy/xml_aom_mapper.ts";
import { OptXmlSerializer } from "ehrtslib/generation/opt_xml_serializer.ts";
import {
  applyOperationalTemplateTermScopes,
  archetypeTermBagsForLanguage,
  COMPONENT_TERM_DEFINITIONS_KEY,
  lookupTermInBag,
  resolveLocatableLabel,
  TERM_ARCHETYPE_SCOPE_KEY,
  type OperationalTemplateWithTermScopes,
} from "ehrtslib/generation/term_scope.ts";
import {
  resolveTemplateLanguage,
  termCodeCandidates,
} from "ehrtslib/generation/term_codes.ts";

const bpOpt = await Deno.readTextFile(
  join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
);
const differentialTemplateJson = await Deno.readTextFile(
  join(
    import.meta.dirname!,
    "..",
    "vendor",
    "ehrtslib",
    "test_data",
    "tjson",
    "Care unit v2.t.json",
  ),
);

Deno.test("ehrtslib APIs intEHRgrator imports still resolve", () => {
  assertEquals(typeof webTemplateToOpt, "function");
  assertEquals(typeof parseTemplateInput, "function");
  assertEquals(typeof attributesFor, "function");
  assertEquals(typeof hasRmType, "function");
  assertEquals(typeof isAbstractType, "function");
  assertEquals(typeof isDataValueType, "function");
  assertEquals(typeof isSubtypeOf, "function");
  assertEquals(typeof subtypesOf, "function");
  assertEquals(typeof asArray, "function");
  assertEquals(typeof parseLegacyTemplateXml, "function");
  assertEquals(typeof textValue, "function");
  assertEquals(typeof resolveTemplateLanguage, "function");
  assertEquals(typeof termCodeCandidates, "function");
  assertEquals(typeof applyOperationalTemplateTermScopes, "function");
  assertEquals(typeof archetypeTermBagsForLanguage, "function");
  assertEquals(typeof lookupTermInBag, "function");
  assertEquals(COMPONENT_TERM_DEFINITIONS_KEY, "opt_component_term_definitions");

  assert(hasRmType("COMPOSITION"));
  assert(isDataValueType("DV_QUANTITY"));
  assert(attributesFor("DV_QUANTITY").some((a) => a.name === "magnitude"));
  assertEquals(typeof resolveLocatableLabel, "function");
  assertEquals(TERM_ARCHETYPE_SCOPE_KEY, "term_archetype_scope");
  assertEquals(termCodeCandidates("at0004")[0], "at0004");
});

Deno.test("differential .t.json resolves overlay parent archetypes", () => {
  const parentId = "openEHR-EHR-CLUSTER.organisation.v1";
  const overlayId = "openEHR-EHR-CLUSTER.ovl-organisation-000.v1";
  const refs = collectTemplateJsonExternalRefsFromText(differentialTemplateJson);
  assert(refs.includes(parentId), `expected overlay parent in ${refs}`);
  assert(!refs.includes(overlayId), `inlined overlay must not be fetched: ${refs}`);

  const { overlays } = parseTemplateJson(differentialTemplateJson);
  assert(overlays.length > 0, "expected an inlined differential overlay");
  assertEquals(overlays[0]?.parent_archetype_id?.value, parentId);
});

Deno.test("OPT XML parse keeps colliding at-codes archetype-local", () => {
  const parsed = parseTemplateInput(bpOpt);
  const opt = parsed.operationalTemplate as OperationalTemplateWithTermScopes;
  assert(opt, "expected operational template");
  const bags = archetypeTermBagsForLanguage(opt, "en");
  assertEquals(
    lookupTermInBag(bags["openEHR-EHR-OBSERVATION.sample_blood_pressure.v1"] ?? {}, "at0004"),
    "Systolic",
  );
  assertEquals(
    lookupTermInBag(bags["openEHR-EHR-CLUSTER.sample_device.v1"] ?? {}, "at0004"),
    "Manufacturer details",
  );
  const mergedAt0004 = (opt as {
    ontology?: { term_definitions?: Record<string, Record<string, { text?: string }>> };
  }).ontology?.term_definitions?.en?.at0004?.text;
  assert(
    mergedAt0004 === "Systolic" || mergedAt0004 === "Manufacturer details",
    `flat ontology at0004 is last-wins (${mergedAt0004}), not a per-node name`,
  );
});

Deno.test("OptXmlSerializer emits C_ARCHETYPE_ROOT and per-root term_definitions", () => {
  const parsed = parseTemplateInput(bpOpt);
  assert(parsed.operationalTemplate, "expected operational template");
  const xml = new OptXmlSerializer().serialize(parsed.operationalTemplate);
  assertStringIncludes(xml, 'xsi:type="C_ARCHETYPE_ROOT"');
  assertStringIncludes(xml, "openEHR-EHR-CLUSTER.sample_device.v1");
  assertStringIncludes(xml, "Manufacturer details");
});
