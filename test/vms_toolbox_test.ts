import { assert, assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { javascriptGenerator } from "blockly/javascript";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import { applyModelLoops } from "@intehrgrator/blockly/mod.ts";
import { buildDemoToolbox, toolboxBlockTypes } from "@intehrgrator/blockly/toolbox_demo.ts";
import { msg } from "@intehrgrator/blockly/i18n/custom_msg.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";

const REMOVED_FROM_TOOLBOX = [
  "controls_whileUntil",
  "controls_repeat_ext",
  "controls_for",
  "controls_forEach",
  "controls_flow_statements",
  "controls_if",
  "math_random_int",
  "math_random_float",
  "text_print",
  "lists_setIndex",
  "lists_repeat",
  "sheet_set_cell",
  "sheet_set_xy",
  "sheet_insert_row",
  "sheet_delete_row",
  "sheet_insert_column",
  "sheet_delete_column",
] as const;

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

function drawerTypes(
  toolbox: ReturnType<typeof buildDemoToolbox>,
  name: string,
): string[] {
  const root = toolbox as {
    contents: Array<{ name?: string; contents?: Array<{ type?: string }> }>;
  };
  return (root.contents.find((c) => c.name === name)?.contents ?? [])
    .map((block) => block.type)
    .filter((type): type is string => Boolean(type));
}

Deno.test("default toolbox no longer offers verification-hostile blocks", () => {
  const types = toolboxBlockTypes(buildDemoToolbox("en"));
  for (const type of REMOVED_FROM_TOOLBOX) {
    assert(!types.includes(type), `${type} must not appear in the default toolbox`);
  }
});

Deno.test("text_append, text_join, and Variables remain in the default toolbox", () => {
  const toolbox = buildDemoToolbox("en") as {
    contents: Array<{ name?: string; custom?: string }>;
  };
  const types = toolboxBlockTypes(toolbox);
  assert(types.includes("text_append"), "text_append stays");
  assert(types.includes("text_join"), "text_join stays");
  const variables = toolbox.contents.find((c) => c.custom === "VARIABLE");
  assert(variables, "Variables drawer stays (variables_set / variables_get)");
  assertEquals(variables?.name, msg("en").CAT_VARIABLES);
});

Deno.test("Loops category offers for_each_source and for_each_list only", () => {
  ensure();
  const types = drawerTypes(buildDemoToolbox("en"), msg("en").CAT_LOOPS);
  assertEquals(types, ["for_each_source", "for_each_list"]);
});

Deno.test("for_each_list is a custom list-item loop without break/continue", () => {
  ensure();
  assert(Blockly.Blocks["for_each_list"], "for_each_list is registered");
  assertEquals(
    Blockly.Blocks["for_each_list"] === Blockly.Blocks["controls_forEach"],
    false,
    "for_each_list is not stock controls_forEach",
  );

  const workspace = new Blockly.Workspace();
  const loop = workspace.newBlock("for_each_list");
  assert(loop.getField("VAR"), "binds VAR");
  assert(loop.getInput("LIST"), "takes a list value");
  assert(loop.getInput("DO"), "has a DO body");
  assertEquals(loop.getInput("BOOL"), null, "not a while-loop");
  assertEquals(
    loop.nextConnection?.getCheck()?.includes("controls_flow_statements") ?? false,
    false,
  );

  javascriptGenerator.init(workspace);
  loop.setFieldValue("code", "VAR");
  const list = workspace.newBlock("lists_create_with");
  loop.getInput("LIST")!.connection!.connect(list.outputConnection!);
  const code = javascriptGenerator.blockToCode(loop) as string;
  assert(code.includes(".map((code)"), code);
  assert(code.includes('__vars["code"]'), code);
  assertEquals(code.includes("break"), false);
  assertEquals(code.includes("continue"), false);
  workspace.dispose();
});

Deno.test("Click-to-Map still wraps repeating containers with for_each_source", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const event = workspace.newBlock("event");
  event.setFieldValue("evt-1", "SLOT_ID");
  const model = createEmptyModel("t1");
  model.loops = [{ attachSlotId: "evt-1", varName: "measurements", path: "$.measurements" }];
  applyModelLoops(workspace, model);
  assertEquals(event.getParent()?.type, "for_each_source");
  workspace.dispose();
});
