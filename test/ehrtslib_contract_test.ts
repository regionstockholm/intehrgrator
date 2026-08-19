/**
 * Smoke-import the ehrtslib symbols intEHRgrator depends on.
 * `deno task vendor` tracks origin/main; if upstream moves these paths or
 * signatures, this file should fail first with a clear module/API error.
 */
import { assert, assertEquals } from "@std/assert";
import { parseTemplateInput } from "ehrtslib/parser/mod.ts";
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
import {
  resolveTemplateLanguage,
  termCodeCandidates,
} from "ehrtslib/generation/term_codes.ts";

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

  assert(hasRmType("COMPOSITION"));
  assert(isDataValueType("DV_QUANTITY"));
  assert(attributesFor("DV_QUANTITY").some((a) => a.name === "magnitude"));
  assertEquals(termCodeCandidates("at0004")[0], "at0004");
});
