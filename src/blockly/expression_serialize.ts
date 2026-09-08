import type { Block } from "blockly/core";
import type { ExprAst } from "../core/expression/mod.ts";
import { serialize } from "../core/expression/mod.ts";
import {
  createSourceQueryBlock,
  returnTypeFromSourceBlock,
  xpathEvaluatorForReturnType,
} from "./source_query.ts";
import { createMapsGetBlock, registerMapBlocks } from "./blocks/map_blocks.ts";
import {
  callToCardinalityOp,
  callToQuantifyOp,
  cardinalityOpToCall,
  LOGIC_CARDINALITY_BLOCK,
  LOGIC_QUANTIFY_BLOCK,
  LOGIC_SET_NOT_BLOCK,
  LOGIC_SET_OPERATION_BLOCK,
  quantifyOpToCall,
  registerLogicBlocks,
  variableFieldName,
} from "./blocks/logic_blocks.ts";

type BlockSvg = import("blockly/core").BlockSvg;
type Workspace = import("blockly/core").Workspace;

export function blockToExpression(block: Block | null): string | null {
  if (!block) return null;

  switch (block.type) {
    case "source_query":
    case "source_query_number":
    case "source_query_boolean":
    case "source_query_node": {
      const expr = block.getFieldValue("EXPRESSION");
      const fn = xpathEvaluatorForReturnType(returnTypeFromSourceBlock(block));
      return `${fn}(${JSON.stringify(expr)})`;
    }
    // Stock Blockly literals / ops
    case "text":
    case "text_code":
      return JSON.stringify(block.getFieldValue("TEXT") ?? "");
    case "math_number":
      return String(block.getFieldValue("NUM") ?? 0);
    case "logic_boolean":
      return block.getFieldValue("BOOL") === "TRUE" ? "true" : "false";
    case "text_trim": {
      const inner = blockToExpression(block.getInputTargetBlock("TEXT"));
      return inner ? `trim(${inner})` : 'trim("")';
    }
    case "text_join": {
      const parts: string[] = [];
      for (let i = 0; i < (block.itemCount_ ?? 2); i++) {
        parts.push(blockToExpression(block.getInputTargetBlock(`ADD${i}`)) ?? '""');
      }
      if (parts.length === 0) return '""';
      if (parts.length === 1) return parts[0]!;
      return `concat(${parts.join(", ")})`;
    }
    case "logic_ternary": {
      const cond = blockToExpression(block.getInputTargetBlock("IF"));
      const thenV = blockToExpression(block.getInputTargetBlock("THEN"));
      const elseV = blockToExpression(block.getInputTargetBlock("ELSE"));
      return `if(${cond ?? "false"}, ${thenV ?? "null"}, ${elseV ?? "null"})`;
    }
    case "math_arithmetic": {
      const a = blockToExpression(block.getInputTargetBlock("A"));
      const b = blockToExpression(block.getInputTargetBlock("B"));
      const opMap: Record<string, "+" | "-" | "*" | "/"> = {
        ADD: "+",
        MINUS: "-",
        MULTIPLY: "*",
        DIVIDE: "/",
      };
      const op = opMap[block.getFieldValue("OP")] ?? "+";
      return `(${a ?? "0"} ${op} ${b ?? "0"})`;
    }
    case "variables_get": {
      const name = block.getField("VAR")?.getText() ?? "v";
      return `var(${JSON.stringify(name)})`;
    }
    case "maps_get": {
      const name = String(block.getFieldValue("NAME") || "defaults");
      const key = blockToExpression(block.getInputTargetBlock("KEY")) ?? '""';
      return `maps_get(${JSON.stringify(name)}, ${key})`;
    }
    case "sheet_get_cell": {
      const name = String(block.getFieldValue("NAME") || "Sheet1");
      const a1 = blockToExpression(block.getInputTargetBlock("A1")) ?? '"A1"';
      return `sheet_get_cell(${JSON.stringify(name)}, ${a1})`;
    }
    case "sheet_get_xy": {
      const name = String(block.getFieldValue("NAME") || "Sheet1");
      const x = blockToExpression(block.getInputTargetBlock("X")) ?? "0";
      const y = blockToExpression(block.getInputTargetBlock("Y")) ?? "0";
      return `sheet_get_xy(${JSON.stringify(name)}, ${x}, ${y})`;
    }
    case "sheet_get_row": {
      const name = String(block.getFieldValue("NAME") || "Sheet1");
      const y = blockToExpression(block.getInputTargetBlock("Y")) ?? "0";
      return `sheet_get_row(${JSON.stringify(name)}, ${y})`;
    }
    case "sheet_get_column": {
      const name = String(block.getFieldValue("NAME") || "Sheet1");
      const x = blockToExpression(block.getInputTargetBlock("X")) ?? "0";
      return `sheet_get_column(${JSON.stringify(name)}, ${x})`;
    }
    case "sheet_get_header": {
      const name = String(block.getFieldValue("NAME") || "Sheet1");
      const x = blockToExpression(block.getInputTargetBlock("X")) ?? "0";
      return `sheet_get_header(${JSON.stringify(name)}, ${x})`;
    }
    case "sheet_get_data": {
      const name = String(block.getFieldValue("NAME") || "Sheet1");
      return `sheet_get_data(${JSON.stringify(name)})`;
    }
    case "sheet_lookup": {
      const name = String(block.getFieldValue("NAME") || "Sheet1");
      const col = blockToExpression(block.getInputTargetBlock("MATCH_COL")) ?? '""';
      const val = blockToExpression(block.getInputTargetBlock("MATCH_VAL")) ?? '""';
      const ret = blockToExpression(block.getInputTargetBlock("RETURN_COL"));
      return ret
        ? `sheet_lookup(${JSON.stringify(name)}, ${col}, ${val}, ${ret})`
        : `sheet_lookup(${JSON.stringify(name)}, ${col}, ${val})`;
    }
    case "maps_create_empty":
      return "map()";
    case "maps_create_with": {
      const count = Number((block as Block & { itemCount_?: number }).itemCount_ ?? 0);
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        parts.push(JSON.stringify(block.getFieldValue(`KEY${i}`) ?? ""));
        parts.push(blockToExpression(block.getInputTargetBlock(`VAL${i}`)) ?? "null");
      }
      return `map(${parts.join(", ")})`;
    }
    case "text_handlebars": {
      const script = blockToExpression(block.getInputTargetBlock("SCRIPT")) ?? '""';
      const context = blockToExpression(block.getInputTargetBlock("CONTEXT")) ?? "map()";
      return `handlebars(${script}, ${context})`;
    }
    // Legacy custom block types (read-only for older workspaces)
    case "text_literal":
      return JSON.stringify(block.getFieldValue("TEXT") ?? "");
    case "number_literal":
      return String(block.getFieldValue("NUM") ?? 0);
    case "boolean_literal":
      return block.getFieldValue("BOOL") === "TRUE" ? "true" : "false";
    case "trim": {
      const inner = blockToExpression(block.getInputTargetBlock("TEXT"));
      return inner ? `trim(${inner})` : 'trim("")';
    }
    case "concat": {
      const a = blockToExpression(block.getInputTargetBlock("A"));
      const b = blockToExpression(block.getInputTargetBlock("B"));
      return `concat(${a ?? '""'}, ${b ?? '""'})`;
    }
    case "if_then_else": {
      const cond = blockToExpression(block.getInputTargetBlock("COND"));
      const thenV = blockToExpression(block.getInputTargetBlock("THEN"));
      const elseV = blockToExpression(block.getInputTargetBlock("ELSE"));
      return `if(${cond ?? "false"}, ${thenV ?? "null"}, ${elseV ?? "null"})`;
    }
    case "mapping_var_get":
      return `var(${JSON.stringify(block.getFieldValue("VAR") ?? "v")})`;
    case "logic_compare": {
      const a = blockToExpression(block.getInputTargetBlock("A")) ?? "false";
      const b = blockToExpression(block.getInputTargetBlock("B")) ?? "false";
      const opMap: Record<string, string> = {
        EQ: "eq",
        NEQ: "ne",
        LT: "lt",
        LTE: "le",
        GT: "gt",
        GTE: "ge",
      };
      const fn = opMap[String(block.getFieldValue("OP") ?? "EQ")] ?? "eq";
      return `${fn}(${a}, ${b})`;
    }
    case "logic_operation": {
      const a = blockToExpression(block.getInputTargetBlock("A")) ?? "false";
      const b = blockToExpression(block.getInputTargetBlock("B")) ?? "false";
      const fn = String(block.getFieldValue("OP") ?? "AND") === "OR" ? "or" : "and";
      return `${fn}(${a}, ${b})`;
    }
    case "logic_negate": {
      const inner = blockToExpression(block.getInputTargetBlock("BOOL")) ?? "false";
      return `not(${inner})`;
    }
    case "lists_create_with": {
      // Expression-path lists (DL quantifiers) need every item serializable.
      // Scaffolded coded-text / ordinal value-set lists hold DV_* shells that
      // are not Mapping Expressions — return null so TypeScript canvas codegen
      // falls through to emitListsCreate (new DV_CODED_TEXT / …).
      const count = Number((block as Block & { itemCount_?: number }).itemCount_ ?? 0);
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const child = block.getInputTargetBlock(`ADD${i}`);
        if (!child) {
          parts.push("null");
          continue;
        }
        const part = blockToExpression(child);
        if (part === null) return null;
        parts.push(part);
      }
      return `list(${parts.join(", ")})`;
    }
    case "logic_quantify": {
      const list = blockToExpression(block.getInputTargetBlock("LIST")) ?? "list()";
      const pred = blockToExpression(block.getInputTargetBlock("PRED")) ?? "true";
      const name = JSON.stringify(variableFieldName(block));
      const fn = quantifyOpToCall(String(block.getFieldValue("OP") ?? "ONLY"));
      return `${fn}(${list}, ${name}, ${pred})`;
    }
    case "logic_cardinality": {
      const list = blockToExpression(block.getInputTargetBlock("LIST")) ?? "list()";
      const n = blockToExpression(block.getInputTargetBlock("N")) ?? "0";
      const pred = blockToExpression(block.getInputTargetBlock("PRED")) ?? "true";
      const name = JSON.stringify(variableFieldName(block));
      const fn = cardinalityOpToCall(String(block.getFieldValue("OP") ?? "MIN"));
      return `${fn}(${list}, ${n}, ${name}, ${pred})`;
    }
    case "logic_set_operation": {
      const a = blockToExpression(block.getInputTargetBlock("A")) ?? "list()";
      const b = blockToExpression(block.getInputTargetBlock("B")) ?? "list()";
      const fn = String(block.getFieldValue("OP") ?? "AND") === "OR" ? "union" : "intersection";
      return `${fn}(${a}, ${b})`;
    }
    case "logic_set_not": {
      const set = blockToExpression(block.getInputTargetBlock("SET")) ?? "list()";
      const universe = blockToExpression(block.getInputTargetBlock("UNIVERSE")) ?? "list()";
      return `difference(${universe}, ${set})`;
    }
    default:
      return null;
  }
}

