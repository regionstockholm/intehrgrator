/**
 * #85 variant F: grammatical list join as a Blockly Function that loops,
 * appends JoinNames FIRST snippets, and is called from a slot. Not a join_list builtin.
 */
import { assert, assertEquals } from "@std/assert";
import * as enMsg from "blockly/msg/en";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { javascriptGenerator } from "blockly/javascript";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import { blockToExpression } from "@intehrgrator/blockly/expression_serialize.ts";
import {
  LOGIC_LOOP_INDEX_BLOCK,
  LOGIC_LOOP_LENGTH_BLOCK,
} from "@intehrgrator/blockly/blocks/logic_blocks.ts";
import { defineJoinSwedish, grammaticalJoinTable, JOIN_SWEDISH_SPEC } from "@intehrgrator/blockly/grammatical_join.ts";
import { evaluateDecisionTable } from "@intehrgrator/core/sheets/mod.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  const anyMod = enMsg as { default?: Record<string, string> } & Record<string, string>;
  const table = anyMod.default && typeof anyMod.default === "object" ? anyMod.default : anyMod;
  Blockly.setLocale(table);
  initBlocklyGenerators();
  ready = true;
}

const joinNames = grammaticalJoinTable(JOIN_SWEDISH_SPEC);

function joinSwedish(names: string[]): string {
  const length = names.length;
  let result = "";
  for (let index = 0; index < length; index++) {
    result += String(
      evaluateDecisionTable(joinNames, {
        first: index === 0,
        last: index === length - 1,
        word: names[index],
      }, "snippet") ?? "",
    );
  }
  return result;
}

Deno.test("SweJoinWords FIRST snippets enumerate Anna, Bo och Carl", () => {
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

function runJoinSwedish(code: string, names: string[]): string {
  const run = new Function(
    "decisionTable",
    `"use strict";
    const __vars = {};
    ${code}
    return join_swedish_words(${JSON.stringify(names)});`,
  ) as (
    decisionTable: (name: string, inputs: Record<string, unknown>, output?: string) => unknown,
  ) => unknown;
  return String(run((name, inputs, output) => {
    if (name !== "SweJoinWords") throw new Error(`unexpected table ${name}`);
    return evaluateDecisionTable(joinNames, inputs, output);
  }) ?? "");
}

Deno.test("join_swedish_words Function + SweJoinWords loop enumerates Anna, Bo och Carl", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const def = defineJoinSwedish(workspace);
  assertEquals(def.getCommentText()?.includes("list_of_words"), true);
  assertEquals(def.getCommentText()?.includes("joined_words"), true);
  javascriptGenerator.init(workspace);
  const code = javascriptGenerator.workspaceToCode(workspace);
  assert(code.includes("function join_swedish_words"), code);
  assert(code.includes("for ("), code);
  assertEquals(code.includes("..."), false, code);
  assertEquals(runJoinSwedish(code, []), "");
  assertEquals(runJoinSwedish(code, ["Only"]), "Only");
  assertEquals(runJoinSwedish(code, ["Anna", "Bo"]), "Anna och Bo");
  assertEquals(runJoinSwedish(code, ["Anna", "Bo", "Carl"]), "Anna, Bo och Carl");
  workspace.dispose();
});
