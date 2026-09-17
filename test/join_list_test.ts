/**
 * #85 variant F substrate: grammatical list join via for_each_list index/length
 * plus a FIRST Decision table of VMS-Mustache snippets. Not a join_list builtin.
 */
import { assert, assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { javascriptGenerator } from "blockly/javascript";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import { blockToExpression } from "@intehrgrator/blockly/expression_serialize.ts";
import {
  LOGIC_LOOP_INDEX_BLOCK,
  LOGIC_LOOP_LENGTH_BLOCK,
} from "@intehrgrator/blockly/blocks/logic_blocks.ts";
import {
  evaluateDecisionTable,
  normalizeSheet,
} from "@intehrgrator/core/sheets/mod.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

const joinNames = normalizeSheet({
  name: "JoinNames",
  kind: "decision-table",
  hitPolicy: "FIRST",
  headers: ["first", "last", "snippet"],
  decisionColumns: [
    { role: "condition" },
    { role: "condition" },
    { role: "output", outputKind: "snippet" },
  ],
  values: [
    [true, "—", "{{name}}"],
    [false, false, ", {{name}}"],
    [false, true, " och {{name}}"],
  ],
});

function joinSwedish(names: string[]): string {
  const length = names.length;
  let result = "";
  for (let index = 0; index < length; index++) {
    result += String(
      evaluateDecisionTable(joinNames, {
        first: index === 0,
        last: index === length - 1,
        name: names[index],
      }, "snippet") ?? "",
    );
  }
  return result;
}

Deno.test("JoinNames FIRST snippets enumerate Anna, Bo och Carl", () => {
  assertEquals(joinSwedish([]), "");
  assertEquals(joinSwedish(["Only"]), "Only");
  assertEquals(joinSwedish(["Anna", "Bo"]), "Anna och Bo");
  assertEquals(joinSwedish(["Anna", "Bo", "Carl"]), "Anna, Bo och Carl");
});

Deno.test("index and length reporters serialize as loop binders, not workspace Variables", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const loop = workspace.newBlock("for_each_list");
  loop.setFieldValue("item", "VAR");
  const index = workspace.newBlock(LOGIC_LOOP_INDEX_BLOCK);
  const length = workspace.newBlock(LOGIC_LOOP_LENGTH_BLOCK);
  const eq = workspace.newBlock("logic_compare");
  eq.setFieldValue("EQ", "OP");
  eq.getInput("A")!.connection!.connect(index.outputConnection!);
  const zero = workspace.newBlock("math_number");
  zero.setFieldValue("0", "NUM");
  eq.getInput("B")!.connection!.connect(zero.outputConnection!);
  const iff = workspace.newBlock("controls_if");
  iff.getInput("IF0")!.connection!.connect(eq.outputConnection!);
  loop.getInput("DO")!.connection!.connect(iff.previousConnection!);

  assertEquals(blockToExpression(index), 'var("item_index")');
  assertEquals(blockToExpression(length), 'var("item_length")');
  assertEquals(blockToExpression(eq), 'eq(var("item_index"), 0)');
  assertEquals(workspace.getAllVariables().length, 0);
  workspace.dispose();
});

Deno.test("last is index = length − 1 from the enclosing for_each_list", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const loop = workspace.newBlock("for_each_list");
  loop.setFieldValue("names", "VAR");
  const cmp = workspace.newBlock("logic_compare");
  cmp.setFieldValue("EQ", "OP");
  const index = workspace.newBlock(LOGIC_LOOP_INDEX_BLOCK);
  const minus = workspace.newBlock("math_arithmetic");
  minus.setFieldValue("MINUS", "OP");
  const length = workspace.newBlock(LOGIC_LOOP_LENGTH_BLOCK);
  const one = workspace.newBlock("math_number");
  one.setFieldValue("1", "NUM");
  minus.getInput("A")!.connection!.connect(length.outputConnection!);
  minus.getInput("B")!.connection!.connect(one.outputConnection!);
  cmp.getInput("A")!.connection!.connect(index.outputConnection!);
  cmp.getInput("B")!.connection!.connect(minus.outputConnection!);
  const iff = workspace.newBlock("controls_if");
  iff.getInput("IF0")!.connection!.connect(cmp.outputConnection!);
  loop.getInput("DO")!.connection!.connect(iff.previousConnection!);

  assertEquals(blockToExpression(index), 'var("names_index")');
  assertEquals(blockToExpression(length), 'var("names_length")');
  assertEquals(blockToExpression(cmp), 'eq(var("names_index"), (var("names_length") - 1))');
  workspace.dispose();
});

Deno.test("for_each_list JS generator binds item, index, and length", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  javascriptGenerator.init(workspace);
  const loop = workspace.newBlock("for_each_list");
  loop.setFieldValue("item", "VAR");
  const list = workspace.newBlock("lists_create_with");
  loop.getInput("LIST")!.connection!.connect(list.outputConnection!);
  const code = javascriptGenerator.blockToCode(loop) as string;
  assert(code.includes('__vars["item"]'), code);
  assert(code.includes('__vars["item_index"]'), code);
  assert(code.includes('__vars["item_length"]'), code);
  workspace.dispose();
});

Deno.test("for_each_list inside a Function emits a statement loop, not an RM spread", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  javascriptGenerator.init(workspace);
  const def = workspace.newBlock("procedures_defreturn");
  const loop = workspace.newBlock("for_each_list");
  loop.setFieldValue("item", "VAR");
  const list = workspace.newBlock("lists_create_with") as Blockly.Block & {
    itemCount_?: number;
    updateShape_?: () => void;
  };
  list.itemCount_ = 3;
  list.updateShape_?.();
  ["Anna", "Bo", "Carl"].forEach((name, index) => {
    const text = workspace.newBlock("text");
    text.setFieldValue(name, "TEXT");
    list.getInput(`ADD${index}`)!.connection!.connect(text.outputConnection!);
  });
  loop.getInput("LIST")!.connection!.connect(list.outputConnection!);
  const stack = def.getInput("STACK") ?? def.getInput("STACK0");
  assert(stack, "procedures_defreturn has a statement stack");
  stack.connection!.connect(loop.previousConnection!);
  const code = javascriptGenerator.blockToCode(loop) as string;
  assertEquals(code.includes("..."), false, code);
  assert(code.includes("for ("), code);
  const after = new Function(
    "__vars",
    `${code}\nreturn { index: __vars["item_index"], length: __vars["item_length"], item: __vars["item"] };`,
  )({}) as { index: unknown; length: unknown; item: unknown };
  assertEquals(after, { index: 2, length: 3, item: "Carl" });
  workspace.dispose();
});
