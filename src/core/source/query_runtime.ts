import fontoxpath from "fontoxpath";
import type { SourceFormatId } from "../../types/mod.ts";
import type { ExprAst } from "../expression/mod.ts";
import { parseExpression } from "../expression/mod.ts";

export interface SourceContext {
  format: SourceFormatId;
  json?: unknown;
  xmlDocument?: Document;
}

export function createSourceContext(content: string, format: SourceFormatId): SourceContext {
  if (format === "json") {
    return { format, json: JSON.parse(content) };
  }
  const doc = new DOMParser().parseFromString(content, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Invalid XML source");
  return { format, xmlDocument: doc };
}

export function evaluate(
  expression: string,
  ctx: SourceContext,
  returnType: string,
): unknown {
  const ast = parseExpression(expression);
  const value = evalAst(ast, ctx);
  return coerceReturn(value, returnType);
}

function evalAst(ast: ExprAst, ctx: SourceContext): unknown {
  switch (ast.kind) {
    case "literal":
      return ast.value;
    case "binary": {
      const left = Number(evalAst(ast.left, ctx));
      const right = Number(evalAst(ast.right, ctx));
      switch (ast.op) {
        case "+": return left + right;
        case "-": return left - right;
        case "*": return left * right;
        case "/": return right === 0 ? null : left / right;
      }
      break;
    }
    case "call": {
      const args = ast.args.map((a) => evalAst(a, ctx));
      switch (ast.name) {
        case "trim":
          return String(args[0] ?? "").trim();
        case "concat":
          return args.map(String).join("");
        case "if":
          return args[0] ? args[1] : args[2];
        case "xpath":
        case "xpathString":
          return xpathEval(String(args[0] ?? ""), ctx, "string");
        case "xpathNumber":
          return xpathEval(String(args[0] ?? ""), ctx, "number");
        case "xpathBoolean":
          return xpathEval(String(args[0] ?? ""), ctx, "boolean");
      }
    }
  }
  return null;
}

function xpathEval(expr: string, ctx: SourceContext, type: string): unknown {
  if (ctx.format === "json") {
    const query = toJsonXPath(expr);
    const variables = { source: ctx.json };
    switch (type) {
      case "number":
        return fontoxpath.evaluateXPathToNumber(query, null, null, variables);
      case "boolean":
        return fontoxpath.evaluateXPathToBoolean(query, null, null, variables);
      default:
        return fontoxpath.evaluateXPathToString(query, null, null, variables);
    }
  }

  const node = ctx.xmlDocument!;
  switch (type) {
    case "number":
      return fontoxpath.evaluateXPathToNumber(expr, node);
    case "boolean":
      return fontoxpath.evaluateXPathToBoolean(expr, node);
    case "string":
      return fontoxpath.evaluateXPathToString(expr, node);
    default:
      return fontoxpath.evaluateXPathToString(expr, node);
  }
}

/** Convert authoring paths like `$.vitals[1].systolic` to XPath 3.1 map syntax. */
function toJsonXPath(expr: string): string {
  if (expr.startsWith("$source")) return expr;
  let q = expr.trim();
  if (q.startsWith("$.")) q = q.slice(2);
  else if (q.startsWith("/")) q = q.slice(1);
  q = q.replace(/\//g, "?").replace(/\./g, "?").replace(/\[(\d+)\]/g, "?$1");
  return `$source?${q}`;
}

function coerceReturn(value: unknown, returnType: string): unknown {
  if (value === null || value === undefined) return value;
  switch (returnType) {
    case "number":
      return Number(value);
    case "boolean":
      return Boolean(value);
    default:
      return String(value);
  }
}
