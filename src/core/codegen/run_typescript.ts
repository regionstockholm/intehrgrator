/**
 * Execute a generated TypeScript Conversion Script in-process.
 *
 * The downloadable script keeps `import` lines for pipeline use. The workbench
 * binds those names to bundled ehrtslib / fontoxpath and runs
 * `convertSourceToComposition` — the same function body shown in Generated
 * conversion script(s).
 */

import * as rm from "ehrtslib/openehr_rm.ts";
import {
  evaluateXPathToBoolean,
  evaluateXPathToNodes,
  evaluateXPathToNumber,
  evaluateXPathToString,
} from "fontoxpath";
import Handlebars from "handlebars";
import { JsonCanonicalSerializer } from "ehrtslib/serialization/json/mod.ts";
import { XmlSerializer } from "ehrtslib/serialization/xml/mod.ts";
import {
  parseWebTemplate,
  serializeToFlatJson,
  serializeToStructuredJson,
} from "ehrtslib/serialization/simplified/mod.ts";

export interface GeneratedScriptRuntime {
  [name: string]: unknown;
}

export function generatedScriptRuntime(): GeneratedScriptRuntime {
  return {
    ...(rm as unknown as GeneratedScriptRuntime),
    evaluateXPathToString,
    evaluateXPathToNumber,
    evaluateXPathToBoolean,
    evaluateXPathToNodes,
    JsonCanonicalSerializer,
    XmlSerializer,
    parseWebTemplate,
    serializeToFlatJson,
    serializeToStructuredJson,
    Handlebars,
  };
}

export function stripGeneratedTypeScript(source: string): { names: string[]; body: string } {
  const names: string[] = [];
  let body = source.replace(
    /import\s*\{([^}]+)\}\s*from\s*["'][^"']+["']\s*;?/g,
    (_all, inner: string) => {
      for (const raw of inner.split(",")) {
        const name = raw.trim().split(/\s+as\s+/).pop()?.trim();
        if (name) names.push(name);
      }
      return "";
    },
  );
  body = body.replace(
    /import\s+(\w+)\s+from\s*["'][^"']+["']\s*;?/g,
    (_all, name: string) => {
      names.push(name);
      return "";
    },
  );
  body = body.replace(
    /import\s+\*\s+as\s+(\w+)\s+from\s*["'][^"']+["']\s*;?/g,
    (_all, name: string) => {
      names.push(name);
      return "";
    },
  );
  body = body.replace(
    /export\s+type[\s\S]*?(?=export\s+function\s+convertSourceToComposition)/,
    "",
  );
  body = body.replace(/\bexport\s+function\b/g, "function");
  body = body.replace(/(\]|[\w$])!/g, "$1");
  body = stripFunctionTypesInBody(body);
  body = stripArrowFunctionTypes(body);
  body = stripVariableTypeAnnotations(body);
  body = stripTypeAssertions(body);
  body = stripGenericInstantiations(body);
  return { names: [...new Set(names)], body };
}

function stripGenericInstantiations(body: string): string {
  return body.replace(/\bnew Set<[^>]+>\(\)/g, "new Set()");
}

