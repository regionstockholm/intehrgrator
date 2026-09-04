/**
 * TypeScript conversion-script generation (ehrtslib simplified constructors).
 *
 * Walks the Template Skeleton + Mapping Model expressions into nested
 * `new COMPOSITION({ ... })` / `rm(OBSERVATION, { ... })` trees. Blockly canvas
 * generation (optional RM, loops as they appear on the canvas) lives in
 * `src/blockly/typescript_codegen.ts` and replaces this adapter when a
 * workspace snapshot is available.
 *
 * Conversion Test Run(s) in Mapping preview still evaluate Mapping Model slots
 * through the Target instance format handler (ADR 0001 / ADR 0003). TypeScript
 * Output mode executes this script.
 */

import type { MappingLoop, MappingModel, MappingSlot, SkeletonNode } from "../../types/mod.ts";
import { parseExpression, type ExprAst } from "../expression/mod.ts";
import { isAutoFixedValueSlot, LOCATABLE_TYPES } from "../rm_mandatory.ts";
import { attributesFor } from "../rm_meta.ts";

/** RM classes whose constructors actually apply an init bag. */
const NATIVE_INIT_TYPES = new Set([
  "COMPOSITION",
  "CODE_PHRASE",
  "DV_TEXT",
  "DV_CODED_TEXT",
]);

const LIST_ATTRS = new Set([
  "content",
  "items",
  "events",
  "activities",
  "links",
  "participations",
  "other_participations",
]);

export interface TsEmitContext {
  sourceVar: string;
  /** When set, relative source paths evaluate against this loop node. */
  loopVar?: string;
  types: Set<string>;
  helpers: Set<"string" | "number" | "boolean" | "nodes" | "rm" | "node" | "handlebars" | "sheets">;
}

export function createTsEmitContext(sourceVar = "sourceCtx.data"): TsEmitContext {
  return { sourceVar, types: new Set(), helpers: new Set() };
}

export function emitTsExpression(ast: ExprAst, ctx: TsEmitContext): string {
  switch (ast.kind) {
    case "literal":
      if (typeof ast.value === "string") return JSON.stringify(ast.value);
      return String(ast.value);
    case "binary":
      return `(${emitTsExpression(ast.left, ctx)} ${ast.op} ${emitTsExpression(ast.right, ctx)})`;
    case "call": {
      const args = ast.args.map((a) => emitTsExpression(a, ctx));
      switch (ast.name) {
        case "trim":
          return `String(${args[0]} ?? "").trim()`;
        case "concat":
          return `[${args.join(", ")}].join("")`;
        case "if":
          return `(${args[0]} ? ${args[1]} : ${args[2]})`;
        case "switch":
          return emitSwitchTs(args);
        case "var":
          return `__vars[${args[0]}]`;
        case "maps_get":
          return emitMapsGet(ast, args);
        case "sheet_get_cell":
        case "sheet_get_xy":
        case "sheet_get_row":
        case "sheet_get_column":
        case "sheet_get_header":
        case "sheet_get_data":
        case "sheet_lookup":
          ctx.helpers.add("sheets");
          return emitSheetCall(ast.name, args);
        case "xpathNumber":
          ctx.helpers.add("number");
          return emitXpathCall("xpathNumber", ast.args[0], args[0] ?? '""', ctx);
        case "xpathBoolean":
          ctx.helpers.add("boolean");
          return emitXpathCall("xpathBoolean", ast.args[0], args[0] ?? '""', ctx);
        case "xpathNode":
          ctx.helpers.add("node");
          return emitXpathCall("xpathNode", ast.args[0], args[0] ?? '""', ctx);
        case "handlebars":
          ctx.helpers.add("handlebars");
          return `handlebars(${args[0] ?? '""'}, ${args[1] ?? "{}"})`;
        case "map":
          return emitMapLiteral(ast, args);
        case "xpath":
        case "xpathString":
          ctx.helpers.add("string");
          return emitXpathCall("xpathString", ast.args[0], args[0] ?? '""', ctx);
        default:
          ctx.helpers.add("string");
          return emitXpathCall("xpathString", ast.args[0], args[0] ?? '""', ctx);
      }
    }
  }
}

