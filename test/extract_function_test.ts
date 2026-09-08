import { assert, assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import {
  canExtractToFunction,
  extractBlockToFunction,
  EXTRACT_TO_FUNCTION_MENU_ID,
  registerExtractToFunctionMenu,
} from "@intehrgrator/blockly/extract_function.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  registerExtractToFunctionMenu();
  ready = true;
}

Deno.test("stock procedure blocks are registered", () => {
  ensure();
  for (const type of [
    "procedures_defreturn",
    "procedures_defnoreturn",
    "procedures_callreturn",
    "procedures_callnoreturn",
  ]) {
    assert(Blockly.Blocks[type], `missing ${type}`);
  }
});

Deno.test("extract to function replaces a value block with a call and keeps the subtree on the definition", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const cmp = workspace.newBlock("logic_compare");
  const left = workspace.newBlock("text");
  left.setFieldValue("hello", "TEXT");
  cmp.getInput("A")!.connection!.connect(left.outputConnection!);

  const call = extractBlockToFunction(left, "greet");
  assertEquals(call.type, "procedures_callreturn");
  assertEquals(call.getFieldValue("NAME"), "greet");
  assertEquals(cmp.getInput("A")!.connection!.targetBlock()?.type, "procedures_callreturn");
  const defs = workspace.getTopBlocks(false).filter((b) => b.type === "procedures_defreturn");
  assertEquals(defs.length, 1);
  const body = defs[0]!.getInput("RETURN")?.connection?.targetBlock()
    ?? defs[0]!.getInput("VALUE")?.connection?.targetBlock();
  assertEquals(body?.id, left.id);
  assertEquals(left.getFieldValue("TEXT"), "hello");
  workspace.dispose();
});

Deno.test("extract to function replaces a statement block with a no-return call", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const loop = workspace.newBlock("for_each_source");
  const inner = workspace.newBlock("controls_if");
  loop.getInput("DO")!.connection!.connect(inner.previousConnection!);

  const call = extractBlockToFunction(inner, "maybe");
  assertEquals(call.type, "procedures_callnoreturn");
  assertEquals(call.getFieldValue("NAME"), "maybe");
  assertEquals(loop.getInput("DO")!.connection!.targetBlock()?.type, "procedures_callnoreturn");
  const defs = workspace.getTopBlocks(false).filter((b) => b.type === "procedures_defnoreturn");
  assertEquals(defs.length, 1);
  const body = defs[0]!.getInput("STACK")?.connection?.targetBlock()
    ?? defs[0]!.getInput("STATEMENT_INPUT")?.connection?.targetBlock();
  assertEquals(body?.id, inner.id);
  workspace.dispose();
});

Deno.test("extract to function disambiguates colliding names", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const cmp = workspace.newBlock("logic_compare");
  const left = workspace.newBlock("text");
  const right = workspace.newBlock("text");
  left.setFieldValue("a", "TEXT");
  right.setFieldValue("b", "TEXT");
  cmp.getInput("A")!.connection!.connect(left.outputConnection!);
  cmp.getInput("B")!.connection!.connect(right.outputConnection!);

  const first = extractBlockToFunction(left, "piece");
  const second = extractBlockToFunction(right, "piece");
  assertEquals(first.getFieldValue("NAME"), "piece");
  assertEquals(second.getFieldValue("NAME"), "piece2");
  workspace.dispose();
});

Deno.test("procedure definitions cannot be extracted", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const def = workspace.newBlock("procedures_defreturn");
  assertEquals(canExtractToFunction(def), false);
  workspace.dispose();
});

Deno.test("extract to function is on the Blockly block context menu", () => {
  ensure();
  const item = Blockly.ContextMenuRegistry.registry.getItem(EXTRACT_TO_FUNCTION_MENU_ID);
  assert(item, "context menu item registered");
  assertEquals(item?.scopeType, Blockly.ContextMenuRegistry.ScopeType.BLOCK);
});