function stripFunctionTypesInBody(body: string): string {
  let result = "";
  let i = 0;
  while (i < body.length) {
    const fn = body.slice(i).match(/^function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (fn) {
      const name = fn[1]!;
      const openParen = i + fn[0].length - 1;
      const closeParen = findMatchingParen(body, openParen);
      const params = body.slice(openParen + 1, closeParen);
      let after = closeParen + 1;
      const retType = body.slice(after).match(/^\s*:\s*[A-Za-z0-9_.<>,\s\[\]|&]+(?=\s*\{)/);
      if (retType) after += retType[0].length;
      result += `function ${name}(${stripParameterTypes(params)})`;
      i = after;
      continue;
    }
    result += body[i];
    i++;
  }
  return result;
}

function stripArrowFunctionTypes(body: string): string {
  let result = "";
  let i = 0;
  while (i < body.length) {
    if (body[i] === "(") {
      const closeParen = findMatchingParen(body, i);
      const inner = body.slice(i + 1, closeParen);
      if (/^\s*[A-Za-z_$][\w$]*\s*:/.test(inner)) {
        const after = body.slice(closeParen + 1);
        if (/^\s*=>/.test(after)) {
          result += `(${stripParameterTypes(inner)})`;
          i = closeParen + 1;
          continue;
        }
      }
    }
    result += body[i];
    i++;
  }
  return result;
}

/** Drop TypeScript parameter annotations; keep default initializer expressions. */
function stripParameterTypes(params: string): string {
  const parts: string[] = [];
  let i = 0;
  while (i < params.length) {
    const leading = params.slice(i).match(/^\s*/)?.[0] ?? "";
    i += leading.length;
    if (i >= params.length) break;

    const nameMatch = params.slice(i).match(/^([A-Za-z_$][\w$]*)(\?)?/);
    if (!nameMatch) {
      parts.push(params[i]!);
      i++;
      continue;
    }
    parts.push(leading + nameMatch[1]!);
    i += nameMatch[0].length;

    if (/^\s*:/.test(params.slice(i))) {
      i += params.slice(i).match(/^\s*:\s*/)?.[0].length ?? 0;
      i = skipTypeAnnotation(params, i);
    }

    const defaultStart = params.slice(i).match(/^\s*=\s*/);
    if (defaultStart) {
      const defFrom = i;
      i += defaultStart[0].length;
      i = skipDefaultValue(params, i);
      parts.push(params.slice(defFrom, i));
    }

    const comma = params.slice(i).match(/^\s*,\s*/);
    if (comma && !/^\s*\)/.test(params.slice(i + comma[0].length))) {
      parts.push(", ");
      i += comma[0].length;
    }
  }
  return parts.join("");
}

function stripVariableTypeAnnotations(body: string): string {
  let result = "";
  let i = 0;
  while (i < body.length) {
    const decl = body.slice(i).match(/^(const|let)\s+([A-Za-z_$][\w$]*)\s*:/);
    if (decl) {
      result += `${decl[1]} ${decl[2]}`;
      i += decl[0].length;
      i = skipTypeAnnotation(body, i);
      const ws = body.slice(i).match(/^\s*/)?.[0] ?? "";
      result += ws;
      i += ws.length;
      continue;
    }
    result += body[i];
    i++;
  }
  return result;
}

function stripTypeAssertions(body: string): string {
  return body.replace(
    /\s+as\s+(?:Record<string,\s*unknown>|[A-Za-z_$][\w$]*(?:<[^>]+>)?)/g,
    "",
  );
}

function findMatchingParen(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i]!;
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return source.length - 1;
}

function skipTypeAnnotation(source: string, start: number): number {
  let i = start;
  let depth = 0;
  while (i < source.length) {
    const ch = source[i]!;
    if ("{(<[".includes(ch)) depth++;
    else if ("})>]".includes(ch)) {
      depth--;
      if (depth < 0) return i;
    } else if (depth === 0 && (ch === "=" || ch === ",")) {
      return i;
    }
    i++;
  }
  return i;
}

function skipDefaultValue(source: string, start: number): number {
  let i = start;
  let depth = 0;
  while (i < source.length) {
    const ch = source[i]!;
    if ("{([".includes(ch)) depth++;
    else if ("})]".includes(ch)) depth--;
    else if (depth === 0 && ch === ",") return i;
    i++;
  }
  return i;
}

export function runGeneratedTypeScript(
  source: string,
  sourceCtx: { format: string; data: unknown },
  defaults: Record<string, unknown> = {},
  runtime: GeneratedScriptRuntime = generatedScriptRuntime(),
  sheets: Record<string, unknown> = {},
): unknown {
  const { names, body } = stripGeneratedTypeScript(source);
  const missing = names.filter((name) => !(name in runtime));
  if (missing.length) {
    throw new Error(`Generated script imports unknown symbols: ${missing.join(", ")}`);
  }
  let convert: (
    ctx: { format: string; data: unknown },
    defaults?: Record<string, unknown>,
    sheets?: Record<string, unknown>,
  ) => unknown;
  try {
    convert = new Function(
      ...names,
      `${body}\nif (typeof convertSourceToComposition !== "function") {\n` +
        `  throw new Error("Generated script has no convertSourceToComposition");\n` +
        `}\nreturn convertSourceToComposition;`,
    )(...names.map((name) => runtime[name])) as typeof convert;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Generated TypeScript could not be executed (${detail}):\n${body}`);
  }
  return convert(sourceCtx, defaults, sheets);
}

/** Canonical JSON when the result is an ehrtslib RM tree; otherwise the value as-is. */
export function serializedConversionOutput(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  try {
    const json = new JsonCanonicalSerializer().serialize(value);
    return JSON.parse(json) as unknown;
  } catch {
    return value;
  }
}
