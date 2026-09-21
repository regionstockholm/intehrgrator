/**
 * Shared helpers for Blockly Function → Conversion script named functions.
 */
import type { MappingFunction } from "../../types/mod.ts";

export function valueFunctions(
  functions: MappingFunction[] | undefined,
): MappingFunction[] {
  return (functions ?? []).filter((fn) => fn.kind === "return" && Boolean(fn.body));
}

export function jsFunctionIdent(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, "_").replace(/^(\d)/, "_$1");
  return cleaned || "fn";
}

export function xqueryLocalName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9\-.]/g, "-").replace(/^(\d)/, "fn-$1");
  return cleaned || "fn";
}

export function functionIdentMap(
  functions: MappingFunction[] | undefined,
  identOf: (name: string) => string,
): Map<string, string> {
  const used = new Set<string>();
  const map = new Map<string, string>();
  for (const fn of functions ?? []) {
    let ident = identOf(fn.name);
    if (used.has(ident)) {
      let i = 2;
      while (used.has(`${ident}_${i}`)) i++;
      ident = `${ident}_${i}`;
    }
    used.add(ident);
    map.set(fn.name, ident);
  }
  return map;
}

export function callTargetName(
  ast: { kind: string; args?: Array<{ kind: string; value?: unknown }> },
): string | null {
  if (ast.kind !== "call") return null;
  const first = ast.args?.[0];
  if (first?.kind === "literal" && typeof first.value === "string") return first.value;
  return null;
}
