/**
 * Go text/template runtime via vendored WASM (`web/wasm/go_texttemplate.wasm`).
 *
 * Rebuild with `deno task wasm:go-template` when `go/texttemplate` changes.
 * FuncMap (curated Sprig subset): replace, regexReplaceAll, trim, quote,
 * lower, upper, substr, int — plus Go stdlib builtins (index, eq, ne, and,
 * or, not, len) and host-bound `handlebars` / `dict` / `decisionTable` /
 * `sheetLookup` (ADR 0005 / 0009).
 *
 * `regexReplaceAll` is Sprig/Helm `regexReplaceAll REGEX SRC REPLACEMENT`
 * (chemo `cleanAndQuoteFreeTextInput`), not `src | regexReplaceAll REGEX REPL`.
 */
import { fromFileUrl } from "@std/path";
import { renderHandlebars } from "./handlebars_dialect.ts";
import { evaluateDecisionTable } from "../sheets/decision_table.ts";
import { normalizeSheet, sheetLookup, sheetsToBag } from "../sheets/model.ts";
import type { SheetBag, SheetDocument } from "../sheets/types.ts";

interface GoRuntime {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

let wasmExecutor: ((template: string, dataJson: string, sheetsJson?: string) => string) | null = null;
let loading: Promise<void> | null = null;

export function registerGoTemplateWasm(
  executor: (template: string, dataJson: string, sheetsJson?: string) => string,
): void {
  wasmExecutor = executor;
}

/** After WASM load, expose check for VMS-Go lint (ADR 0009 / #40). */
export function goTemplateCheckRaw(templateSource: string): string {
  const check = (globalThis as { goTextTemplateCheck?: (t: string) => string })
    .goTextTemplateCheck;
  if (typeof check !== "function") {
    return JSON.stringify({
      ok: false,
      diagnostics: [{ message: "goTextTemplateCheck is not available" }],
    });
  }
  return check(templateSource);
}

export function isGoTemplateWasmLoaded(): boolean {
  return wasmExecutor !== null;
}

/** Load the vendored WASM module (idempotent). */
export function ensureGoTemplateWasm(): Promise<void> {
  installHandlebarsHost();
  installSheetHosts();
  if (wasmExecutor) return Promise.resolve();
  if (!loading) loading = instantiateGoTemplateWasm();
  return loading;
}

export function executeGoTemplate(
  templateSource: string,
  data: unknown,
  options?: { sheets?: SheetDocument[] | SheetBag },
): string {
  installHandlebarsHost();
  installSheetHosts();
  const dataJson = JSON.stringify(data);
  const sheetsJson = JSON.stringify(sheetBagFrom(options?.sheets));
  if (!wasmExecutor) {
    throw new Error(
      "Go template WASM runtime is not loaded. " +
        "Call ensureGoTemplateWasm() before Conversion Test Run, " +
        "or rebuild with `deno task wasm:go-template`.",
    );
  }
  const raw = wasmExecutor(templateSource, dataJson, sheetsJson);
  const parsed = parseWasmResult(raw);
  if (!parsed.ok) {
    throw new Error(parsed.error || "Go template execution failed");
  }
  return parsed.output;
}

function parseWasmResult(raw: string): { ok: boolean; output: string; error?: string } {
  try {
    const value = JSON.parse(raw) as { ok?: boolean; output?: string; error?: string };
    return {
      ok: Boolean(value.ok),
      output: String(value.output ?? ""),
      error: value.error,
    };
  } catch {
    return { ok: false, error: raw, output: "" };
  }
}

function installHandlebarsHost(): void {
  const global = globalThis as { goTextTemplateHandlebars?: (template: string, contextJson: string) => string };
  global.goTextTemplateHandlebars = (template, contextJson) => {
    let context: unknown = {};
    try {
      context = JSON.parse(contextJson);
    } catch {
      context = {};
    }
    return renderHandlebars(String(template ?? ""), context ?? {});
  };
}

function installSheetHosts(): void {
  const global = globalThis as {
    goTextTemplateDecisionTable?: (sheetJson: string, inputsJson: string, outputColJson: string) => string;
    goTextTemplateSheetLookup?: (
      sheetJson: string,
      matchColJson: string,
      matchValJson: string,
      returnColJson: string,
    ) => string;
  };
  global.goTextTemplateDecisionTable = (sheetJson, inputsJson, outputColJson) => {
    try {
      const sheet = parseSheet(sheetJson);
      if (!sheet) return hostOk("");
      const inputs = parseObject(inputsJson);
      const outputCol = parseJson(outputColJson);
      const column = outputCol == null || outputCol === "" ? undefined : String(outputCol);
      const value = evaluateDecisionTable(sheet, inputs, column);
      return hostOk(value ?? "");
    } catch (err) {
      return hostErr(err);
    }
  };
  global.goTextTemplateSheetLookup = (sheetJson, matchColJson, matchValJson, returnColJson) => {
    try {
      const sheet = parseSheet(sheetJson);
      if (!sheet) return hostOk("");
      const matchCol = parseJson(matchColJson);
      const matchVal = parseJson(matchValJson);
      const returnCol = parseJson(returnColJson);
      const value = sheetLookup(
        sheet,
        matchCol as string | number,
        matchVal,
        returnCol == null || returnCol === "" ? undefined : returnCol as string | number,
      );
      return hostOk(value ?? "");
    } catch (err) {
      return hostErr(err);
    }
  };
}

function sheetBagFrom(sheets: SheetDocument[] | SheetBag | undefined): SheetBag {
  if (!sheets) return {};
  if (Array.isArray(sheets)) return sheetsToBag(sheets);
  return sheets;
}

function parseSheet(sheetJson: string): SheetDocument | null {
  const raw = parseJson(sheetJson);
  if (!raw || typeof raw !== "object") return null;
  try {
    return normalizeSheet(raw);
  } catch {
    return null;
  }
}

function parseObject(json: string): Record<string, unknown> {
  const value = parseJson(json);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json || "null");
  } catch {
    return json;
  }
}

