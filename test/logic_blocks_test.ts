import { assert, assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import "blockly/blocks";
import {
  initBlocklyGenerators,
  blockToExpression,
} from "@intehrgrator/blockly/mod.ts";
import { astToExpressionBlock } from "@intehrgrator/blockly/expression_serialize.ts";
import { isSourceQueryBlockType } from "@intehrgrator/blockly/source_query.ts";
import { parseExpression } from "@intehrgrator/core/expression/mod.ts";
import { buildDemoToolbox, toolboxBlockTypes } from "@intehrgrator/blockly/toolbox_demo.ts";
import { msg } from "@intehrgrator/blockly/i18n/custom_msg.ts";
import {
  LISTS_SET_OPERATION_BLOCK,
  LOGIC_CURRENT_ITEM_BLOCK,
  LOGIC_LIST_RESTRICTION_BLOCK,
  restrictionItemName,
  restrictionRequiresItems,
} from "@intehrgrator/blockly/blocks/logic_blocks.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

type MutableList = Blockly.Block & {
  itemCount_?: number;
  updateShape_?: () => void;
};

type RestrictionBlock = Blockly.Block & {
  updateItemRow_: (show: boolean) => void;
  onchange?: (event: { type?: string }) => void;
};

function listOf(workspace: Blockly.Workspace, ...values: number[]): Blockly.Block {
  const list = workspace.newBlock("lists_create_with") as MutableList;
  list.itemCount_ = values.length;
  list.updateShape_?.();
  values.forEach((value, index) => {
    const number = workspace.newBlock("math_number");
    number.setFieldValue(String(value), "NUM");
    list.getInput(`ADD${index}`)!.connection!.connect(number.outputConnection!);
  });
  return list;
}

/** `⟨op⟩ of ⟨list⟩ match true`, the shape most of these tests need. */
function restrictionOverEmptyList(workspace: Blockly.Workspace, op: string): RestrictionBlock {
  const block = workspace.newBlock(LOGIC_LIST_RESTRICTION_BLOCK) as RestrictionBlock;
  block.setFieldValue(op, "OP");
  block.getInput("LIST")!.connection!.connect(listOf(workspace).outputConnection!);
  const pred = workspace.newBlock("logic_boolean");
  pred.setFieldValue("TRUE", "BOOL");
  block.getInput("PRED")!.connection!.connect(pred.outputConnection!);
  return block;
}

Deno.test("list logic blocks are registered and split across Logic and Lists drawers", () => {
  ensure();
  for (const type of [
    LOGIC_LIST_RESTRICTION_BLOCK,
    LOGIC_CURRENT_ITEM_BLOCK,
    LISTS_SET_OPERATION_BLOCK,
  ]) {
    assert(Blockly.Blocks[type], `missing block ${type}`);
  }
  const labels = msg("en");
  const toolbox = buildDemoToolbox("en") as {
    contents: Array<{ name?: string; contents?: Array<{ type?: string }> }>;
  };
  const drawer = (name: string) =>
    (toolbox.contents.find((c) => c.name === name)?.contents ?? []).map((b) => b.type);

  const logic = drawer(labels.CAT_LOGIC);
  assert(logic.includes(LOGIC_LIST_RESTRICTION_BLOCK));
  assert(logic.includes(LOGIC_CURRENT_ITEM_BLOCK));
  // A Boolean drawer must not offer the list-valued set operator alongside `and`/`or`.
  assert(!logic.includes(LISTS_SET_OPERATION_BLOCK));

  assert(drawer(labels.CAT_LISTS_AND_MAPS).includes(LISTS_SET_OPERATION_BLOCK));
  assert(toolboxBlockTypes(toolbox).includes(LOGIC_LIST_RESTRICTION_BLOCK));
});

Deno.test("quantifier restrictions serialize to all_of / any_of / none_of", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const block = restrictionOverEmptyList(workspace, "ALL");
  assertEquals(blockToExpression(block), 'all_of(list(), "item", true)');
  block.setFieldValue("ANY", "OP");
  assertEquals(blockToExpression(block), 'any_of(list(), "item", true)');
  block.setFieldValue("NONE", "OP");
  assertEquals(blockToExpression(block), 'none_of(list(), "item", true)');
  workspace.dispose();
});

