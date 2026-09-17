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
  LOGIC_CURRENT_ITEM_BLOCK,
  LOGIC_LOOP_INDEX_BLOCK,
  LOGIC_LOOP_LENGTH_BLOCK,
} from "@intehrgrator/blockly/blocks/logic_blocks.ts";
import { MAPS_CREATE_WITH } from "@intehrgrator/core/defaults/extract.ts";
import {
  evaluateDecisionTable,
  normalizeSheet,
} from "@intehrgrator/core/sheets/mod.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  const anyMod = enMsg as { default?: Record<string, string> } & Record<string, string>;
  const table = anyMod.default && typeof anyMod.default === "object" ? anyMod.default : anyMod;
  Blockly.setLocale(table);
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

type MapCreateBlock = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

function plug(parent: Blockly.Block, input: string, child: Blockly.Block): void {
  const conn = parent.getInput(input)?.connection;
  if (!conn) throw new Error(`missing input ${input} on ${parent.type}`);
  if (child.outputConnection) conn.connect(child.outputConnection);
  else conn.connect(child.previousConnection!);
}

function namedVar(workspace: Blockly.Workspace, name: string, id?: string) {
  return workspace.getVariable(name) ?? workspace.createVariable(name, undefined, id);
}

function varGet(workspace: Blockly.Workspace, name: string, id?: string): Blockly.Block {
  const block = workspace.newBlock("variables_get");
  block.setFieldValue(namedVar(workspace, name, id).getId(), "VAR");
  return block;
}

function varSet(
  workspace: Blockly.Workspace,
  name: string,
  value: Blockly.Block,
  id?: string,
): Blockly.Block {
  const block = workspace.newBlock("variables_set");
  block.setFieldValue(namedVar(workspace, name, id).getId(), "VAR");
  plug(block, "VALUE", value);
  return block;
}

function textAppend(
  workspace: Blockly.Workspace,
  name: string,
  value: Blockly.Block,
  id?: string,
): Blockly.Block {
  const block = workspace.newBlock("text_append");
  block.setFieldValue(namedVar(workspace, name, id).getId(), "VAR");
  plug(block, "TEXT", value);
  return block;
}

function number(workspace: Blockly.Workspace, n: number): Blockly.Block {
  const block = workspace.newBlock("math_number");
  block.setFieldValue(String(n), "NUM");
  return block;
}

function eq(workspace: Blockly.Workspace, a: Blockly.Block, b: Blockly.Block): Blockly.Block {
  const cmp = workspace.newBlock("logic_compare");
  cmp.setFieldValue("EQ", "OP");
  plug(cmp, "A", a);
  plug(cmp, "B", b);
  return cmp;
}

function minus(workspace: Blockly.Workspace, a: Blockly.Block, b: Blockly.Block): Blockly.Block {
  const op = workspace.newBlock("math_arithmetic");
  op.setFieldValue("MINUS", "OP");
  plug(op, "A", a);
  plug(op, "B", b);
  return op;
}

function joinNamesLocals(workspace: Blockly.Workspace): Blockly.Block {
  const map = workspace.newBlock(MAPS_CREATE_WITH) as MapCreateBlock;
  map.itemCount_ = 3;
  map.updateShape_();
  map.setFieldValue("first", "KEY0");
  map.setFieldValue("last", "KEY1");
  map.setFieldValue("name", "KEY2");
  plug(map, "VAL0", eq(workspace, workspace.newBlock(LOGIC_LOOP_INDEX_BLOCK), number(workspace, 0)));
  plug(
    map,
    "VAL1",
    eq(
      workspace,
      workspace.newBlock(LOGIC_LOOP_INDEX_BLOCK),
      minus(workspace, workspace.newBlock(LOGIC_LOOP_LENGTH_BLOCK), number(workspace, 1)),
    ),
  );
  plug(map, "VAL2", workspace.newBlock(LOGIC_CURRENT_ITEM_BLOCK));
  return map;
}

function joinNamesEval(workspace: Blockly.Workspace): Blockly.Block {
  const table = workspace.newBlock("decision_table");
  table.setFieldValue("JoinNames", "NAME");
  table.setFieldValue("snippet", "OUTPUT");
  plug(table, "INPUTS", joinNamesLocals(workspace));
  return table;
}

/** Variant F: `to join_swedish(names)` loops and appends JoinNames snippets. */
function defineJoinSwedish(workspace: Blockly.Workspace): Blockly.Block {
  const def = Blockly.serialization.blocks.append({
    type: "procedures_defreturn",
    fields: { NAME: "join_swedish" },
    extraState: {
      params: [{ name: "names", id: "join_swedish_names" }],
      hasStatements: true,
    },
  }, workspace) as Blockly.Block;
  (def as { setStatements_?: (v: boolean) => void }).setStatements_?.(true);

  const empty = workspace.newBlock("text");
  empty.setFieldValue("", "TEXT");
  const init = varSet(workspace, "result", empty, "join_swedish_result");
  const loop = workspace.newBlock("for_each_list");
  loop.setFieldValue("item", "VAR");
  plug(loop, "LIST", varGet(workspace, "names", "join_swedish_names"));
  const append = textAppend(
    workspace,
    "result",
    joinNamesEval(workspace),
    "join_swedish_result",
  );
  loop.getInput("DO")!.connection!.connect(append.previousConnection!);
  init.nextConnection!.connect(loop.previousConnection!);
  const stack = def.getInput("STACK") ?? def.getInput("STACK0");
  if (!stack?.connection) throw new Error("join_swedish needs a statement stack");
  stack.connection.connect(init.previousConnection!);
  const ret = def.getInput("RETURN") ?? def.getInput("VALUE");
  if (!ret?.connection) throw new Error("join_swedish needs a return socket");
  ret.connection.connect(varGet(workspace, "result", "join_swedish_result").outputConnection!);
  return def;
}

function runJoinSwedish(code: string, names: string[]): string {
  const run = new Function(
    "decisionTable",
    `"use strict";
    const __vars = {};
    ${code}
    return join_swedish(${JSON.stringify(names)});`,
  ) as (
    decisionTable: (name: string, inputs: Record<string, unknown>, output?: string) => unknown,
  ) => unknown;
  return String(run((name, inputs, output) => {
    if (name !== "JoinNames") throw new Error(`unexpected table ${name}`);
    return evaluateDecisionTable(joinNames, inputs, output);
  }) ?? "");
}

Deno.test("join_swedish Function + JoinNames loop enumerates Anna, Bo och Carl", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  defineJoinSwedish(workspace);
  javascriptGenerator.init(workspace);
  const code = javascriptGenerator.workspaceToCode(workspace);
  assert(code.includes("function join_swedish"), code);
  assert(code.includes("for ("), code);
  assertEquals(code.includes("..."), false, code);
  assertEquals(runJoinSwedish(code, []), "");
  assertEquals(runJoinSwedish(code, ["Only"]), "Only");
  assertEquals(runJoinSwedish(code, ["Anna", "Bo"]), "Anna och Bo");
  assertEquals(runJoinSwedish(code, ["Anna", "Bo", "Carl"]), "Anna, Bo och Carl");
  workspace.dispose();
});
