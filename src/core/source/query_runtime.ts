import fontoxpath from "fontoxpath";
import type { SourceFormatId } from "../../types/mod.ts";
import type { ExprAst } from "../expression/mod.ts";
import { parseExpression } from "../expression/mod.ts";

export interface SourceContext {
  format: SourceFormatId;
  /** Runtime representation used by evaluators; adapter ids need not equal it. */
  kind: "json" | "xml";
  data: unknown;
  json?: unknown;
  xmlDocument?: Document;
}

export function createSourceContext(
  content: string,
  format: SourceFormatId,
  kind: "json" | "xml" = format === "xml" ? "xml" : "json",
): SourceContext {
  if (kind === "json") {
    const json = JSON.parse(content);
    return { format, kind, data: json, json };
  }
  const doc = new DOMParser().parseFromString(content, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Invalid XML source");
  return { format, kind, data: doc, xmlDocument: doc };
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
  if (ctx.kind === "json") {
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
  const segments = parseJsonAuthoringPath(expr);
  return segments.reduce<string>((query, segment) => {
    if (typeof segment === "number") return `${query}?${segment}`;
    if (/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(segment) && !segment.includes(".")) {
      return `${query}?${segment}`;
    }
    return `${query}?(${JSON.stringify(segment)})`;
  }, "$source");
}

function parseJsonAuthoringPath(expr: string): Array<string | number> {
  const source = expr.trim().replace(/^\$/, "");
  const segments: Array<string | number> = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "." || ch === "/") {
      i++;
      continue;
    }
    if (ch === "[") {
      const close = source.indexOf("]", i + 1);
      if (close < 0) throw new Error(`Invalid JSON source path: ${expr}`);
      const token = source.slice(i + 1, close).trim();
      if (/^\d+$/.test(token)) {
        segments.push(Number(token));
      } else if (
        (token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith("'") && token.endsWith("'"))
      ) {
        const normalized = token.startsWith("'")
          ? `"${token.slice(1, -1).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
          : token;
        segments.push(JSON.parse(normalized));
      } else {
        segments.push(token);
      }
      i = close + 1;
      continue;
    }
    let end = i;
    while (end < source.length && !".[/".includes(source[end]!)) end++;
    if (end > i) segments.push(source.slice(i, end));
    i = end;
  }
  return segments;
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