Deno.test("counting restrictions add a threshold field and emit at_least / at_most / exactly", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const block = restrictionOverEmptyList(workspace, "ALL");
  assertEquals(block.getField("N"), null, "quantifiers have no threshold field");

  block.setFieldValue("AT_LEAST", "OP");
  assert(block.getField("N"), "counting operators show a threshold field");
  block.setFieldValue(3, "N");
  assertEquals(blockToExpression(block), 'at_least(list(), 3, "item", true)');
  block.setFieldValue("AT_MOST", "OP");
  assertEquals(blockToExpression(block), 'at_most(list(), 3, "item", true)');
  block.setFieldValue("EXACTLY", "OP");
  assertEquals(blockToExpression(block), 'exactly(list(), 3, "item", true)');

  block.setFieldValue("ALL", "OP");
  assertEquals(block.getField("N"), null, "the threshold goes away with the quantifiers");
  block.setFieldValue("EXACTLY", "OP");
  assertEquals(blockToExpression(block), 'exactly(list(), 3, "item", true)', "threshold is kept");
  workspace.dispose();
});

Deno.test("the empty-list guard is offered only where the operator holds vacuously", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const block = restrictionOverEmptyList(workspace, "ALL");
  for (const op of ["ALL", "NONE", "AT_MOST"]) {
    block.setFieldValue(op, "OP");
    assert(block.getInput("EMPTY"), `${op} is true on an empty list, so it needs the guard`);
  }
  for (const op of ["ANY", "AT_LEAST", "EXACTLY"]) {
    block.setFieldValue(op, "OP");
    assertEquals(block.getInput("EMPTY"), null, `${op} already excludes the empty list`);
  }
  workspace.dispose();
});

Deno.test("require at least one item excludes the empty list without a new builtin", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const block = restrictionOverEmptyList(workspace, "ALL");
  assertEquals(restrictionRequiresItems(block), false, "unchecked by default: plain all_of");
  assertEquals(blockToExpression(block), 'all_of(list(), "item", true)');

  block.setFieldValue(true, "NONEMPTY");
  assertEquals(restrictionRequiresItems(block), true);
  assertEquals(
    blockToExpression(block),
    'and(any_of(list(), "item", true), all_of(list(), "item", true))',
  );

  block.setFieldValue("AT_MOST", "OP");
  block.setFieldValue(2, "N");
  assertEquals(
    blockToExpression(block),
    'and(any_of(list(), "item", true), at_most(list(), 2, "item", true))',
  );

  // Switching to an operator that cannot be vacuously true drops the guard.
  block.setFieldValue("ANY", "OP");
  assertEquals(restrictionRequiresItems(block), false);
  assertEquals(blockToExpression(block), 'any_of(list(), "item", true)');
  workspace.dispose();
});

Deno.test("the item name is hidden by default and no workspace variable is created", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock(LOGIC_LIST_RESTRICTION_BLOCK) as RestrictionBlock;
  assertEquals(block.getInput("ITEM"), null);
  assertEquals(restrictionItemName(block), "item");
  assertEquals(workspace.getAllVariables().length, 0);

  block.updateItemRow_(true);
  assert(block.getInput("ITEM"), "naming the item adds a row");
  block.setFieldValue("pet", "VAR");
  assertEquals(restrictionItemName(block), "pet");
  assertEquals(workspace.getAllVariables().length, 0, "the binder is not a workspace variable");

  block.updateItemRow_(false);
  assertEquals(block.getInput("ITEM"), null);
  assertEquals(restrictionItemName(block), "pet", "hiding the row keeps the name");
  workspace.dispose();
});

