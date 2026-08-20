import { assert, assertEquals } from "@std/assert";
import {
  listTermSets,
  termSetById,
  termSetIdForRmAttribute,
} from "@intehrgrator/core/openehr_term_catalog.ts";
import { isRmValueAttribute } from "@intehrgrator/core/rm_meta.ts";

Deno.test("ehrtslib terminology XML exposes composition category codes", () => {
  const set = termSetById("openehr:composition_category");
  assert(set, "expected composition category group");
  assertEquals(set.terminologyId, "openehr");
  assertEquals(set.valueRmType, "DV_CODED_TEXT");
  const codes = new Map(set.codes.map((item) => [item.code, item.rubric]));
  assertEquals(codes.get("433"), "event");
  assertEquals(codes.get("431"), "persistent");
  assertEquals(codes.get("451"), "episodic");
});

Deno.test("ehrtslib external code sets include languages, countries, and character sets", () => {
  const languages = termSetById("ISO_639-1");
  const countries = termSetById("ISO_3166-1");
  const encoding = termSetById("IANA_character-sets");
  assert(languages?.codes.some((item) => item.code === "en"));
  assert(countries?.codes.some((item) => item.code === "SE" || item.code === "US"));
  assert(encoding?.codes.some((item) => item.code === "UTF-8"));
  assert(listTermSets().length > 8);
});

Deno.test("RM attributes map to the matching ehrtslib term set", () => {
  assertEquals(termSetIdForRmAttribute("COMPOSITION", "language"), "ISO_639-1");
  assertEquals(termSetIdForRmAttribute("COMPOSITION", "territory"), "ISO_3166-1");
  assertEquals(termSetIdForRmAttribute("COMPOSITION", "category"), "openehr:composition_category");
  assertEquals(termSetIdForRmAttribute("OBSERVATION", "encoding"), "IANA_character-sets");
  assertEquals(termSetIdForRmAttribute("EVENT_CONTEXT", "setting"), "openehr:setting");
});

Deno.test("COMPOSITION language and territory are value attributes, not ELEMENT", () => {
  assertEquals(isRmValueAttribute("COMPOSITION", "language"), true);
  assertEquals(isRmValueAttribute("COMPOSITION", "territory"), true);
  assertEquals(isRmValueAttribute("COMPOSITION", "category"), true);
  assertEquals(isRmValueAttribute("COMPOSITION", "content"), false);
  assertEquals(isRmValueAttribute("COMPOSITION", "composer"), false);
});
