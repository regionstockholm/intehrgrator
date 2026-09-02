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
