import { assertEquals } from "@std/assert";
import { msg, isIntehrLocale, SUPPORTED_LOCALES } from "@intehrgrator/blockly/i18n/custom_msg.ts";

Deno.test("supported locales include en sv de es ca fr", () => {
  assertEquals(
    SUPPORTED_LOCALES.map((l) => l.code).sort().join(","),
    ["ca", "de", "en", "es", "fr", "sv"].sort().join(","),
  );
  for (const code of ["en", "sv", "de", "es", "ca", "fr"]) {
    assertEquals(isIntehrLocale(code), true);
  }
});

Deno.test("custom messages localize Source and for_each_source", () => {
  assertEquals(msg("en").CAT_SOURCE, "Source");
  assertEquals(msg("sv").CAT_SOURCE, "Källa");
  assertEquals(msg("de").FOR_EACH_SOURCE_PREFIX, "für jedes");
  assertEquals(msg("es").CAT_OPENEHR_TYPES, "openEHR types");
  assertEquals(msg("ca").LANGUAGE_LABEL, "Idioma");
  assertEquals(msg("fr").SOURCE_QUERY, "source");
});
