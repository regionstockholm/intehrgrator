/**
 * Lazy in-app XQuery runtime for Conversion Test Run (issue #78).
 *
 * fontoxpath (XQuery 3.1) + slimdom node factory load on first use via
 * dynamic `import()` — Mapping preview / TypeScript paths do not pay that cost.
 */
import type { SheetBag } from "../sheets/types.ts";

type FontoxpathApi = typeof import("fontoxpath");
type SlimdomApi = typeof import("slimdom");

let fx: FontoxpathApi | null = null;
let slim: SlimdomApi | null = null;
let loading: Promise<void> | null = null;

const XQUERY_ENGINE_DOCS = "docs/agents/xquery-engine.md";

export function isXQueryRuntimeLoaded(): boolean {
  return fx !== null && slim !== null;
}

export function xqueryRuntimeUnavailableMessage(): string {
  return (
    `// XQuery runtime is not loaded yet.\n` +
    `// Select XQuery Output mode to lazy-load fontoxpath + slimdom, or run the generated .xq with BaseX.\n` +
    `// Server-side golden path: ${XQUERY_ENGINE_DOCS}\n`
  );
}

/** Load the XQuery engine. Idempotent; first call pays for dynamic imports. */
export function ensureXQueryRuntime(): Promise<void> {
  if (isXQueryRuntimeLoaded()) return Promise.resolve();
  if (!loading) loading = loadRuntime();
  return loading;
}

async function loadRuntime(): Promise<void> {
  const [fonto, slimdom] = await Promise.all([
    import("fontoxpath"),
    import("slimdom"),
  ]);
  fx = fonto;
  slim = slimdom;
}

export function sheetsBagToXQueryMap(bag: SheetBag): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, sheet] of Object.entries(bag)) {
    const rows = sheet.values.map((row, y) => {
      const rec: Record<string, unknown> = {};
      if (sheet.rowNames) rec.__row = sheet.rowNames[y] ?? "";
      sheet.headers.forEach((header, x) => {
        rec[header || String(x)] = row[x] ?? null;
      });
      return rec;
    });
    out[name] = {
      name: sheet.name,
      kind: sheet.kind ?? "sheet",
      headers: [...sheet.headers],
      values: sheet.values.map((row) => [...row]),
      rows,
      rowNames: sheet.rowNames ? [...sheet.rowNames] : [],
      hitPolicy: sheet.hitPolicy ?? "FIRST",
      collectJoin: sheet.collectJoin ?? "; ",
      collectDedupe: Boolean(sheet.collectDedupe),
      decisionColumns: (sheet.decisionColumns ?? []).map((col) => ({ ...col })),
      rowCatchAll: sheet.rowCatchAll ? [...sheet.rowCatchAll] : [],
    };
  }
  return out;
}

export interface RunXQueryBindings {
  source: unknown;
  defaults?: Record<string, unknown>;
  sheets?: SheetBag | Record<string, unknown>;
}

export function runGeneratedXQuery(
  source: string,
  bindings: RunXQueryBindings,
): unknown {
  if (!fx || !slim) {
    throw new Error(
      "XQuery runtime is not loaded. Call ensureXQueryRuntime() first, " +
        `or run the .xq with BaseX (${XQUERY_ENGINE_DOCS}).`,
    );
  }
  const doc = new slim.Document();
  const factory = {
    createDocument: () => new slim!.Document(),
    createElementNS: (ns: string, name: string) => doc.createElementNS(ns, name),
    createTextNode: (data: string) => doc.createTextNode(data),
    createComment: (data: string) => doc.createComment(data),
    createCDATASection: (data: string) => doc.createCDATASection(data),
    createProcessingInstruction: (target: string, data: string) =>
      doc.createProcessingInstruction(target, data),
    createAttributeNS: (ns: string, name: string) => doc.createAttributeNS(ns, name),
  };
  const sheets = isSheetBag(bindings.sheets)
    ? sheetsBagToXQueryMap(bindings.sheets)
    : (bindings.sheets ?? {});
  const prepared = stripEngineOnlyOptions(source);
  const raw = fx.evaluateXPath(
    prepared,
    doc,
    null,
    {
      source: bindings.source ?? {},
      defaults: bindings.defaults ?? {},
      sheets,
    },
    undefined,
    {
      language: fx.evaluateXPath.XQUERY_3_1_LANGUAGE,
      nodesFactory: factory,
      namespaceResolver: xqueryNamespaceResolver,
      xmlSerializer: {
        serializeToString: (node: unknown) => slim!.serializeToWellFormedString(node as never),
      },
    },
  );
  return serializeXQueryValue(raw);
}

function isSheetBag(value: unknown): value is SheetBag {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).some((item) =>
    Boolean(item && typeof item === "object" && "headers" in item && "values" in item)
  );
}

/** Prolog bits for BaseX/Saxon that fontoxpath rejects (reserved NS / serialization). */
function stripEngineOnlyOptions(source: string): string {
  return source
    .replace(/^declare namespace output = [^\n]+\n?/gm, "")
    .replace(/^declare namespace map = [^\n]+\n?/gm, "")
    .replace(/^declare namespace array = [^\n]+\n?/gm, "")
    .replace(/^declare option output:[^\n]+\n?/gm, "");
}

function xqueryNamespaceResolver(prefix: string): string | null {
  // Never bind the empty prefix to the functions NS: fontoxpath then treats
  // `declare variable $source` as landing in a reserved URI (XQST0045).
  if (prefix === "") return null;
  if (prefix === "local") return "http://www.w3.org/2005/xquery-local-functions";
  if (prefix === "xs") return "http://www.w3.org/2001/XMLSchema";
  if (prefix === "fn") return "http://www.w3.org/2005/xpath-functions";
  if (prefix === "rm") return "http://schemas.openehr.org/v1";
  if (prefix === "xsi") return "http://www.w3.org/2001/XMLSchema-instance";
  if (prefix === "map") return "http://www.w3.org/2005/xpath-functions/map";
  if (prefix === "array") return "http://www.w3.org/2005/xpath-functions/array";
  if (prefix === "output") return "http://www.w3.org/2010/xslt-xquery-serialization";
  return null;
}

function serializeXQueryValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(serializeXQueryValue);
  if (isDomNode(value)) {
    return slim!.serializeToWellFormedString(value as never);
  }
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(rec)) {
      out[key] = serializeXQueryValue(item);
    }
    return out;
  }
  return String(value);
}

function isDomNode(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      "nodeType" in value &&
      typeof (value as { nodeType: unknown }).nodeType === "number",
  );
}
