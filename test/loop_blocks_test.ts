import { assertEquals, assert } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { javascriptGenerator } from "blockly/javascript";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";

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
  assertEquals(code.includes("for (const __node of"), true);
  workspace.dispose();
});
