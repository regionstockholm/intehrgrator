import { assert, assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import "blockly/blocks";
import {
  initBlocklyGenerators,
  blockToExpression,
} from "@intehrgrator/blockly/mod.ts";
import { buildDemoToolbox, toolboxBlockTypes } from "@intehrgrator/blockly/toolbox_demo.ts";
import { msg } from "@intehrgrator/blockly/i18n/custom_msg.ts";
import {
  LOGIC_CARDINALITY_BLOCK,
  LOGIC_QUANTIFY_BLOCK,
  LOGIC_SET_NOT_BLOCK,
  LOGIC_SET_OPERATION_BLOCK,
} from "@intehrgrator/blockly/blocks/logic_blocks.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

Deno.test("DL logic blocks are registered and in the Logic toolbox drawer", () => {
  ensure();
  for (const type of [
    LOGIC_QUANTIFY_BLOCK,
    LOGIC_CARDINALITY_BLOCK,
    LOGIC_SET_OPERATION_BLOCK,
    LOGIC_SET_NOT_BLOCK,
  ]) {
    assert(Blockly.Blocks[type], `missing block ${type}`);
  }
  const toolbox = buildDemoToolbox("en") as {
    contents: Array<{ name?: string; contents?: Array<{ type?: string }> }>;
  };
  const logic = toolbox.contents.find((c) => c.name === msg("en").CAT_LOGIC);
  const types = (logic?.contents ?? []).map((block) => block.type);
  assert(types.includes(LOGIC_QUANTIFY_BLOCK));
  assert(types.includes(LOGIC_CARDINALITY_BLOCK));
  assert(types.includes(LOGIC_SET_OPERATION_BLOCK));
  assert(types.includes(LOGIC_SET_NOT_BLOCK));
  const indexed = toolboxBlockTypes(toolbox);
  assert(indexed.includes(LOGIC_QUANTIFY_BLOCK), "toolbox search indexes quantify");
});

Deno.test("logic_quantify serializes to all_of / any_of / none_of", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock(LOGIC_QUANTIFY_BLOCK);
  block.setFieldValue("ONLY", "OP");
  const list = workspace.newBlock("lists_create_with") as Blockly.Block & {
    itemCount_?: number;
    updateShape_?: () => void;
  };
  list.itemCount_ = 0;
  list.updateShape_?.();
  block.getInput("LIST")!.connection!.connect(list.outputConnection!);
  const pred = workspace.newBlock("logic_boolean");
  pred.setFieldValue("TRUE", "BOOL");
  block.getInput("PRED")!.connection!.connect(pred.outputConnection!);
  const expr = blockToExpression(block);
  assert(expr?.startsWith("all_of("), expr ?? "");
  assert(expr?.includes("list()"), expr ?? "");
  assert(expr?.includes("true"), expr ?? "");

  block.setFieldValue("SOME", "OP");
  assert(blockToExpression(block)?.startsWith("any_of("));
  block.setFieldValue("NONE", "OP");
  assert(blockToExpression(block)?.startsWith("none_of("));
  workspace.dispose();
});

Deno.test("logic_cardinality serializes to at_least / at_most / exactly", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock(LOGIC_CARDINALITY_BLOCK);
  block.setFieldValue("MIN", "OP");
  const n = workspace.newBlock("math_number");
  n.setFieldValue("3", "NUM");
  block.getInput("N")!.connection!.connect(n.outputConnection!);
  const pred = workspace.newBlock("logic_boolean");
  pred.setFieldValue("TRUE", "BOOL");
  block.getInput("PRED")!.connection!.connect(pred.outputConnection!);
  const expr = blockToExpression(block)!;
  assert(expr.startsWith("at_least("), expr);
  assert(expr.includes(", 3, "), expr);
  block.setFieldValue("EXACTLY", "OP");
  assert(blockToExpression(block)?.startsWith("exactly("));
  workspace.dispose();
});

Deno.test("set operators serialize to intersection / union / difference", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const op = workspace.newBlock(LOGIC_SET_OPERATION_BLOCK);
  op.setFieldValue("AND", "OP");
  const a = workspace.newBlock("lists_create_with") as Blockly.Block & {
    itemCount_?: number;
    updateShape_?: () => void;
  };
  a.itemCount_ = 0;
  a.updateShape_?.();
  const b = workspace.newBlock("lists_create_with") as Blockly.Block & {
    itemCount_?: number;
    updateShape_?: () => void;
  };
  b.itemCount_ = 0;
  b.updateShape_?.();
  op.getInput("A")!.connection!.connect(a.outputConnection!);
  op.getInput("B")!.connection!.connect(b.outputConnection!);
  assertEquals(blockToExpression(op), "intersection(list(), list())");
  op.setFieldValue("OR", "OP");
  assertEquals(blockToExpression(op), "union(list(), list())");

  const notBlock = workspace.newBlock(LOGIC_SET_NOT_BLOCK);
  const set = workspace.newBlock("lists_create_with") as Blockly.Block & {
    itemCount_?: number;
    updateShape_?: () => void;
  };
  set.itemCount_ = 0;
  set.updateShape_?.();
  const universe = workspace.newBlock("lists_create_with") as Blockly.Block & {
    itemCount_?: number;
    updateShape_?: () => void;
  };
  universe.itemCount_ = 0;
  universe.updateShape_?.();
  notBlock.getInput("SET")!.connection!.connect(set.outputConnection!);
  notBlock.getInput("UNIVERSE")!.connection!.connect(universe.outputConnection!);
  assertEquals(blockToExpression(notBlock), "difference(list(), list())");
  workspace.dispose();
});

Deno.test("logic_compare serializes so restriction predicates can use it", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const cmp = workspace.newBlock("logic_compare");
  cmp.setFieldValue("EQ", "OP");
  const left = workspace.newBlock("text");
  left.setFieldValue("Cat", "TEXT");
  const right = workspace.newBlock("text");
  right.setFieldValue("Cat", "TEXT");
  cmp.getInput("A")!.connection!.connect(left.outputConnection!);
  cmp.getInput("B")!.connection!.connect(right.outputConnection!);
  assertEquals(blockToExpression(cmp), 'eq("Cat", "Cat")');
  workspace.dispose();
});