function emitMapsGet(ast: Extract<ExprAst, { kind: "call" }>, args: string[]): string {
  const mapArg = ast.args[0];
  const key = args[1] ?? '""';
  if (mapArg?.kind === "literal" && mapArg.value === "defaults") {
    return `defaults[${key}]`;
  }
  return `((${args[0]} === "defaults" ? defaults : {})[${key}])`;
}

function emitSheetCall(name: string, args: string[]): string {
  return `${jsName(name)}(${args.join(", ")})`;
}

function jsName(name: string): string {
  return name.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

function emitMapLiteral(
  ast: Extract<ExprAst, { kind: "call" }>,
  args: string[],
): string {
  const parts: string[] = [];
  for (let i = 0; i + 1 < args.length; i += 2) {
    const keyAst = ast.args[i];
    const key = keyAst?.kind === "literal" && typeof keyAst.value === "string"
      ? JSON.stringify(keyAst.value)
      : `[${args[i]}]`;
    parts.push(`${key}: ${args[i + 1]}`);
  }
  return `({ ${parts.join(", ")} })`;
}

function emitXpathCall(
  fn: string,
  pathAst: ExprAst | undefined,
  pathCode: string,
  ctx: TsEmitContext,
): string {
  const path = pathAst?.kind === "literal" ? String(pathAst.value).trim() : "";
  const relative = Boolean(path) && !path.startsWith("$") && !path.startsWith("/");
  const node = relative && ctx.loopVar ? ctx.loopVar : "sourceCtx.data";
  if (node === "sourceCtx.data") return `${fn}(${pathCode})`;
  return `${fn}(${pathCode}, ${node})`;
}

function emitSwitchTs(args: string[]): string {
  if (args.length < 2) return "null";
  const discriminant = args[0];
  const defaultV = args[args.length - 1];
  const pairs = args.slice(1, -1);
  let expr = defaultV ?? "null";
  for (let i = pairs.length - 2; i >= 0; i -= 2) {
    expr = `(${discriminant} === ${pairs[i]} ? ${pairs[i + 1]} : ${expr})`;
  }
  return expr;
}

export function emitTsExpressionSource(
  expression: string,
  ctx: TsEmitContext,
): string | null {
  const trimmed = expression.trim();
  if (!trimmed) return null;
  try {
    return emitTsExpression(parseExpression(trimmed), ctx);
  } catch {
    ctx.helpers.add("string");
    return emitXpathCall(
      "xpathString",
      { kind: "literal", value: trimmed },
      JSON.stringify(trimmed),
      ctx,
    );
  }
}

export interface TypeScriptModuleParts {
  templateId: string;
  body: string;
  types: Set<string>;
  helpers: Set<"string" | "number" | "boolean" | "nodes" | "rm" | "node" | "handlebars" | "sheets">;
  rootType?: string;
  /** Where the RM tree was walked from. */
  source?: "blockly" | "skeleton" | "slots";
}

export function wrapTypeScriptModule(parts: TypeScriptModuleParts): string {
  const types = [...parts.types].sort();
  const usesXpath = [...parts.helpers].some((h) =>
    h === "string" || h === "number" || h === "boolean" || h === "nodes" || h === "node"
  );
  const fonto: string[] = [];
  if (parts.helpers.has("string")) fonto.push("evaluateXPathToString");
  if (parts.helpers.has("number")) fonto.push("evaluateXPathToNumber");
  if (parts.helpers.has("boolean")) fonto.push("evaluateXPathToBoolean");
  if (parts.helpers.has("nodes")) fonto.push("evaluateXPathToNodes");
  if (parts.helpers.has("node")) fonto.push("evaluateXPathToFirstNode");

  const root = parts.rootType ?? (types.includes("COMPOSITION") ? "COMPOSITION" : "unknown");
  const lines: string[] = [
    "// Generated by intEHRgrator — Conversion Script (TypeScript / ehrtslib)",
    `// Template: ${parts.templateId || "(none)"}`,
    parts.source === "blockly"
      ? "// Source: Blockly canvas (regenerated when the mapping editor changes)"
      : parts.source === "skeleton"
      ? "// Source: Template Skeleton + Mapping Model expressions"
      : "// Source: Mapping Model slots (no canvas / skeleton available)",
    "// Mapping preview Test Run evaluates Mapping Model slots through the Target",
    "// instance format handler (ADR 0001). TypeScript Output mode executes this script.",
    "",
  ];
  if (types.length) {
    lines.push(`import {`);
    for (const t of types) lines.push(`  ${t},`);
    lines.push(`} from "ehrtslib/openehr_rm.ts";`);
  }
  if (fonto.length) {
    if (types.length) lines.push("");
    lines.push("import {");
    for (const fn of fonto) lines.push(`  ${fn},`);
    lines.push(`} from "fontoxpath";`);
  }
  if (parts.helpers.has("handlebars")) {
    if (types.length || fonto.length) lines.push("");
    lines.push('import Handlebars from "handlebars";');
  }
  lines.push(
    "",
    "export type SourceContext = { format: string; data: unknown };",
    "",
    "export function convertSourceToComposition(",
    "  sourceCtx: SourceContext,",
    "  defaults: Record<string, unknown> = {},",
    ...(parts.helpers.has("sheets")
      ? ["  sheets: Record<string, { name?: string; headers: string[]; values: unknown[][]; rowNames?: string[] }> = {},"]
      : []),
    `)${root !== "unknown" ? `: ${root}` : ""} {`,
  );
  if (usesXpath) {
    lines.push(...indentLines(xpathHelpers(parts.helpers), 1));
    lines.push("");
  }
  if (parts.helpers.has("rm")) {
    lines.push(...indentLines(rmHelper(), 1));
    lines.push("");
  }
  if (parts.helpers.has("handlebars")) {
    lines.push(...indentLines(handlebarsHelper(), 1));
    lines.push("");
  }
  if (parts.helpers.has("sheets")) {
    lines.push(...indentLines(sheetHelpers(), 1));
    lines.push("");
  }
  for (const line of parts.body.split("\n")) {
    lines.push(line.length ? `  ${line}` : "");
  }
  lines.push("}", "");
  return lines.join("\n");
}

function xpathHelpers(helpers: Set<string>): string[] {
  const lines = [
    "function jsonQuery(path: string): string {",
    '  const trimmed = path.trim();',
    '  if (!trimmed || trimmed.startsWith("/")) return trimmed;',
    '  const asJson = trimmed.startsWith("$") ? trimmed : `$.${trimmed.replace(/^\\./, "")}`;',
    "  let body = asJson.slice(1);",
    '  if (body.startsWith(".")) body = body.slice(1);',
    '  if (!body || body === ".") return "$source";',
    "  const segments: string[] = [];",
    "  let i = 0;",
    "  while (i < body.length) {",
    '    if (body[i] === ".") { i++; continue; }',
    '    if (body[i] === "[") {',
    '      const close = body.indexOf("]", i + 1);',
    "      if (close < 0) break;",
    "      segments.push(body.slice(i + 1, close));",
    "      i = close + 1;",
    "      continue;",
    "    }",
    "    let end = i;",
    "    while (end < body.length && !\".[\".includes(body[end] ?? \"\")) end++;",
    "    segments.push(body.slice(i, end));",
    "    i = end;",
    "  }",
    '  return segments.reduce((q, seg) => {',
    '    if (/^\\d+$/.test(seg) || /^[A-Za-z_][A-Za-z0-9_]*$/.test(seg)) return `${q}?${seg}`;',
    "    return `${q}?(${JSON.stringify(seg)})`;",
    '  }, "$source");',
    "}",
    "",
  ];
  if (helpers.has("string")) {
    lines.push(
      "function xpathString(path: string, node: unknown = sourceCtx.data): string {",
      '  if (path.trim().startsWith("/")) return evaluateXPathToString(path, node);',
      "  return evaluateXPathToString(jsonQuery(path), null, null, { source: node });",
      "}",
      "",
    );
  }
  if (helpers.has("number")) {
    lines.push(
      "function xpathNumber(path: string, node: unknown = sourceCtx.data): number {",
      '  if (path.trim().startsWith("/")) return evaluateXPathToNumber(path, node);',
      "  return evaluateXPathToNumber(jsonQuery(path), null, null, { source: node });",
      "}",
      "",
    );
  }
  if (helpers.has("boolean")) {
    lines.push(
      "function xpathBoolean(path: string, node: unknown = sourceCtx.data): boolean {",
      '  if (path.trim().startsWith("/")) return evaluateXPathToBoolean(path, node);',
      "  return evaluateXPathToBoolean(jsonQuery(path), null, null, { source: node });",
      "}",
      "",
    );
  }
  if (helpers.has("nodes")) {
    lines.push(
      "function xpathNodes(path: string, node: unknown = sourceCtx.data): unknown[] {",
      '  if (path.trim().startsWith("/")) return evaluateXPathToNodes(path, node);',
      "  return evaluateXPathToNodes(jsonQuery(path), null, null, { source: node });",
      "}",
      "",
    );
  }
  if (helpers.has("node")) {
    lines.push(
      "function xpathNode(path: string, node: unknown = sourceCtx.data): unknown {",
      '  if (path.trim().startsWith("/")) return evaluateXPathToFirstNode(path, node);',
      '  const trimmed = path.trim();',
      '  if (!trimmed || trimmed === "$" || trimmed === ".") return node;',
      "  return evaluateXPathToFirstNode(jsonQuery(path), null, null, { source: node });",
      "}",
      "",
    );
  }
  while (lines.at(-1) === "") lines.pop();
  return lines;
}

function sheetHelpers(): string[] {
  return [
    "function sheetOf(name: string) { return sheets[name]; }",
    "function sheetGetCell(name: string, a1: string) {",
    "  const s = sheetOf(name); if (!s) return null;",
    "  const m = /^([A-Za-z]+)(\\d+)$/.exec(String(a1).trim()); if (!m) return null;",
    "  let x = 0; for (const ch of m[1].toUpperCase()) x = x * 26 + (ch.charCodeAt(0) - 64);",
    "  const row = s.values[Number(m[2]) - 1]; return row ? row[x - 1] ?? null : null;",
    "}",
    "function sheetGetXy(name: string, x: number, y: number) {",
    "  const row = sheetOf(name)?.values[y]; return row ? row[x] ?? null : null;",
    "}",
    "function sheetGetRow(name: string, y: number) { return [...(sheetOf(name)?.values[y] ?? [])]; }",
    "function sheetGetColumn(name: string, x: number) {",
    "  return (sheetOf(name)?.values ?? []).map((row: unknown[]) => row?.[x] ?? null);",
    "}",
    "function sheetGetHeader(name: string, x: number) { return sheetOf(name)?.headers[x] ?? \"\"; }",
    "function sheetGetData(name: string) { return (sheetOf(name)?.values ?? []).map((row: unknown[]) => [...row]); }",
    "function sheetLookup(name: string, matchCol: string | number, matchValue: unknown, returnCol?: string | number) {",
    "  const s = sheetOf(name); if (!s) return null;",
    "  const idx = (ref: string | number) => {",
    "    if (typeof ref === \"number\") return ref;",
    "    const t = String(ref);",
    "    const hi = s.headers.indexOf(t); if (hi >= 0) return hi;",
    "    if (/^[A-Za-z]+$/.test(t)) { let n = 0; for (const ch of t.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }",
    "    if (/^\\d+$/.test(t)) return Number(t);",
    "    return -1;",
    "  };",
    "  const mi = idx(matchCol);",
    "  const y = s.values.findIndex((row: unknown[]) => String(row?.[mi] ?? \"\") === String(matchValue ?? \"\"));",
    "  if (y < 0) return null;",
    "  if (returnCol === undefined || returnCol === null || returnCol === \"\") {",
    "    const rec: Record<string, unknown> = {};",
    "    s.headers.forEach((h: string, x: number) => { rec[h || String(x)] = s.values[y][x]; });",
    "    return rec;",
    "  }",
    "  return s.values[y][idx(returnCol)] ?? null;",
    "}",
  ];
}

function handlebarsHelper(): string[] {
  return [
    "function handlebars(template: string, context: unknown): string {",
    "  const engine = Handlebars.create();",
    "  engine.registerHelper({",
    "    eq: (a: unknown, b: unknown) => a === b,",
    "    ne: (a: unknown, b: unknown) => a !== b,",
    "    toLowerCase: (v: unknown) => v == null ? v : String(v).toLowerCase(),",
    "    toUpperCase: (v: unknown) => v == null ? v : String(v).toUpperCase(),",
    "  });",
    "  return engine.compile(template, { noEscape: true })(context ?? {});",
    "}",
  ];
}

function rmHelper(): string[] {
  return [
    "/** Apply an init bag on RM classes that still use a zero-arg constructor. */",
    "function rm(Type: any, init: any) {",
    "  return Object.assign(new Type(), init);",
    "}",
  ];
}

function indentLines(lines: string[], n: number): string[] {
  const pad = "  ".repeat(n);
  return lines.map((line) => (line.length ? pad + line : line));
}

export function formatObjectLiteral(
  props: Array<[string, string]>,
  indent: number,
): string {
  if (!props.length) return "{}";
  const pad = "  ".repeat(indent);
  const inner = "  ".repeat(indent + 1);
  const body = props
    .map(([key, value]) => `${inner}${key}: ${value}`)
    .join(",\n");
  return `{\n${body},\n${pad}}`;
}

export function formatRmConstruct(
  rmType: string,
  props: Array<[string, string]>,
  indent: number,
  ctx: TsEmitContext,
): string {
  ctx.types.add(rmType);
  const obj = formatObjectLiteral(props, indent);
  if (NATIVE_INIT_TYPES.has(rmType)) {
    return `new ${rmType}(${obj})`;
  }
  ctx.helpers.add("rm");
  return `rm(${rmType}, ${obj})`;
}

/** Wrap a source expression as a number unless it already yields one. */
export function asNumberExpr(expr: string): string {
  if (/^(xpathNumber|Number)\(/.test(expr)) return expr;
  return `Number(${expr})`;
}

export function asStringExpr(expr: string): string {
  if (/^(xpathString|String)\(/.test(expr)) return expr;
  return `String(${expr} ?? "")`;
}

export function asBooleanExpr(expr: string): string {
  if (/^(xpathBoolean|Boolean)\(/.test(expr)) return expr;
  return `Boolean(${expr})`;
}

export function isBlankGeneratedExpr(code: string): boolean {
  const trimmed = code.trim();
  return !trimmed || trimmed === "undefined" || trimmed === "null" ||
    trimmed === '""' || trimmed === "''";
}

export function indentTsBlock(code: string, indent: number): string {
  if (indent <= 0) return code;
  const pad = "  ".repeat(indent);
  return code.split("\n").map((line) => (line.length ? pad + line : line)).join("\n");
}

export function isListAttribute(rmType: string, attr: string): boolean {
  if (LIST_ATTRS.has(attr)) return true;
  try {
    const meta = attributesFor(rmType).find((a) => a.name === attr);
    return Boolean(meta?.typeName.startsWith("List<"));
  } catch {
    return false;
  }
}

export function generateTypeScriptFromSkeleton(
  model: MappingModel,
  skeleton: SkeletonNode[],
): string {
  const ctx = createTsEmitContext();
  const slotMap = new Map(model.slots.map((s) => [s.slotId, s]));
  const loops = model.loops ?? [];
  const roots = skeleton
    .map((node) => emitSkeletonNode(node, slotMap, loops, ctx, 0))
    .filter((code): code is string => Boolean(code));

  const rootType = skeleton[0]?.rmType === "COMPOSITION" ? "COMPOSITION" : undefined;
  let body: string;
  if (roots.length === 1 && skeleton[0]?.rmType === "COMPOSITION") {
    body = `const composition = ${roots[0]};\nreturn composition;`;
    ctx.types.add("COMPOSITION");
  } else if (roots.length === 1) {
    body = `return ${roots[0]};`;
  } else if (roots.length > 1) {
    body = `return [\n${roots.map((r) => `  ${r}`).join(",\n")},\n];`;
  } else {
    ctx.types.add("COMPOSITION");
    body = "const composition = new COMPOSITION({});\nreturn composition;";
  }

  return wrapTypeScriptModule({
    templateId: model.templateId,
    body,
    types: ctx.types,
    helpers: ctx.helpers,
    rootType,
    source: "skeleton",
  });
}

function emitSkeletonNode(
  node: SkeletonNode,
  slots: Map<string, MappingSlot>,
  loops: MappingLoop[],
  ctx: TsEmitContext,
  indent: number,
): string | null {
  if (node.kind === "value") {
    return emitSkeletonValue(node, slots.get(node.slotId), ctx, indent);
  }
  if (isAutoFixedValueSlot(node)) return null;

  const loop = loops.find((item) => item.attachSlotId === node.slotId);
  if (loop) {
    return emitSkeletonLoop(node, loop, slots, loops, ctx, indent);
  }

  const props = skeletonContainerProps(node, slots, loops, ctx, indent);
  if (!props.length && !node.mandatory && node.rmType !== "COMPOSITION") {
    return null;
  }
  return formatRmConstruct(node.rmType, props, indent, ctx);
}

function emitSkeletonLoop(
  node: SkeletonNode,
  loop: MappingLoop,
  slots: Map<string, MappingSlot>,
  loops: MappingLoop[],
  ctx: TsEmitContext,
  indent: number,
): string {
  ctx.helpers.add("nodes");
  const ident = /^[A-Za-z_][A-Za-z0-9_]*$/.test(loop.varName) ? loop.varName : "item";
  const innerCtx: TsEmitContext = {
    ...ctx,
    sourceVar: ident,
    loopVar: ident,
    types: ctx.types,
    helpers: ctx.helpers,
  };
  const nestedLoops = loops.filter((item) => item !== loop);
  const props = skeletonContainerProps(node, slots, nestedLoops, innerCtx, indent + 1);
  const constructed = formatRmConstruct(node.rmType, props, indent + 1, innerCtx);
  return "...xpathNodes(" + JSON.stringify(loop.path) + ").map((" + ident +
    ") => " + constructed + ")";
}

function skeletonContainerProps(
  node: SkeletonNode,
  slots: Map<string, MappingSlot>,
  loops: MappingLoop[],
  ctx: TsEmitContext,
  indent: number,
): Array<[string, string]> {
  const props: Array<[string, string]> = [];
  if (node.label && shouldEmitSkeletonName(node)) {
    props.push([
      "name",
      node.rmType === "COMPOSITION"
        ? JSON.stringify(node.label)
        : (ctx.types.add("DV_TEXT"), `new DV_TEXT(${JSON.stringify(node.label)})`),
    ]);
  }
  if (node.archetypeNodeId) {
    props.push(["archetype_node_id", JSON.stringify(node.archetypeNodeId)]);
  }

  const grouped = new Map<string, SkeletonNode[]>();
  for (const child of node.children) {
    if (isAutoFixedValueSlot(child)) continue;
    const attr = child.rmAttribute ?? child.label;
    const list = grouped.get(attr) ?? [];
    list.push(child);
    grouped.set(attr, list);
  }

  for (const [attr, children] of grouped) {
    const listAttr = isListAttribute(node.rmType, attr);
    const codes = children
      .map((child) =>
        emitSkeletonNode(child, slots, loops, ctx, listAttr ? 0 : indent + 1)
      )
      .filter((code): code is string => Boolean(code) && !isBlankGeneratedExpr(code));
    if (!codes.length) continue;
    const asList = listAttr || codes.some((c) => c.trimStart().startsWith("..."));
    if (asList) {
      const inner = codes.map((c) => indentTsBlock(c, indent + 2)).join(",\n");
      props.push([attr, `[\n${inner},\n${"  ".repeat(indent + 1)}]`]);
    } else {
      props.push([attr, codes[0]!]);
    }
  }
  return props;
}

function emitSkeletonValue(
  node: SkeletonNode,
  slot: MappingSlot | undefined,
  ctx: TsEmitContext,
  indent: number,
): string | null {
  const expr = slot?.expression
    ? emitTsExpressionSource(slot.expression, ctx)
    : null;
  const fields = node.fixedFields ?? {};
  const rmType = node.rmType;

  if (rmType === "CODE_PHRASE") {
    const term = fields.terminology_id;
    const code = fields.code_string ?? fields.defining_code;
    if (term && expr) {
      return "`" + escapeTemplate(term) + "::${String(" + expr + ' ?? "")}`';
    }
    if (term && code) return JSON.stringify(`${term}::${code}`);
    if (expr) {
      ctx.types.add("CODE_PHRASE");
      return `new CODE_PHRASE({ code_string: ${asStringExpr(expr)} })`;
    }
    return null;
  }

  if (rmType === "DV_CODED_TEXT") {
    const term = fields.terminology_id ?? "openehr";
    const code = fields.defining_code ?? fields.code_string;
    const rubric = fields.value ??
      (node.label && node.label !== rmType ? node.label : "");
    if (code) return JSON.stringify(`${term}::${code}|${rubric}|`);
    if (expr) {
      ctx.types.add("DV_CODED_TEXT");
      return `new DV_CODED_TEXT({ value: String(${expr} ?? "") })`;
    }
    return null;
  }

  if (rmType === "DV_QUANTITY") {
    const props: Array<[string, string]> = [];
    if (expr) props.push(["magnitude", asNumberExpr(expr)]);
    if (fields.units) props.push(["units", JSON.stringify(fields.units)]);
    if (!props.length) return null;
    return formatRmConstruct("DV_QUANTITY", props, indent, ctx);
  }

  if (rmType === "DV_COUNT" || rmType === "DV_ORDINAL" || rmType === "DV_PROPORTION") {
    if (!expr) return null;
    return formatRmConstruct(rmType, [["magnitude", asNumberExpr(expr)]], indent, ctx);
  }

  if (rmType === "DV_BOOLEAN") {
    if (!expr) return null;
    return formatRmConstruct("DV_BOOLEAN", [["value", asBooleanExpr(expr)]], indent, ctx);
  }

  if (
    rmType === "DV_DATE_TIME" || rmType === "DV_DATE" || rmType === "DV_TIME" ||
    rmType === "DV_DURATION" || rmType === "DV_URI" || rmType === "DV_EHR_URI" ||
    rmType === "DV_TEXT" || rmType === "DV_IDENTIFIER"
  ) {
    const value = expr
      ? asStringExpr(expr)
      : fields.value
      ? JSON.stringify(fields.value)
      : null;
    if (!value) return null;
    if (rmType === "DV_TEXT") {
      ctx.types.add("DV_TEXT");
      return `new DV_TEXT(${value})`;
    }
    return formatRmConstruct(rmType, [["value", value]], indent, ctx);
  }

  if (rmType === "PARTY_IDENTIFIED") {
    if (!expr) return null;
    return `{ name: ${asStringExpr(expr)} }`;
  }

  if (rmType === "PARTY_SELF") {
    ctx.types.add("PARTY_SELF");
    return "new PARTY_SELF()";
  }

  if (expr) {
    if (rmType && rmType !== "string" && rmType !== "number" && rmType !== "boolean") {
      return formatRmConstruct(rmType, [["value", expr]], indent, ctx);
    }
    return expr;
  }
  return null;
}

function shouldEmitSkeletonName(node: SkeletonNode): boolean {
  if (node.rmType === "COMPOSITION") return true;
  if (node.rmType === "EVENT_CONTEXT" || node.rmType.startsWith("PARTY_")) return false;
  return LOCATABLE_TYPES.has(node.rmType);
}

function escapeTemplate(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

/** Fallback when no skeleton is available (slot list only). */
export function generateTypeScriptFromSlots(model: MappingModel): string {
  const ctx = createTsEmitContext();
  ctx.types.add("COMPOSITION");
  const lines: string[] = [
    "const composition = new COMPOSITION({});",
    "const values: Record<string, unknown> = {};",
    "",
  ];
  for (const slot of model.slots) {
    const expr = emitTsExpressionSource(slot.expression, ctx);
    if (!expr) continue;
    lines.push(`// ${slot.label ?? slot.slotId}`);
    lines.push(`values[${JSON.stringify(slot.slotId)}] = ${expr};`);
    lines.push("");
  }
  lines.push("void values;");
  lines.push("return composition;");
  return wrapTypeScriptModule({
    templateId: model.templateId,
    body: lines.join("\n"),
    types: ctx.types,
    helpers: ctx.helpers,
    rootType: "COMPOSITION",
    source: "slots",
  });
}

