import { assertEquals, assert } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { javascriptGenerator } from "blockly/javascript";
import {
  applyModelLoops,
  initBlocklyGenerators,
  workspaceToModelJson,
} from "@intehrgrator/blockly/mod.ts";
import { LOOP_LIST_CHECK } from "@intehrgrator/blockly/loop_block.ts";
import { ABSTRACT_SLOT_GLYPH, slotEmojiFieldName } from "@intehrgrator/blockly/rm_type_emoji.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

function attachSourceList(loop: Blockly.Block, path: string): void {
  const src = loop.workspace.newBlock("source_query_node");
  src.setFieldValue(path, "EXPRESSION");
  loop.getInput("LIST")!.connection!.connect(src.outputConnection!);
}

Deno.test("stock while/forEach stay registered; for_each_source is retired", () => {
  ensure();
  for (const type of ["controls_whileUntil", "controls_repeat_ext", "controls_forEach"]) {
    assert(Blockly.Blocks[type], `missing block ${type}`);
  }
  assertEquals(Blockly.Blocks["for_each_source"], undefined);
  assert(Blockly.Blocks["for_each_list"], "for_each_list is registered");
});

Deno.test("controls_whileUntil generator emits while shape", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  javascriptGenerator.init(workspace);
  const loop = workspace.newBlock("controls_whileUntil");
  loop.setFieldValue("WHILE", "MODE");
  const cond = workspace.newBlock("logic_boolean");
  cond.setFieldValue("TRUE", "BOOL");
  loop.getInput("BOOL")!.connection!.connect(cond.outputConnection!);

  const code = javascriptGenerator.blockToCode(loop) as string;
  assert(code.includes("while (true)"), code);
  workspace.dispose();
});

Deno.test("for_each_list LIST accepts Array and Source and shows a union glyph", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const loop = workspace.newBlock("for_each_list");
  assertEquals(loop.getInput("LIST")?.connection?.getCheck(), LOOP_LIST_CHECK);
  const glyph = loop.getField(slotEmojiFieldName("LIST"));
  assert(glyph, "in-slot type glyph");
  assertEquals(glyph?.getValue?.(), ABSTRACT_SLOT_GLYPH);
  workspace.dispose();
});

Deno.test("for_each_list with a source query binds the loop variable from path", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  javascriptGenerator.init(workspace);
  const loop = workspace.newBlock("for_each_list");
  loop.setFieldValue("vital", "VAR");
  attachSourceList(loop, "/patient/vitals");

  const code = javascriptGenerator.blockToCode(loop) as string;
  assert(code.includes("evaluateXPathToNodes"), code);
  assert(code.includes('"/patient/vitals"'), code);
  assert(code.includes('__vars["vital"]'), code);
  assertEquals(code.includes(".map((vital,"), true);
  workspace.dispose();
});

Deno.test("applyModelLoops wraps the repeating container with for_each_list", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const event = workspace.newBlock("event");
  event.setFieldValue("evt-1", "SLOT_ID");
  const model = createEmptyModel("t1");
  model.loops = [{ attachSlotId: "evt-1", varName: "measurements", path: "$.measurements" }];
  applyModelLoops(workspace, model);
  const parent = event.getParent();
  assertEquals(parent?.type, "for_each_list");
  assertEquals(parent?.getFieldValue("VAR"), "measurements");
  assertEquals(parent?.getInputTargetBlock("LIST")?.type, "source_query_node");
  assertEquals(parent?.getInputTargetBlock("LIST")?.getFieldValue("EXPRESSION"), "$.measurements");
  assertEquals(workspaceToModelJson(workspace).loops, [{
    attachSlotId: "evt-1",
    varName: "measurements",
    path: "$.measurements",
    kind: "source",
  }]);
  workspace.dispose();
});
