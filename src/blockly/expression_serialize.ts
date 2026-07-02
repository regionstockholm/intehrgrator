import type { Block } from "blockly/core";
import type { ExprAst } from "../core/expression/mod.ts";
import { serialize } from "../core/expression/mod.ts";

export function blockToExpression(block: Block | null): string | null {
  if (!block) return null;

  switch (block.type) {
    case "source_query": {
      const expr = block.getFieldValue("EXPRESSION");
      const ret = block.getFieldValue("RETURN_TYPE") || "string";
      const fn = ret === "number"
        ? "xpathNumber"
        : ret === "boolean"
        ? "xpathBoolean"
        : "xpathString";
      return `${fn}(${JSON.stringify(expr)})`;
    }
    case "text_literal":
      return JSON.stringify(block.getFieldValue("TEXT") ?? "");
    case "number_literal":
      return String(block.getFieldValue("NUM") ?? 0);
    case "boolean_literal":
      return block.getFieldValue("BOOL") === "TRUE" ? "true" : "false";
    case "trim": {
      const inner = blockToExpression(block.getInputTargetBlock("TEXT"));
      return inner ? `trim(${inner})` : "trim(\"\")";
    }
    case "concat": {
      const a = blockToExpression(block.getInputTargetBlock("A"));
      const b = blockToExpression(block.getInputTargetBlock("B"));
      return `concat(${a ?? "\"\""}, ${b ?? "\"\""})`;
    }
    case "if_then_else": {
      const cond = blockToExpression(block.getInputTargetBlock("COND"));
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
    case "switch_case": {
      const parts: string[] = [];
      const discriminant = blockToExpression(block.getInputTargetBlock("DISCRIMINANT"));
      parts.push(discriminant ?? "\"\"");
      const count = block.caseCount_ ?? 1;
      for (let i = 0; i < count; i++) {
        const match = blockToExpression(block.getInputTargetBlock(`CASE_${i}_MATCH`));
        const out = blockToExpression(block.getInputTargetBlock(`CASE_${i}_OUT`));
        parts.push(match ?? "\"\"");
        parts.push(out ?? "null");
      }
      const defaultV = blockToExpression(block.getInputTargetBlock("DEFAULT"));
      parts.push(defaultV ?? "null");
      return `switch(${parts.join(", ")})`;
    }
    case "mapping_var_get":
      return `var(${JSON.stringify(block.getFieldValue("VAR") ?? "v")})`;
    default:
      return null;
  }
}

export function astToExpressionBlock(
  workspace: import("blockly/core").Workspace,
  ast: ExprAst,
  returnType: string,
  finalize: (block: import("blockly/core").BlockSvg) => import("blockly/core").BlockSvg,
): import("blockly/core").BlockSvg {
  if (ast.kind === "literal") {
    if (typeof ast.value === "number") {
      const block = workspace.newBlock("number_literal") as import("blockly/core").BlockSvg;
      block.setFieldValue(ast.value, "NUM");
      return finalize(block);
    }
    if (typeof ast.value === "boolean") {
      const block = workspace.newBlock("boolean_literal") as import("blockly/core").BlockSvg;
      block.setFieldValue(ast.value ? "TRUE" : "FALSE", "BOOL");
      return finalize(block);
    }
    if (typeof ast.value === "string") {
      const block = workspace.newBlock("text_literal") as import("blockly/core").BlockSvg;
      block.setFieldValue(ast.value, "TEXT");
      return finalize(block);
    }
    const block = workspace.newBlock("text_literal") as import("blockly/core").BlockSvg;
    block.setFieldValue(String(ast.value), "TEXT");
    return finalize(block);
  }

  if (ast.kind === "binary") {
    const block = workspace.newBlock("math_arithmetic") as import("blockly/core").BlockSvg;
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
        : "string";
      const block = workspace.newBlock("source_query") as import("blockly/core").BlockSvg;
      block.setFieldValue(xpath, "EXPRESSION");
      block.setFieldValue(ret, "RETURN_TYPE");
      return finalize(block);
    }
    if (ast.name === "trim" && ast.args[0]) {
      const block = workspace.newBlock("trim") as import("blockly/core").BlockSvg;
      const inner = astToExpressionBlock(workspace, ast.args[0], "string", finalize);
      block.getInput("TEXT")!.connection!.connect(inner.outputConnection!);
      return finalize(block);
    }
    if (ast.name === "concat" && ast.args.length >= 2) {
      const block = workspace.newBlock("concat") as import("blockly/core").BlockSvg;
      block.getInput("A")!.connection!.connect(
        astToExpressionBlock(workspace, ast.args[0], "string", finalize).outputConnection!,
      );
      block.getInput("B")!.connection!.connect(
        astToExpressionBlock(workspace, ast.args[1], "string", finalize).outputConnection!,
      );
      return finalize(block);
    }
    if (ast.name === "if" && ast.args.length >= 3) {
      const block = workspace.newBlock("if_then_else") as import("blockly/core").BlockSvg;
      block.getInput("COND")!.connection!.connect(
        astToExpressionBlock(workspace, ast.args[0], "boolean", finalize).outputConnection!,
      );
      block.getInput("THEN")!.connection!.connect(
        astToExpressionBlock(workspace, ast.args[1], returnType, finalize).outputConnection!,
      );
      block.getInput("ELSE")!.connection!.connect(
        astToExpressionBlock(workspace, ast.args[2], returnType, finalize).outputConnection!,
      );
      return finalize(block);
    }
    if (ast.name === "switch" && ast.args.length >= 2) {
      const block = workspace.newBlock("switch_case") as import("blockly/core").BlockSvg;
      const defaultArg = ast.args[ast.args.length - 1];
      const pairArgs = ast.args.slice(0, -1);
      const caseCount = Math.max(1, Math.floor((pairArgs.length - 1) / 2));
      block.caseCount_ = caseCount;
      block.rebuildCaseInputs_?.();
      block.getInput("DISCRIMINANT")!.connection!.connect(
        astToExpressionBlock(workspace, pairArgs[0], returnType, finalize).outputConnection!,
      );
      for (let i = 0; i < caseCount; i++) {
        const match = pairArgs[1 + i * 2];
        const out = pairArgs[2 + i * 2];
        if (match) {
          block.getInput(`CASE_${i}_MATCH`)!.connection!.connect(
            astToExpressionBlock(workspace, match, returnType, finalize).outputConnection!,
          );
        }
        if (out) {
          block.getInput(`CASE_${i}_OUT`)!.connection!.connect(
            astToExpressionBlock(workspace, out, returnType, finalize).outputConnection!,
          );
        }
      }
      block.getInput("DEFAULT")!.connection!.connect(
        astToExpressionBlock(workspace, defaultArg, returnType, finalize).outputConnection!,
      );
      return finalize(block);
    }
    if (ast.name === "var" && ast.args[0]?.kind === "literal") {
      const block = workspace.newBlock("mapping_var_get") as import("blockly/core").BlockSvg;
      block.setFieldValue(String(ast.args[0].value), "VAR");
      return finalize(block);
    }
  }

  const block = workspace.newBlock("source_query") as import("blockly/core").BlockSvg;
  block.setFieldValue(serialize(ast), "EXPRESSION");
  block.setFieldValue(returnType, "RETURN_TYPE");
  return finalize(block);
}
