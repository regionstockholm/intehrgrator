import { assert, assertEquals } from "@std/assert";
import { buildDemoToolbox, toolboxBlockTypes } from "@intehrgrator/blockly/toolbox_demo.ts";
import { msg } from "@intehrgrator/blockly/i18n/custom_msg.ts";

Deno.test("toolbox contains a search category above the minimap covering custom drawers", () => {
  const toolbox = buildDemoToolbox("en") as {
    contents: Array<{ kind?: string; name?: string }>;
  };
  const searchItem = toolbox.contents.find((c) => c.kind === "search");
  assert(searchItem, "search item exists in toolbox");
  assertEquals(searchItem?.name, msg("en").CAT_SEARCH);
  assertEquals(toolbox.contents.at(-1)?.kind, "search");
  const types = toolboxBlockTypes(toolbox);
  for (const type of [
    "source_query",
    "source_query_number",
    "observation",
    "maps_create_with",
    "for_each_source",
    "text_handlebars",
  ]) {
    assert(types.includes(type), `toolbox-search index should include ${type}`);
  }
});

Deno.test("Lists and Maps share one toolbox drawer; Sheets stays separate", () => {
  const toolbox = buildDemoToolbox("en") as {
    contents: Array<{ name?: string; contents?: Array<{ type?: string }> }>;
  };
  const names = toolbox.contents.map((c) => c.name);
  assertEquals(names.filter((n) => n === msg("en").CAT_LISTS_AND_MAPS).length, 1);
  assertEquals(names.includes("Lists"), false);
  assertEquals(names.includes("Maps"), false);
  const joint = toolbox.contents.find((c) => c.name === msg("en").CAT_LISTS_AND_MAPS);
  const types = (joint?.contents ?? []).map((block) => block.type);
  assert(types.includes("lists_create_with"), "joint drawer includes list blocks");
  assert(types.includes("maps_get"), "joint drawer includes map blocks");
  assert(types.includes("maps_create_with"), "joint drawer includes maps_create_with");
  const sheets = toolbox.contents.find((c) => c.name === msg("en").CAT_SHEETS);
  assert(sheets, "Sheets remains its own drawer");
  const sheetTypes = (sheets?.contents ?? []).map((block) => block.type);
  assert(sheetTypes.includes("sheet"), "Sheets drawer still has sheet blocks");
});
