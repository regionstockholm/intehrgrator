/**
 * Compile the VMS-Hbs dialect (ADR 0009) to a small IR that TypeScript / Java
 * conversion scripts can emit as native string construction — no Handlebars.js
 * or Handlebars.java. Handlebars Output mode still emits `.hbs`.
 *
 * Out-of-dialect templates return `null` so codegen can fall back to a runtime
 * Handlebars helper.
 */
import Handlebars from "handlebars";
import { checkVmsHbs, VMS_HBS_ALLOWED_HELPERS } from "./vms_hbs.ts";

export type VmsPath = {
  kind: "path";
  parts: string[];
  depth: number;
  data: boolean;
};

export type VmsExpr =
  | VmsPath
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "helper"; name: string; args: VmsExpr[] };

export type VmsStmt =
  | { kind: "text"; value: string }
  | { kind: "mustache"; expr: VmsExpr; escape: boolean }
  | { kind: "if"; cond: VmsExpr; then: VmsStmt[]; else: VmsStmt[]; inverted?: boolean }
  | { kind: "each"; expr: VmsExpr; then: VmsStmt[]; else: VmsStmt[] }
  | { kind: "section"; expr: VmsExpr; then: VmsStmt[]; else: VmsStmt[]; inverted: boolean };

export interface VmsHbsProgram {
  body: VmsStmt[];
}

export interface VmsHbsFrame {
  ctx: unknown;
  root: unknown;
  parent?: VmsHbsFrame;
  index?: number;
  first?: boolean;
  last?: boolean;
  key?: string;
}

const BLOCK_HELPERS = new Set(["if", "unless", "each"]);
const INLINE_HELPERS = new Set([
  "eq",
  "ne",
  "lt",
  "gt",
  "lte",
  "gte",
  "and",
  "or",
  "toLowerCase",
  "toUpperCase",
  "slot",
]);

type HbNode = {
  type?: string;
  value?: unknown;
  original?: string;
  escaped?: boolean;
  data?: boolean;
  depth?: number;
  parts?: string[];
  params?: HbNode[];
  path?: HbNode;
  program?: { body?: HbNode[] };
  inverse?: { body?: HbNode[] };
  hash?: { pairs?: unknown[] };
  body?: HbNode[];
};

export function compileVmsHbs(source: string): VmsHbsProgram | null {
  if (!checkVmsHbs(source).ok) return null;
  try {
    const ast = Handlebars.parse(source) as HbNode;
    return { body: compileProgram(ast) };
  } catch {
    return null;
  }
}

/** Interpret compiled VMS-Hbs in-process (golden vs Handlebars runtime). */
export function renderCompiledVmsHbs(source: string, context: unknown): string | null {
  const program = compileVmsHbs(source);
  if (!program) return null;
  return evalStmts(program.body, { ctx: context, root: context });
}

function compileProgram(node: HbNode | undefined): VmsStmt[] {
  const body = node?.body ?? [];
  const out: VmsStmt[] = [];
  for (const stmt of body) {
    const compiled = compileStmt(stmt);
    if (compiled) out.push(compiled);
  }
  return out;
}

function compileStmt(node: HbNode): VmsStmt | null {
  switch (node.type) {
    case "ContentStatement":
      return { kind: "text", value: String(node.value ?? "") };
    case "CommentStatement":
      return null;
    case "MustacheStatement": {
      if (node.hash?.pairs?.length) throw new Error("VMS-Hbs forbids hash arguments");
      const expr = compileMustacheExpr(node);
      return { kind: "mustache", expr, escape: node.escaped !== false };
    }
    case "BlockStatement": {
      if (node.hash?.pairs?.length) throw new Error("VMS-Hbs forbids hash arguments");
      const name = pathName(node.path);
      const thenBody = compileProgram(node.program);
      const elseBody = compileProgram(node.inverse);
      if (name === "if" || name === "unless") {
        const cond = node.params?.[0] ? compileExpr(node.params[0]) : pathExpr([]);
        return {
          kind: "if",
          cond,
          then: thenBody,
          else: elseBody,
          inverted: name === "unless",
        };
      }
      if (name === "each") {
        const expr = node.params?.[0] ? compileExpr(node.params[0]) : pathExpr([]);
        return { kind: "each", expr, then: thenBody, else: elseBody };
      }
      if (BLOCK_HELPERS.has(name) || INLINE_HELPERS.has(name) || VMS_HBS_ALLOWED_HELPERS[name]) {
        if (name && !BLOCK_HELPERS.has(name)) {
          throw new Error(`VMS-Hbs forbids block helper "${name}"`);
        }
      }
      const expr = compilePath(node.path);
      const inverted = Boolean(node.inverse && !node.program);
      // `{{^empty}}` puts the body on inverse with no program.
      if (inverted) {
        return { kind: "section", expr, then: elseBody, else: [], inverted: true };
      }
      return {
        kind: "section",
        expr,
        then: thenBody,
        else: elseBody,
        inverted: false,
      };
    }
    default:
      throw new Error(`VMS-Hbs cannot compile ${node.type ?? "unknown"}`);
  }
}

