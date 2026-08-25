import type { Block } from "blockly/core";
import type { ExprAst } from "../core/expression/mod.ts";
import { serialize } from "../core/expression/mod.ts";
import {
  createSourceQueryBlock,
  returnTypeFromSourceBlock,
  xpathEvaluatorForReturnType,
} from "./source_query.ts";
import { createMapsGetBlock, registerMapBlocks } from "./blocks/map_blocks.ts";

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
  }

  return finalize(createSourceQueryBlock(workspace, serialize(ast), returnType));
}
