import fontoxpath from "fontoxpath";
import type { SourceFormatId } from "../../types/mod.ts";
import type { ExprAst } from "../expression/mod.ts";
import { parseExpression } from "../expression/mod.ts";
import { renderHandlebars } from "../output/handlebars_dialect.ts";
import { DEFAULTS_MAP_NAME } from "../defaults/factory.ts";
import {
  executeEnvelopeParameters,
  parseJsonDocument,
  unwrapExecuteEnvelope,
} from "./json_document.ts";

export interface SourceContext {
  format: SourceFormatId;
  /** Runtime representation used by evaluators; adapter ids need not equal it. */
  kind: "json" | "xml";
  data: unknown;
  json?: unknown;
  xmlDocument?: Document;
  /** Loop variables (`for_each_source` VAR → current source node). */
  vars?: Record<string, unknown>;
  /** Named Maps (Defaults Map and others) for `maps_get`. */
  namedMaps?: Record<string, Record<string, unknown>>;
}

export function createSourceContext(
  content: string,
  format: SourceFormatId,
  kind: "json" | "xml" = format === "xml" ? "xml" : "json",
): SourceContext {
  if (kind === "json") {
    const parsed = parseJsonDocument(content);
    const json = unwrapExecuteEnvelope(parsed);
    const parameters = executeEnvelopeParameters(parsed);
    return {
      format,
      kind,
      data: json,
      json,
      ...(parameters ? { namedMaps: { [DEFAULTS_MAP_NAME]: parameters } } : {}),
    };
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
        case "xpathNode":
          return evalSourceNode(String(args[0] ?? ""), ctx);
        case "handlebars":
          return renderHandlebars(String(args[0] ?? ""), args[1] ?? {});
        case "map": {
          const record: Record<string, unknown> = {};
          for (let i = 0; i + 1 < args.length; i += 2) {
            record[String(args[i] ?? "")] = args[i + 1];
          }
          return record;
        }
        case "var":
          return ctx.vars?.[String(args[0])] ?? null;
        case "maps_get": {
          const mapName = String(args[0] ?? "defaults");
          const key = String(args[1] ?? "");
          const map = ctx.namedMaps?.[mapName];
          if (!map || typeof map !== "object") return null;
          return (map as Record<string, unknown>)[key] ?? null;
        }
      }
    }
  }
  return null;
}

/** Resolve a JSON authoring path to an array of nodes (`$.measurements`). */
export function collectJsonNodes(path: string, json: unknown): unknown[] {
  const raw = walkJsonSegments(json, parseJsonAuthoringPath(normalizeJsonAuthoringPath(path)));
  if (Array.isArray(raw)) return raw;
  if (raw === undefined || raw === null) return [];
  return [raw];
}

function normalizeJsonAuthoringPath(expr: string): string {
  const trimmed = expr.trim();
  if (!trimmed || trimmed.startsWith("$") || trimmed.startsWith("/")) return trimmed;
  return `$.${trimmed.replace(/^\./, "")}`;
}

function isRelativeJsonPath(expr: string): boolean {
  return expr.length > 0 && !expr.startsWith("$") && !expr.startsWith("/");
}

function xpathEval(expr: string, ctx: SourceContext, type: string): unknown {
  if (ctx.kind === "json") {
    const trimmed = expr.trim();
    const relative = isRelativeJsonPath(trimmed);
    const path = relative
      ? (trimmed === "." ? "$" : `$.${trimmed.replace(/^\./, "")}`)
      : trimmed;
    if (/\[\*\]/.test(path)) {
      return evalJsonWildcard(path, ctx.json);
    }
    if (relative) {
      return walkJsonSegments(ctx.json, parseJsonAuthoringPath(path));
    }
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

/**
 * Walk JSON `[*]` paths in document order so missing optional fields stay as
 * holes (`undefined`) instead of being dropped by an XPath sequence.
 */
function evalJsonWildcard(expr: string, json: unknown): unknown[] {
  const result = walkJsonSegments(json, parseJsonAuthoringPath(expr));
  return Array.isArray(result) ? result : result === undefined ? [] : [result];
}

function walkJsonSegments(
  node: unknown,
  segments: Array<string | number>,
): unknown {
  if (segments.length === 0) return node;
  const [head, ...rest] = segments;
  if (head === "*") {
    if (!Array.isArray(node)) return [];
    return node.map((item) => walkJsonSegments(item, rest));
  }
  if (node == null || typeof node !== "object") return undefined;
  if (typeof head === "number") {
    if (!Array.isArray(node)) return undefined;
    const index = head >= 1 ? head - 1 : head;
    return walkJsonSegments(node[index], rest);
  }
  return walkJsonSegments((node as Record<string, unknown>)[head], rest);
}

/** Convert authoring paths like `$.vitals[1].systolic` to XPath 3.1 map syntax. */
function toJsonXPath(expr: string): string {
  if (expr.startsWith("$source")) return expr;
  const segments = parseJsonAuthoringPath(expr);
  return segments.reduce<string>((query, segment) => {
    if (segment === "*") return `${query}?*`;
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
      } else if (token === "*") {
        segments.push("*");
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
  if (returnType === "node" || returnType === "source") return value;
  if (Array.isArray(value)) return value.map((item) => coerceReturn(item, returnType));
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

/** First node / subtree at a fontoxpath-authored path, as a Handlebars-friendly value. */
export function evalSourceNode(expr: string, ctx: SourceContext): unknown {
  const trimmed = expr.trim();
  if (ctx.kind === "json") {
    if (!trimmed || trimmed === "$" || trimmed === "." || trimmed === "/") {
      return ctx.json;
    }
    const nodes = collectJsonNodes(trimmed, ctx.json);
    return nodes.length <= 1 ? (nodes[0] ?? null) : nodes;
  }
  const documentNode = ctx.xmlDocument;
  if (!documentNode) return null;
  const path = !trimmed || trimmed === "$" || trimmed === "." ? "/" : trimmed;
  const node = fontoxpath.evaluateXPathToFirstNode(path, documentNode);
  return xmlNodeToJson(node as Node | null);
}

function xmlNodeToJson(node: Node | null): unknown {
  if (!node) return null;
  if (node.nodeType === Node.DOCUMENT_NODE) {
    return xmlNodeToJson((node as Document).documentElement);
  }
  if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
    const text = node.textContent?.trim();
    return text || undefined;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return undefined;
  const el = node as Element;
  const obj: Record<string, unknown> = {};
  for (const attr of Array.from(el.attributes)) {
    obj[`@${attr.name}`] = attr.value;
  }
  const childElements = Array.from(el.childNodes).filter(
    (child) => child.nodeType === Node.ELEMENT_NODE,
  ) as Element[];
  const text = Array.from(el.childNodes)
    .filter((child) =>
      child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE
    )
    .map((child) => child.textContent ?? "")
    .join("")
    .trim();
  if (!childElements.length) {
    if (!Object.keys(obj).length) return text;
    if (text) obj["#text"] = text;
    return obj;
  }
  const grouped = new Map<string, unknown[]>();
  for (const child of childElements) {
    const list = grouped.get(child.tagName) ?? [];
    list.push(xmlNodeToJson(child));
    grouped.set(child.tagName, list);
  }
  for (const [name, list] of grouped) {
    obj[name] = list.length === 1 ? list[0] : list;
  }
  if (text) obj["#text"] = text;
  return obj;
}
