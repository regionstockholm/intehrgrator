import { assertEquals, assert } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { javascriptGenerator } from "blockly/javascript";
import {
  applyModelLoops,
  initBlocklyGenerators,
  workspaceToModelJson,
} from "@intehrgrator/blockly/mod.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

Deno.test("stock loop blocks and for_each_source are registered", () => {
  ensure();
  for (const type of [
    "controls_whileUntil",
    "controls_repeat_ext",
    "controls_forEach",
    "for_each_source",
  ]) {
    assert(Blockly.Blocks[type], `missing block ${type}`);
  }
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

Deno.test("for_each_source binds loop variable from path", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  javascriptGenerator.init(workspace);
  const loop = workspace.newBlock("for_each_source");
  loop.setFieldValue("vital", "VAR");
  loop.setFieldValue("/patient/vitals", "PATH");

  const code = javascriptGenerator.blockToCode(loop) as string;
  assert(code.includes("evaluateXPathToNodes"), code);
  assert(code.includes('"/patient/vitals"'), code);
  assert(code.includes('__vars["vital"]'), code);
  assertEquals(code.includes(".map((vital)"), true);
  workspace.dispose();
});

Deno.test("applyModelLoops wraps the repeating container with for_each_source", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const event = workspace.newBlock("event");
  event.setFieldValue("evt-1", "SLOT_ID");
  const model = createEmptyModel("t1");
  model.loops = [{ attachSlotId: "evt-1", varName: "measurements", path: "$.measurements" }];
  applyModelLoops(workspace, model);
  const parent = event.getParent();
  assertEquals(parent?.type, "for_each_source");
  assertEquals(parent?.getFieldValue("VAR"), "measurements");
  assertEquals(parent?.getFieldValue("PATH"), "$.measurements");
  assertEquals(workspaceToModelJson(workspace).loops, [{
    attachSlotId: "evt-1",
    varName: "measurements",
    path: "$.measurements",
  }]);
  workspace.dispose();
});