Deno.test("this item resolves to the nearest enclosing restriction", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const outer = workspace.newBlock(LOGIC_LIST_RESTRICTION_BLOCK) as RestrictionBlock;
  const item = workspace.newBlock(LOGIC_CURRENT_ITEM_BLOCK);
  assertEquals(blockToExpression(item), 'var("item")', "unattached falls back to the default");

  const cmp = workspace.newBlock("logic_compare");
  cmp.getInput("A")!.connection!.connect(item.outputConnection!);
  outer.getInput("PRED")!.connection!.connect(cmp.outputConnection!);
  outer.updateItemRow_(true);
  outer.setFieldValue("pet", "VAR");
  assertEquals(blockToExpression(item), 'var("pet")');
  workspace.dispose();
});

Deno.test("nesting a restriction reveals both item names and keeps them distinct", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const outer = workspace.newBlock(LOGIC_LIST_RESTRICTION_BLOCK) as RestrictionBlock;
  const inner = workspace.newBlock(LOGIC_LIST_RESTRICTION_BLOCK) as RestrictionBlock;
  outer.getInput("PRED")!.connection!.connect(inner.outputConnection!);
  inner.onchange?.({ type: "move" });

  assert(outer.getInput("ITEM"), "the outer item gets a name row");
  assert(inner.getInput("ITEM"), "the inner item gets a name row");
  assertEquals(restrictionItemName(outer), "item");
  assertEquals(restrictionItemName(inner), "item2", "the inner name must not shadow the outer");

  const item = workspace.newBlock(LOGIC_CURRENT_ITEM_BLOCK);
  const cmp = workspace.newBlock("logic_compare");
  cmp.getInput("A")!.connection!.connect(item.outputConnection!);
  inner.getInput("PRED")!.connection!.connect(cmp.outputConnection!);
  assertEquals(blockToExpression(item), 'var("item2")', "this item means the innermost binder");
  item.setFieldValue("item", "VAR");
  assertEquals(blockToExpression(item), 'var("item")', "outer items stay reachable by name");
  workspace.dispose();
});

Deno.test("set operator serializes to intersection / union / difference in reading order", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const op = workspace.newBlock(LISTS_SET_OPERATION_BLOCK);
  op.getInput("A")!.connection!.connect(listOf(workspace).outputConnection!);
  op.getInput("B")!.connection!.connect(listOf(workspace, 1).outputConnection!);

  op.setFieldValue("BOTH", "OP");
  assertEquals(blockToExpression(op), "intersection(list(), list(1))");
  op.setFieldValue("EITHER", "OP");
  assertEquals(blockToExpression(op), "union(list(), list(1))");
  // "items in A but not in B" reads left to right, so A is the first argument.
  op.setFieldValue("NOT_IN", "OP");
  assertEquals(blockToExpression(op), "difference(list(), list(1))");
  workspace.dispose();
});

Deno.test("threshold, guard, item name and set connector survive a save and load", () => {
  ensure();
  const labels = msg("en");
  const source = new Blockly.Workspace();
  const restriction = source.newBlock(LOGIC_LIST_RESTRICTION_BLOCK) as RestrictionBlock;
  restriction.setFieldValue("AT_MOST", "OP");
  restriction.setFieldValue(2, "N");
  restriction.setFieldValue(true, "NONEMPTY");
  restriction.updateItemRow_(true);
  restriction.setFieldValue("pet", "VAR");
  const setOp = source.newBlock(LISTS_SET_OPERATION_BLOCK);
  setOp.setFieldValue("NOT_IN", "OP");
  const states = [
    Blockly.serialization.blocks.save(restriction)!,
    Blockly.serialization.blocks.save(setOp)!,
  ];
  source.dispose();

  const target = new Blockly.Workspace();
  const [loadedRestriction, loadedSetOp] = states.map((state) =>
    Blockly.serialization.blocks.append(state, target)
  );
  assertEquals(loadedRestriction.getFieldValue("OP"), "AT_MOST");
  assertEquals(Number(loadedRestriction.getFieldValue("N")), 2);
  assertEquals(restrictionRequiresItems(loadedRestriction), true, "the guard comes back ticked");
  assert(loadedRestriction.getInput("ITEM"), "the name row comes back");
  assertEquals(restrictionItemName(loadedRestriction), "pet");
  assertEquals(loadedSetOp.getField("CONN")?.getText(), labels.LOGIC_SET_CONN_NOT_IN);
  target.dispose();
});

