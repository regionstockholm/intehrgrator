import { assert, assertEquals } from "@std/assert";
import { buildDemoToolbox, toolboxBlockTypes } from "@intehrgrator/blockly/toolbox_demo.ts";
import { msg } from "@intehrgrator/blockly/i18n/custom_msg.ts";

Deno.test("toolbox starts with a search category covering custom drawers", () => {
  const toolbox = buildDemoToolbox("en") as {
    contents: Array<{ kind?: string; name?: string }>;
  };
  assertEquals(toolbox.contents[0]?.kind, "search");
  assertEquals(toolbox.contents[0]?.name, msg("en").CAT_SEARCH);
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