function hostOk(value: unknown): string {
  return JSON.stringify({ ok: true, value });
}

function hostErr(err: unknown): string {
  return JSON.stringify({
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  });
}

async function instantiateGoTemplateWasm(): Promise<void> {
  installHandlebarsHost();
  installSheetHosts();
  await ensureWasmExec();
  const GoCtor = (globalThis as unknown as { Go?: new () => GoRuntime }).Go;
  if (!GoCtor) {
    throw new Error("Go WASM glue (wasm_exec.js) did not define globalThis.Go");
  }
  const go = new GoCtor();
  const bytes = await readWasmBytes();
  const result = await WebAssembly.instantiate(bytes, go.importObject);
  void go.run(result.instance);
  await waitUntil(() => Boolean((globalThis as { goTextTemplateReady?: boolean }).goTextTemplateReady));
  const execute = (globalThis as { goTextTemplateExecute?: (t: string, d: string, s?: string) => string })
    .goTextTemplateExecute;
  if (typeof execute !== "function") {
    throw new Error("Go WASM module did not export goTextTemplateExecute");
  }
  wasmExecutor = execute;
  // Ensure VMS-Go checker can resolve without a separate register call.
  const { registerGoTemplateCheck } = await import("./vms_go.ts");
  registerGoTemplateCheck(goTemplateCheckRaw);
}

async function ensureWasmExec(): Promise<void> {
  if ((globalThis as { Go?: unknown }).Go) return;
  const source = await readTextAsset("wasm_exec.js");
  // deno-lint-ignore no-eval -- Go's wasm_exec.js is classic script glue.
  (0, eval)(source);
}

async function readWasmBytes(): Promise<Uint8Array> {
  const deno = (globalThis as { Deno?: { readFile(path: string): Promise<Uint8Array> } }).Deno;
  if (deno?.readFile) {
    return await deno.readFile(denoAssetPath("go_texttemplate.wasm"));
  }
  const response = await fetch(browserAssetUrl("go_texttemplate.wasm"));
  if (!response.ok) {
    throw new Error(`Failed to fetch Go template WASM (${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function readTextAsset(filename: string): Promise<string> {
  const deno = (globalThis as { Deno?: { readTextFile(path: string): Promise<string> } }).Deno;
  if (deno?.readTextFile) {
    return await deno.readTextFile(denoAssetPath(filename));
  }
  const response = await fetch(browserAssetUrl(filename));
  if (!response.ok) {
    throw new Error(`Failed to fetch ${filename} (${response.status})`);
  }
  return await response.text();
}

function denoAssetPath(filename: string): string {
  const meta = import.meta.url;
  if (meta.startsWith("file:")) {
    const wasmDir = new URL("../../../web/wasm/", meta);
    // fromFileUrl avoids Windows pathname form `/C:/...` which Deno rejects (os error 123).
    return fromFileUrl(new URL(filename, wasmDir));
  }
  return `web/wasm/${filename}`;
}

function browserAssetUrl(filename: string): string {
  return new URL(`wasm/${filename}`, document.baseURI).href;
}

async function waitUntil(ok: () => boolean, attempts = 100): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    if (ok()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Go template WASM did not become ready");
}