function compileMustacheExpr(node: HbNode): VmsExpr {
  const name = pathName(node.path);
  const params = node.params ?? [];
  if (params.length > 0) {
    if (!INLINE_HELPERS.has(name)) throw new Error(`VMS-Hbs forbids helper "${name}"`);
    return { kind: "helper", name, args: params.map(compileExpr) };
  }
  return compilePath(node.path);
}

function compileExpr(node: HbNode): VmsExpr {
  switch (node.type) {
    case "StringLiteral":
      return { kind: "literal", value: String(node.value ?? "") };
    case "NumberLiteral":
      return { kind: "literal", value: Number(node.value ?? 0) };
    case "BooleanLiteral":
      return { kind: "literal", value: Boolean(node.value) };
    case "UndefinedLiteral":
    case "NullLiteral":
      return { kind: "literal", value: "" };
    case "SubExpression": {
      const name = pathName(node.path);
      if (!INLINE_HELPERS.has(name)) throw new Error(`VMS-Hbs forbids helper "${name}"`);
      return { kind: "helper", name, args: (node.params ?? []).map(compileExpr) };
    }
    case "PathExpression":
      return compilePath(node);
    default:
      throw new Error(`VMS-Hbs cannot compile expr ${node.type ?? "unknown"}`);
  }
}

function compilePath(node: HbNode | undefined): VmsPath {
  return {
    kind: "path",
    parts: Array.isArray(node?.parts) ? node!.parts!.map(String) : [],
    depth: Number(node?.depth ?? 0),
    data: Boolean(node?.data),
  };
}

function pathExpr(parts: string[]): VmsPath {
  return { kind: "path", parts, depth: 0, data: false };
}

function pathName(node: HbNode | undefined): string {
  if (node?.original) return String(node.original).split(".")[0] ?? "";
  return node?.parts?.length ? String(node.parts[0]) : "";
}

export function evalStmts(stmts: VmsStmt[], frame: VmsHbsFrame): string {
  let out = "";
  for (const stmt of stmts) out += evalStmt(stmt, frame);
  return out;
}

function evalStmt(stmt: VmsStmt, frame: VmsHbsFrame): string {
  switch (stmt.kind) {
    case "text":
      return stmt.value;
    case "mustache": {
      const value = evalExpr(stmt.expr, frame);
      return vmsHbsString(value);
    }
    case "if": {
      const ok = vmsHbsTruthy(evalExpr(stmt.cond, frame));
      const takeThen = stmt.inverted ? !ok : ok;
      return evalStmts(takeThen ? stmt.then : stmt.else, frame);
    }
    case "each": {
      const items = vmsHbsEachItems(evalExpr(stmt.expr, frame));
      if (!items.length) return evalStmts(stmt.else, frame);
      let out = "";
      for (let i = 0; i < items.length; i++) {
        const child: VmsHbsFrame = {
          ctx: items[i]!.item,
          root: frame.root,
          parent: frame,
          index: i,
          first: i === 0,
          last: i === items.length - 1,
          key: items[i]!.key,
        };
        out += evalStmts(stmt.then, child);
      }
      return out;
    }
    case "section": {
      const value = evalExpr(stmt.expr, frame);
      const truthy = vmsHbsTruthy(value);
      if (stmt.inverted) return truthy ? "" : evalStmts(stmt.then, frame);
      if (!truthy) return evalStmts(stmt.else, frame);
      const items = vmsHbsEachItems(value);
      if (Array.isArray(value)) {
        if (!items.length) return evalStmts(stmt.else, frame);
        let out = "";
        for (let i = 0; i < items.length; i++) {
          out += evalStmts(stmt.then, {
            ctx: items[i]!.item,
            root: frame.root,
            parent: frame,
            index: i,
            first: i === 0,
            last: i === items.length - 1,
            key: items[i]!.key,
          });
        }
        return out;
      }
      if (value && typeof value === "object") {
        return evalStmts(stmt.then, { ctx: value, root: frame.root, parent: frame });
      }
      return evalStmts(stmt.then, frame);
    }
  }
}

