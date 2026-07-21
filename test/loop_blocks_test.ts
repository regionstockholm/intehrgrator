import { assertEquals, assert } from "@std/assert";
import { registerExpressionBlocks } from "@intehrgrator/blockly/blocks/expression_blocks.ts";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { javascriptGenerator } from "blockly/javascript";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

Deno.test("loop blocks are registered", () => {
  ensure();
  for (const type of [
    "controls_while",
    "controls_do_while",
    "controls_repeat_n",
    "for_each_source",
  ]) {
    assert(Blockly.Blocks[type], `missing block ${type}`);
  }
});

Deno.test("while and do-while generators emit expected shape", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const whileBlock = workspace.newBlock("controls_while");
  const doWhile = workspace.newBlock("controls_do_while");

  // Attach boolean literal as condition
  const cond1 = workspace.newBlock("boolean_literal");
  cond1.setFieldValue("TRUE", "BOOL");
  whileBlock.getInput("COND")!.connection!.connect(cond1.outputConnection!);

  const cond2 = workspace.newBlock("boolean_literal");
  cond2.setFieldValue("FALSE", "BOOL");
  doWhile.getInput("COND")!.connection!.connect(cond2.outputConnection!);

  const whileCode = javascriptGenerator.blockToCode(whileBlock) as string;
  const doCode = javascriptGenerator.blockToCode(doWhile) as string;
  assert(whileCode.includes("while (true)"), whileCode);
  assert(doCode.includes("do {"), doCode);
  assert(doCode.includes("while (false)"), doCode);
  workspace.dispose();
});

Deno.test("for_each_source binds loop variable from path", () => {
  ensure();
  const workspace = new Blockly.Workspace();
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