export function astToExpressionBlock(
  workspace: Workspace,
  ast: ExprAst,
  returnType: string,
  finalize: (block: BlockSvg) => BlockSvg,
): BlockSvg {
  if (ast.kind === "literal") {
    if (typeof ast.value === "number") {
      const block = workspace.newBlock("math_number") as BlockSvg;
      block.setFieldValue(ast.value, "NUM");
      return finalize(block);
    }
    if (typeof ast.value === "boolean") {
      const block = workspace.newBlock("logic_boolean") as BlockSvg;
      block.setFieldValue(ast.value ? "TRUE" : "FALSE", "BOOL");
      return finalize(block);
    }
    if (typeof ast.value === "string") {
      const block = workspace.newBlock("text") as BlockSvg;
      block.setFieldValue(ast.value, "TEXT");
      return finalize(block);
    }
    const block = workspace.newBlock("text") as BlockSvg;
    block.setFieldValue(String(ast.value), "TEXT");
    return finalize(block);
  }

  if (ast.kind === "binary") {
    const block = workspace.newBlock("math_arithmetic") as BlockSvg;
    const opMap: Record<string, string> = {
      "+": "ADD",
      "-": "MINUS",
      "*": "MULTIPLY",
      "/": "DIVIDE",
    };
    block.setFieldValue(opMap[ast.op] ?? "ADD", "OP");
    const left = astToExpressionBlock(workspace, ast.left, returnType, finalize);
    const right = astToExpressionBlock(workspace, ast.right, returnType, finalize);
    block.getInput("A")!.connection!.connect(left.outputConnection!);
    block.getInput("B")!.connection!.connect(right.outputConnection!);
    return finalize(block);
  }

  if (ast.kind === "call") {
    if (ast.name.startsWith("xpath")) {
      const xpathArg = ast.args[0];
      const xpath = xpathArg?.kind === "literal" && typeof xpathArg.value === "string"
        ? xpathArg.value
        : "";
      const ret = ast.name === "xpathNumber"
        ? "number"
        : ast.name === "xpathBoolean"
        ? "boolean"
        : ast.name === "xpathNode"
        ? "node"
        : "string";
      return finalize(createSourceQueryBlock(workspace, xpath, ret));
    }
    if (ast.name === "trim" && ast.args[0]) {
      const block = workspace.newBlock("text_trim") as BlockSvg;
      block.setFieldValue("BOTH", "MODE");
      const inner = astToExpressionBlock(workspace, ast.args[0], "string", finalize);
      block.getInput("TEXT")!.connection!.connect(inner.outputConnection!);
      return finalize(block);
    }
    if (ast.name === "concat" && ast.args.length >= 2) {
      const block = workspace.newBlock("text_join") as BlockSvg;
      // deno-lint-ignore no-explicit-any
      const join = block as any;
      join.itemCount_ = ast.args.length;
      join.updateShape_?.();
      for (let i = 0; i < ast.args.length; i++) {
        const child = astToExpressionBlock(workspace, ast.args[i]!, "string", finalize);
        block.getInput(`ADD${i}`)?.connection?.connect(child.outputConnection!);
      }
      return finalize(block);
    }
    if (ast.name === "if" && ast.args.length >= 3) {
      const block = workspace.newBlock("logic_ternary") as BlockSvg;
      block.getInput("IF")!.connection!.connect(
        astToExpressionBlock(workspace, ast.args[0]!, "boolean", finalize).outputConnection!,
      );
      block.getInput("THEN")!.connection!.connect(
        astToExpressionBlock(workspace, ast.args[1]!, returnType, finalize).outputConnection!,
      );
      block.getInput("ELSE")!.connection!.connect(
        astToExpressionBlock(workspace, ast.args[2]!, returnType, finalize).outputConnection!,
      );
      return finalize(block);
    }
    if (ast.name === "maps_get" && ast.args.length >= 2) {
      registerMapBlocks();
      const mapName = ast.args[0]?.kind === "literal" ? String(ast.args[0].value) : "defaults";
      const key = ast.args[1]?.kind === "literal" ? String(ast.args[1].value) : "";
      return finalize(createMapsGetBlock(workspace, mapName, key) as BlockSvg);
    }
    if (ast.name === "var" && ast.args[0]?.kind === "literal") {
      const name = String(ast.args[0].value);
      // deno-lint-ignore no-explicit-any
      const ws = workspace as any;
      let variable = ws.getVariable?.(name);
      if (!variable && typeof ws.createVariable === "function") {
        variable = ws.createVariable(name);
      }
      const block = workspace.newBlock("variables_get") as BlockSvg;
      if (variable) {
        block.setFieldValue(variable.getId(), "VAR");
      }
      return finalize(block);
    }
    if (
      ast.name === "eq" || ast.name === "ne" || ast.name === "lt" ||
      ast.name === "le" || ast.name === "gt" || ast.name === "ge"
    ) {
      const block = workspace.newBlock("logic_compare") as BlockSvg;
      const opMap: Record<string, string> = {
        eq: "EQ",
        ne: "NEQ",
        lt: "LT",
        le: "LTE",
        gt: "GT",
        ge: "GTE",
      };
      block.setFieldValue(opMap[ast.name] ?? "EQ", "OP");
      if (ast.args[0]) {
        block.getInput("A")!.connection!.connect(
          astToExpressionBlock(workspace, ast.args[0], returnType, finalize).outputConnection!,
        );
      }
      if (ast.args[1]) {
        block.getInput("B")!.connection!.connect(
          astToExpressionBlock(workspace, ast.args[1], returnType, finalize).outputConnection!,
        );
      }
      return finalize(block);
    }
    if (ast.name === "and" || ast.name === "or") {
      const block = workspace.newBlock("logic_operation") as BlockSvg;
      block.setFieldValue(ast.name === "or" ? "OR" : "AND", "OP");
      if (ast.args[0]) {
        block.getInput("A")!.connection!.connect(
          astToExpressionBlock(workspace, ast.args[0], "boolean", finalize).outputConnection!,
        );
      }
      if (ast.args[1]) {
        block.getInput("B")!.connection!.connect(
          astToExpressionBlock(workspace, ast.args[1], "boolean", finalize).outputConnection!,
        );
      }
      return finalize(block);
    }
    if (ast.name === "not" && ast.args[0]) {
      const block = workspace.newBlock("logic_negate") as BlockSvg;
      block.getInput("BOOL")!.connection!.connect(
        astToExpressionBlock(workspace, ast.args[0], "boolean", finalize).outputConnection!,
      );
      return finalize(block);
    }
    if (ast.name === "list") {
      const block = workspace.newBlock("lists_create_with") as BlockSvg;
      // deno-lint-ignore no-explicit-any
      const list = block as any;
      list.itemCount_ = ast.args.length;
      list.updateShape_?.();
      for (let i = 0; i < ast.args.length; i++) {
        const child = astToExpressionBlock(workspace, ast.args[i]!, returnType, finalize);
        block.getInput(`ADD${i}`)?.connection?.connect(child.outputConnection!);
      }
      return finalize(block);
    }
    if (ast.name === "all_of" || ast.name === "any_of" || ast.name === "none_of") {
      registerLogicBlocks();
      const block = workspace.newBlock(LOGIC_QUANTIFY_BLOCK) as BlockSvg;
      block.setFieldValue(callToQuantifyOp(ast.name), "OP");
      bindVariableField(workspace, block, ast.args[1]);
      if (ast.args[0]) {
        block.getInput("LIST")!.connection!.connect(
          astToExpressionBlock(workspace, ast.args[0], "node", finalize).outputConnection!,
        );
      }
      if (ast.args[2]) {
        block.getInput("PRED")!.connection!.connect(
          astToExpressionBlock(workspace, ast.args[2], "boolean", finalize).outputConnection!,
        );
      }
      return finalize(block);
    }
    if (ast.name === "at_least" || ast.name === "at_most" || ast.name === "exactly") {
      registerLogicBlocks();
      const block = workspace.newBlock(LOGIC_CARDINALITY_BLOCK) as BlockSvg;
      block.setFieldValue(callToCardinalityOp(ast.name), "OP");
      bindVariableField(workspace, block, ast.args[2]);
      if (ast.args[0]) {
        block.getInput("LIST")!.connection!.connect(
          astToExpressionBlock(workspace, ast.args[0], "node", finalize).outputConnection!,
        );
      }
      if (ast.args[1]) {
        block.getInput("N")!.connection!.connect(
          astToExpressionBlock(workspace, ast.args[1], "number", finalize).outputConnection!,
        );
      }
      if (ast.args[3]) {
        block.getInput("PRED")!.connection!.connect(
          astToExpressionBlock(workspace, ast.args[3], "boolean", finalize).outputConnection!,
        );
      }
      return finalize(block);
    }
    if (ast.name === "intersection" || ast.name === "union") {
      registerLogicBlocks();
      const block = workspace.newBlock(LOGIC_SET_OPERATION_BLOCK) as BlockSvg;
      block.setFieldValue(ast.name === "union" ? "OR" : "AND", "OP");
      if (ast.args[0]) {
        block.getInput("A")!.connection!.connect(
          astToExpressionBlock(workspace, ast.args[0], "node", finalize).outputConnection!,
        );
      }
      if (ast.args[1]) {
        block.getInput("B")!.connection!.connect(
          astToExpressionBlock(workspace, ast.args[1], "node", finalize).outputConnection!,
        );
      }
      return finalize(block);
    }
    if (ast.name === "difference") {
      registerLogicBlocks();
      const block = workspace.newBlock(LOGIC_SET_NOT_BLOCK) as BlockSvg;
      if (ast.args[1]) {
        block.getInput("SET")!.connection!.connect(
          astToExpressionBlock(workspace, ast.args[1], "node", finalize).outputConnection!,
        );
      }
      if (ast.args[0]) {
        block.getInput("UNIVERSE")!.connection!.connect(
          astToExpressionBlock(workspace, ast.args[0], "node", finalize).outputConnection!,
        );
      }
      return finalize(block);
    }
  }

  return finalize(createSourceQueryBlock(workspace, serialize(ast), returnType));
}

function bindVariableField(workspace: Workspace, block: BlockSvg, ast: ExprAst | undefined): void {
  const name = ast?.kind === "literal" ? String(ast.value) : "item";
  // deno-lint-ignore no-explicit-any
  const ws = workspace as any;
  let variable = ws.getVariable?.(name);
  if (!variable && typeof ws.createVariable === "function") {
    variable = ws.createVariable(name);
  }
  if (variable) block.setFieldValue(variable.getId(), "VAR");
}