function evalExpr(expr: VmsExpr, frame: VmsHbsFrame): unknown {
  switch (expr.kind) {
    case "literal":
      return expr.value;
    case "path":
      return vmsHbsLookup(frame, expr);
    case "helper":
      return evalHelper(expr.name, expr.args.map((a) => evalExpr(a, frame)), frame);
  }
}

function evalHelper(name: string, args: unknown[], frame: VmsHbsFrame): unknown {
  switch (name) {
    case "eq":
      return args[0] === args[1];
    case "ne":
      return args[0] !== args[1];
    case "lt":
      return Number(args[0]) < Number(args[1]);
    case "gt":
      return Number(args[0]) > Number(args[1]);
    case "lte":
      return Number(args[0]) <= Number(args[1]);
    case "gte":
      return Number(args[0]) >= Number(args[1]);
    case "and":
      return args.every((a) => Boolean(a));
    case "or":
      return args.some((a) => Boolean(a));
    case "toLowerCase":
      return args[0] == null ? args[0] : String(args[0]).toLowerCase();
    case "toUpperCase":
      return args[0] == null ? args[0] : String(args[0]).toUpperCase();
    case "slot":
      return vmsHbsSlot(frame.root, args[0]);
    default:
      return undefined;
  }
}

export function vmsHbsString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

export function vmsHbsTruthy(value: unknown): boolean {
  if (value === 0) return true;
  if (!value) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

export function vmsHbsEachItems(value: unknown): Array<{ item: unknown; key: string }> {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((item, i) => ({ item, key: String(i) }));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => ({ item, key }));
  }
  return [];
}

export function vmsHbsLookup(frame: VmsHbsFrame, path: VmsPath): unknown {
  if (path.data) {
    const head = path.parts[0];
    if (head === "root") return vmsHbsGet(frame.root, path.parts.slice(1));
    const data: Record<string, unknown> = {
      index: frame.index,
      first: frame.first,
      last: frame.last,
      key: frame.key,
    };
    if (path.parts.length <= 1) return data[head ?? ""];
    return vmsHbsGet(data[head ?? ""], path.parts.slice(1));
  }
  let cur: VmsHbsFrame | undefined = frame;
  for (let i = 0; i < path.depth; i++) cur = cur?.parent;
  if (!cur) return undefined;
  if (!path.parts.length) return cur.ctx;
  return vmsHbsGet(cur.ctx, path.parts);
}