Deno.test("restrictions and set operators round-trip from a Mapping Expression", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const build = (expr: string) =>
    astToExpressionBlock(
      workspace,
      parseExpression(expr),
      "boolean",
      (block) => block,
    ) as unknown as Blockly.Block;

  for (
    const expr of [
      'all_of(xpathNode("$.pets"), "pet", eq(xpathString("type"), "Cat"))',
      'none_of(xpathNode("$.pets"), "item", eq(xpathString("type"), "Snake"))',
      'exactly(xpathNode("$.pets"), 2, "pet", eq(xpathString("type"), "Cat"))',
    ]
  ) {
    const block = build(expr);
    assertEquals(block.type, LOGIC_LIST_RESTRICTION_BLOCK);
    assertEquals(blockToExpression(block), expr);
  }

  for (
    const expr of [
      'intersection(xpathNode("$.a"), xpathNode("$.b"))',
      'difference(xpathNode("$.a"), xpathNode("$.b"))',
    ]
  ) {
    const block = build(expr);
    assertEquals(block.type, LISTS_SET_OPERATION_BLOCK);
    assertEquals(blockToExpression(block), expr);
  }

  // A guarded restriction is one block, not a Boolean and of two restrictions.
  const guarded =
    'and(any_of(xpathNode("$.pets"), "pet", true), all_of(xpathNode("$.pets"), "pet", true))';
  const guardedBlock = build(guarded);
  assertEquals(guardedBlock.type, LOGIC_LIST_RESTRICTION_BLOCK);
  assertEquals(restrictionRequiresItems(guardedBlock), true);
  assertEquals(blockToExpression(guardedBlock), guarded);

  // An `and` over two different lists is a genuine Boolean operation.
  const plainAnd =
    'and(any_of(xpathNode("$.a"), "item", true), all_of(xpathNode("$.b"), "item", true))';
  assertEquals(build(plainAnd).type, "logic_operation");

  // `at least 0` has no checkbox to absorb the guard, so it must not collapse.
  const unguardable =
    'and(any_of(xpathNode("$.a"), "item", true), at_least(xpathNode("$.a"), 0, "item", true))';
  assertEquals(build(unguardable).type, "logic_operation");
  assertEquals(blockToExpression(build(unguardable)), unguardable);

  // The threshold is a field, so a computed one has to stay a raw expression.
  const computed = 'at_least(xpathNode("$.pets"), xpathNumber("$.n"), "pet", true)';
  const fallback = build(computed);
  assert(isSourceQueryBlockType(fallback.type), fallback.type);
  assertEquals(fallback.getFieldValue("EXPRESSION"), computed);
  workspace.dispose();
});

Deno.test("logic_compare serializes so restriction conditions can use it", () => {
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

Deno.test("lists_create_with of non-expression children does not fake list(false,…)", () => {
  // Regression: list() serialization must not swallow scaffolded DV_* shells
  // (coded-text / ordinal value sets) as false — TypeScript canvas codegen needs
  // null so it can emitListsCreate with new DV_CODED_TEXT.
  ensure();
  const workspace = new Blockly.Workspace();
  const list = workspace.newBlock("lists_create_with") as MutableList;
  list.itemCount_ = 2;
  list.updateShape_?.();
  const a = workspace.newBlock("text");
  a.setFieldValue("ok", "TEXT");
  list.getInput("ADD0")!.connection!.connect(a.outputConnection!);
  // Data-value shells are Mapping Spec structure, not Mapping Expressions.
  const shell = workspace.newBlock("dv_coded_text");
  shell.setFieldValue("DV_CODED_TEXT", "RM_TYPE");
  list.getInput("ADD1")!.connection!.connect(shell.outputConnection!);
  assertEquals(blockToExpression(list), null);
  workspace.dispose();
});
