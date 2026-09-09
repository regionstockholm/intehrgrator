import { assertEquals } from "@std/assert";
import {
  allowedPickValue,
  filterPickOptions,
  labelForPickValue,
  shouldSearchPickList,
  SEARCHABLE_DROPDOWN_MIN,
} from "@intehrgrator/ui/searchable_pick.ts";
import { termPickDropdownOptions } from "@intehrgrator/core/openehr_term_catalog.ts";

Deno.test("ISO_639-1 is a long pick list and filters by rubric or code", () => {
  const options = termPickDropdownOptions("ISO_639-1");
  assertEquals(shouldSearchPickList(options.length), true);
  assertEquals(shouldSearchPickList(SEARCHABLE_DROPDOWN_MIN - 1), false);

  const swedish = filterPickOptions(options, "swe");
  assertEquals(swedish.some(([, code]) => code === "sv"), true);
  assertEquals(swedish.every(([label, code]) =>
    label.toLowerCase().includes("swe") || code.toLowerCase().includes("swe")
  ), true);

  const byCode = filterPickOptions(options, "SV");
  assertEquals(byCode.some(([, code]) => code === "sv"), true);
});

Deno.test("allowedPickValue rejects codes that are not in the list", () => {
  const options: Array<[string, string]> = [
    ["Swedish (sv)", "sv"],
    ["English (en)", "en"],
  ];
  assertEquals(allowedPickValue(options, "sv"), "sv");
  assertEquals(allowedPickValue(options, "xx"), null);
  assertEquals(labelForPickValue(options, "en"), "English (en)");
});