export function vmsHbsGet(ctx: unknown, parts: string[]): unknown {
  let cur = ctx;
  for (const seg of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

export function vmsHbsSlot(root: unknown, id: unknown): unknown {
  if (!root || typeof root !== "object") return undefined;
  const slots = (root as { _slots?: Record<string, unknown> })._slots;
  return slots?.[String(id)];
}

/** Nested runtime used by generated TypeScript conversion scripts. */
export function vmsHbsRuntimeTs(): string[] {
  return [
    "function vmsHbsString(value) {",
    '  if (value == null) return "";',
    "  return String(value);",
    "}",
    "function vmsHbsTruthy(value) {",
    "  if (value === 0) return true;",
    "  if (!value) return false;",
    "  if (Array.isArray(value) && value.length === 0) return false;",
    "  return true;",
    "}",
    "function vmsHbsGet(ctx, parts) {",
    "  let cur = ctx;",
    "  for (const seg of parts) {",
    '    if (cur == null || typeof cur !== "object") return undefined;',
    "    cur = cur[seg];",
    "  }",
    "  return cur;",
    "}",
    "function vmsHbsLookup(f, parts, depth = 0, data = false) {",
    "  if (data) {",
    "    const head = parts[0];",
    '    if (head === "root") return vmsHbsGet(f.root, parts.slice(1));',
    "    const bag = {};",
    "    bag.index = f.index;",
    "    bag.first = f.first;",
    "    bag.last = f.last;",
    "    bag.key = f.key;",
    "    return parts.length <= 1 ? bag[head] : vmsHbsGet(bag[head], parts.slice(1));",
    "  }",
    "  let cur = f;",
    "  for (let i = 0; i < depth; i++) {",
    "    if (!cur || !cur.parent) return undefined;",
    "    cur = cur.parent;",
    "  }",
    "  if (!cur) return undefined;",
    "  return parts.length ? vmsHbsGet(cur.ctx, parts) : cur.ctx;",
    "}",
    "function vmsHbsEachItems(value) {",
    "  const out = [];",
    "  if (value == null) return out;",
    "  if (Array.isArray(value)) {",
    "    for (let i = 0; i < value.length; i++) {",
    "      const row = {};",
    "      row.item = value[i];",
    "      row.key = String(i);",
    "      out.push(row);",
    "    }",
    "    return out;",
    "  }",
    '  if (typeof value === "object") {',
    "    for (const key of Object.keys(value)) {",
    "      const row = {};",
    "      row.item = value[key];",
    "      row.key = key;",
    "      out.push(row);",
    "    }",
    "  }",
    "  return out;",
    "}",
    "function vmsHbsNewFrame(ctx, root, parent) {",
    "  const f = {};",
    "  f.ctx = ctx;",
    "  f.root = root;",
    "  f.parent = parent;",
    "  return f;",
    "}",
    "function vmsHbsSlot(root, id) {",
    '  if (!root || typeof root !== "object") return undefined;',
    "  const slots = root._slots;",
    "  return slots ? slots[String(id)] : undefined;",
    "}",
  ];
}

/** Class-level runtime used by generated Java conversion scripts. */
export function vmsHbsRuntimeJava(): string[] {
  return [
    "private static final class VmsHbsFrame {",
    "  Object ctx; Object root; VmsHbsFrame parent; Integer index; Boolean first; Boolean last; String key;",
    "  VmsHbsFrame(Object ctx, Object root, VmsHbsFrame parent) { this.ctx = ctx; this.root = root; this.parent = parent; }",
    "}",
    "private static String vmsHbsString(Object value) {",
    "  if (value == null) return \"\";",
    "  return String.valueOf(value);",
    "}",
    "private static boolean vmsHbsTruthy(Object value) {",
    "  if (value instanceof Number n && n.doubleValue() == 0d) return true;",
    "  if (value == null) return false;",
    "  if (value instanceof Boolean b) return b;",
    "  if (value instanceof String s) return !s.isEmpty();",
    "  if (value instanceof java.util.Collection<?> c) return !c.isEmpty();",
    "  if (value instanceof Object[] a) return a.length > 0;",
    "  return true;",
    "}",
    "private static Object vmsHbsGet(Object ctx, String... parts) {",
    "  Object cur = ctx;",
    "  for (String seg : parts) {",
    "    if (cur == null) return null;",
    "    if (cur instanceof java.util.Map<?, ?> map) { cur = map.get(seg); continue; }",
    "    if (cur instanceof java.util.List<?> list) {",
    "      try { int i = Integer.parseInt(seg); cur = (i >= 0 && i < list.size()) ? list.get(i) : null; }",
    "      catch (NumberFormatException e) { cur = null; }",
    "      continue;",
    "    }",
    "    if (cur instanceof Object[] arr) {",
    "      try { int i = Integer.parseInt(seg); cur = (i >= 0 && i < arr.length) ? arr[i] : null; }",
    "      catch (NumberFormatException e) { cur = null; }",
    "      continue;",
    "    }",
    "    return null;",
    "  }",
    "  return cur;",
    "}",
    "private static Object vmsHbsLookup(VmsHbsFrame f, int depth, boolean data, String... parts) {",
    "  if (data) {",
    "    if (parts.length == 0) return null;",
    "    if (\"root\".equals(parts[0])) return vmsHbsGet(f.root, java.util.Arrays.copyOfRange(parts, 1, parts.length));",
    "    Object bag = switch (parts[0]) {",
    "      case \"index\" -> f.index;",
    "      case \"first\" -> f.first;",
    "      case \"last\" -> f.last;",
    "      case \"key\" -> f.key;",
    "      default -> null;",
    "    };",
    "    return parts.length == 1 ? bag : vmsHbsGet(bag, java.util.Arrays.copyOfRange(parts, 1, parts.length));",
    "  }",
    "  VmsHbsFrame cur = f;",
    "  for (int i = 0; i < depth && cur != null; i++) cur = cur.parent;",
    "  if (cur == null) return null;",
    "  return parts.length == 0 ? cur.ctx : vmsHbsGet(cur.ctx, parts);",
    "}",
    "private static java.util.List<Object[]> vmsHbsEachItems(Object value) {",
    "  java.util.List<Object[]> out = new java.util.ArrayList<>();",
    "  if (value == null) return out;",
    "  if (value instanceof java.util.List<?> list) {",
    "    for (int i = 0; i < list.size(); i++) out.add(new Object[] { list.get(i), String.valueOf(i) });",
    "    return out;",
    "  }",
    "  if (value instanceof Object[] arr) {",
    "    for (int i = 0; i < arr.length; i++) out.add(new Object[] { arr[i], String.valueOf(i) });",
    "    return out;",
    "  }",
    "  if (value instanceof java.util.Map<?, ?> map) {",
    "    for (java.util.Map.Entry<?, ?> e : map.entrySet()) out.add(new Object[] { e.getValue(), String.valueOf(e.getKey()) });",
    "  }",
    "  return out;",
    "}",
    "private static Object vmsHbsSlot(Object root, Object id) {",
    "  if (!(root instanceof java.util.Map<?, ?> map)) return null;",
    "  Object slots = map.get(\"_slots\");",
    "  if (!(slots instanceof java.util.Map<?, ?> sm)) return null;",
    "  return sm.get(String.valueOf(id));",
    "}",
  ];
}

export function emitVmsHbsTsFunction(program: VmsHbsProgram, name: string): string[] {
  const lines: string[] = [
    `function ${name}(context) {`,
    "  let f = vmsHbsNewFrame(context, context, null);",
    "  let out = \"\";",
  ];
  emitStmtsTs(program.body, lines, "  ");
  lines.push("  return out;", "}");
  return lines;
}

export function emitVmsHbsJavaMethod(program: VmsHbsProgram, name: string): string[] {
  const lines: string[] = [
    `private String ${name}(Object context) {`,
    "  VmsHbsFrame f = new VmsHbsFrame(context, context, null);",
    "  StringBuilder out = new StringBuilder();",
  ];
  emitStmtsJava(program.body, lines, "  ");
  lines.push("  return out.toString();", "}");
  return lines;
}

function emitStmtsTs(stmts: VmsStmt[], lines: string[], pad: string): void {
  for (const stmt of stmts) emitStmtTs(stmt, lines, pad);
}

function emitStmtTs(stmt: VmsStmt, lines: string[], pad: string): void {
  switch (stmt.kind) {
    case "text":
      if (stmt.value) lines.push(`${pad}out += ${JSON.stringify(stmt.value)};`);
      return;
    case "mustache": {
      const value = emitExprTs(stmt.expr);
      lines.push(`${pad}out += vmsHbsString(${value});`);
      return;
    }
    case "if": {
      const cond = `vmsHbsTruthy(${emitExprTs(stmt.cond)})`;
      lines.push(`${pad}if (${stmt.inverted ? `!${cond}` : cond}) {`);
      emitStmtsTs(stmt.then, lines, pad + "  ");
      if (stmt.else.length) {
        lines.push(`${pad}} else {`);
        emitStmtsTs(stmt.else, lines, pad + "  ");
      }
      lines.push(`${pad}}`);
      return;
    }
    case "each":
      emitEachTs(stmt, lines, pad);
      return;
    case "section":
      emitSectionTs(stmt, lines, pad);
      return;
  }
}

function emitEachTs(
  stmt: Extract<VmsStmt, { kind: "each" }>,
  lines: string[],
  pad: string,
): void {
  const items = `__items${lines.length}`;
  const i = `__i${lines.length}`;
  lines.push(`${pad}{`);
  lines.push(`${pad}  const ${items} = vmsHbsEachItems(${emitExprTs(stmt.expr)});`);
  lines.push(`${pad}  if (${items}.length === 0) {`);
  emitStmtsTs(stmt.else, lines, pad + "    ");
  lines.push(`${pad}  } else {`);
  lines.push(`${pad}    const __parent = f;`);
  lines.push(`${pad}    for (let ${i} = 0; ${i} < ${items}.length; ${i}++) {`);
  lines.push(
    `${pad}      f = vmsHbsNewFrame(${items}[${i}].item, __parent.root, __parent);`,
    `${pad}      f.index = ${i}; f.first = ${i} === 0; f.last = ${i} === ${items}.length - 1; f.key = ${items}[${i}].key;`,
  );
  emitStmtsTs(stmt.then, lines, pad + "      ");
  lines.push(`${pad}    }`);
  lines.push(`${pad}    f = __parent;`);
  lines.push(`${pad}  }`);
  lines.push(`${pad}}`);
}

function emitSectionTs(
  stmt: Extract<VmsStmt, { kind: "section" }>,
  lines: string[],
  pad: string,
): void {
  const value = `__sec${lines.length}`;
  lines.push(`${pad}{`);
  lines.push(`${pad}  const ${value} = ${emitExprTs(stmt.expr)};`);
  if (stmt.inverted) {
    lines.push(`${pad}  if (!vmsHbsTruthy(${value})) {`);
    emitStmtsTs(stmt.then, lines, pad + "    ");
    lines.push(`${pad}  }`);
    lines.push(`${pad}}`);
    return;
  }
  lines.push(`${pad}  if (!vmsHbsTruthy(${value})) {`);
  emitStmtsTs(stmt.else, lines, pad + "    ");
  lines.push(`${pad}  } else if (Array.isArray(${value})) {`);
  const items = `${value}Items`;
  const i = `${value}i`;
  lines.push(`${pad}    const ${items} = vmsHbsEachItems(${value});`);
  lines.push(`${pad}    const __parent = f;`);
  lines.push(`${pad}    for (let ${i} = 0; ${i} < ${items}.length; ${i}++) {`);
  lines.push(
    `${pad}      f = vmsHbsNewFrame(${items}[${i}].item, __parent.root, __parent);`,
    `${pad}      f.index = ${i}; f.first = ${i} === 0; f.last = ${i} === ${items}.length - 1; f.key = ${items}[${i}].key;`,
  );
  emitStmtsTs(stmt.then, lines, pad + "      ");
  lines.push(`${pad}    }`);
  lines.push(`${pad}    f = __parent;`);
  lines.push(`${pad}  } else if (${value} && typeof ${value} === "object") {`);
  lines.push(`${pad}    const __parent = f;`);
  lines.push(`${pad}    f = vmsHbsNewFrame(${value}, __parent.root, __parent);`);
  emitStmtsTs(stmt.then, lines, pad + "    ");
  lines.push(`${pad}    f = __parent;`);
  lines.push(`${pad}  } else {`);
  emitStmtsTs(stmt.then, lines, pad + "    ");
  lines.push(`${pad}  }`);
  lines.push(`${pad}}`);
}

function emitExprTs(expr: VmsExpr): string {
  switch (expr.kind) {
    case "literal":
      return JSON.stringify(expr.value);
    case "path":
      return `vmsHbsLookup(f, ${JSON.stringify(expr.parts)}, ${expr.depth}, ${expr.data})`;
    case "helper":
      return emitHelperTs(expr.name, expr.args.map(emitExprTs));
  }
}

function emitHelperTs(name: string, args: string[]): string {
  switch (name) {
    case "eq":
      return `(${args[0]} === ${args[1]})`;
    case "ne":
      return `(${args[0]} !== ${args[1]})`;
    case "lt":
      return `(Number(${args[0]}) < Number(${args[1]}))`;
    case "gt":
      return `(Number(${args[0]}) > Number(${args[1]}))`;
    case "lte":
      return `(Number(${args[0]}) <= Number(${args[1]}))`;
    case "gte":
      return `(Number(${args[0]}) >= Number(${args[1]}))`;
    case "and":
      return `(${args.map((a) => `Boolean(${a})`).join(" && ") || "true"})`;
    case "or":
      return `(${args.map((a) => `Boolean(${a})`).join(" || ") || "false"})`;
    case "toLowerCase":
      return `(${args[0]} == null ? ${args[0]} : String(${args[0]}).toLowerCase())`;
    case "toUpperCase":
      return `(${args[0]} == null ? ${args[0]} : String(${args[0]}).toUpperCase())`;
    case "slot":
      return `vmsHbsSlot(f.root, ${args[0]})`;
    default:
      return "undefined";
  }
}

function emitStmtsJava(stmts: VmsStmt[], lines: string[], pad: string): void {
  for (const stmt of stmts) emitStmtJava(stmt, lines, pad);
}

function emitStmtJava(stmt: VmsStmt, lines: string[], pad: string): void {
  switch (stmt.kind) {
    case "text":
      if (stmt.value) lines.push(`${pad}out.append(${JSON.stringify(stmt.value)});`);
      return;
    case "mustache": {
      const value = emitExprJava(stmt.expr);
      lines.push(`${pad}out.append(vmsHbsString(${value}));`);
      return;
    }
    case "if": {
      const cond = `vmsHbsTruthy(${emitExprJava(stmt.cond)})`;
      lines.push(`${pad}if (${stmt.inverted ? `!${cond}` : cond}) {`);
      emitStmtsJava(stmt.then, lines, pad + "  ");
      if (stmt.else.length) {
        lines.push(`${pad}} else {`);
        emitStmtsJava(stmt.else, lines, pad + "  ");
      }
      lines.push(`${pad}}`);
      return;
    }
    case "each":
      emitEachJava(stmt, lines, pad);
      return;
    case "section":
      emitSectionJava(stmt, lines, pad);
      return;
  }
}

function emitEachJava(
  stmt: Extract<VmsStmt, { kind: "each" }>,
  lines: string[],
  pad: string,
): void {
  const items = `items${lines.length}`;
  const i = `i${lines.length}`;
  lines.push(`${pad}{`);
  lines.push(`${pad}  java.util.List<Object[]> ${items} = vmsHbsEachItems(${emitExprJava(stmt.expr)});`);
  lines.push(`${pad}  if (${items}.isEmpty()) {`);
  emitStmtsJava(stmt.else, lines, pad + "    ");
  lines.push(`${pad}  } else {`);
  lines.push(`${pad}    VmsHbsFrame parent = f;`);
  lines.push(`${pad}    for (int ${i} = 0; ${i} < ${items}.size(); ${i}++) {`);
  lines.push(`${pad}      Object[] it = ${items}.get(${i});`);
  lines.push(`${pad}      f = new VmsHbsFrame(it[0], parent.root, parent);`);
  lines.push(`${pad}      f.index = ${i}; f.first = ${i} == 0; f.last = ${i} == ${items}.size() - 1; f.key = (String) it[1];`);
  emitStmtsJava(stmt.then, lines, pad + "      ");
  lines.push(`${pad}    }`);
  lines.push(`${pad}    f = parent;`);
  lines.push(`${pad}  }`);
  lines.push(`${pad}}`);
}

function emitSectionJava(
  stmt: Extract<VmsStmt, { kind: "section" }>,
  lines: string[],
  pad: string,
): void {
  const value = `sec${lines.length}`;
  lines.push(`${pad}{`);
  lines.push(`${pad}  Object ${value} = ${emitExprJava(stmt.expr)};`);
  if (stmt.inverted) {
    lines.push(`${pad}  if (!vmsHbsTruthy(${value})) {`);
    emitStmtsJava(stmt.then, lines, pad + "    ");
    lines.push(`${pad}  }`);
    lines.push(`${pad}}`);
    return;
  }
  lines.push(`${pad}  if (!vmsHbsTruthy(${value})) {`);
  emitStmtsJava(stmt.else, lines, pad + "    ");
  lines.push(`${pad}  } else if (${value} instanceof java.util.List || ${value} instanceof Object[]) {`);
  const items = `${value}Items`;
  const i = `${value}i`;
  lines.push(`${pad}    java.util.List<Object[]> ${items} = vmsHbsEachItems(${value});`);
  lines.push(`${pad}    VmsHbsFrame parent = f;`);
  lines.push(`${pad}    for (int ${i} = 0; ${i} < ${items}.size(); ${i}++) {`);
  lines.push(`${pad}      Object[] it = ${items}.get(${i});`);
  lines.push(`${pad}      f = new VmsHbsFrame(it[0], parent.root, parent);`);
  lines.push(`${pad}      f.index = ${i}; f.first = ${i} == 0; f.last = ${i} == ${items}.size() - 1; f.key = (String) it[1];`);
  emitStmtsJava(stmt.then, lines, pad + "      ");
  lines.push(`${pad}    }`);
  lines.push(`${pad}    f = parent;`);
  lines.push(`${pad}  } else if (${value} instanceof java.util.Map) {`);
  lines.push(`${pad}    VmsHbsFrame parent = f;`);
  lines.push(`${pad}    f = new VmsHbsFrame(${value}, parent.root, parent);`);
  emitStmtsJava(stmt.then, lines, pad + "    ");
  lines.push(`${pad}    f = parent;`);
  lines.push(`${pad}  } else {`);
  emitStmtsJava(stmt.then, lines, pad + "    ");
  lines.push(`${pad}  }`);
  lines.push(`${pad}}`);
}

function emitExprJava(expr: VmsExpr): string {
  switch (expr.kind) {
    case "literal":
      if (typeof expr.value === "string") return JSON.stringify(expr.value);
      if (typeof expr.value === "boolean") return expr.value ? "Boolean.TRUE" : "Boolean.FALSE";
      return `Double.valueOf(${expr.value})`;
    case "path": {
      const parts = expr.parts.map((p) => JSON.stringify(p)).join(", ");
      const args = parts.length ? `, ${parts}` : "";
      return `vmsHbsLookup(f, ${expr.depth}, ${expr.data}${args})`;
    }
    case "helper":
      return emitHelperJava(expr.name, expr.args.map(emitExprJava));
  }
}

function emitHelperJava(name: string, args: string[]): string {
  switch (name) {
    case "eq":
      return `java.util.Objects.equals(${args[0]}, ${args[1]})`;
    case "ne":
      return `(!java.util.Objects.equals(${args[0]}, ${args[1]}))`;
    case "lt":
      return `(toDouble(${args[0]}) < toDouble(${args[1]}))`;
    case "gt":
      return `(toDouble(${args[0]}) > toDouble(${args[1]}))`;
    case "lte":
      return `(toDouble(${args[0]}) <= toDouble(${args[1]}))`;
    case "gte":
      return `(toDouble(${args[0]}) >= toDouble(${args[1]}))`;
    case "and":
      return `(${args.map((a) => `vmsHbsTruthy(${a})`).join(" && ") || "true"})`;
    case "or":
      return `(${args.map((a) => `vmsHbsTruthy(${a})`).join(" || ") || "false"})`;
    case "toLowerCase":
      return `(${args[0]} == null ? null : String.valueOf(${args[0]}).toLowerCase())`;
    case "toUpperCase":
      return `(${args[0]} == null ? null : String.valueOf(${args[0]}).toUpperCase())`;
    case "slot":
      return `vmsHbsSlot(f.root, ${args[0]})`;
    default:
      return "null";
  }
}
