/**
 * Go text/template runtime via vendored WASM (`web/wasm/go_texttemplate.wasm`).
 *
 * Rebuild with `deno task wasm:go-template` when `go/texttemplate` changes.
 * FuncMap (curated Sprig subset): replace, regexReplaceAll, trim, quote,
 * lower, upper, substr, int — plus Go stdlib builtins (index, eq, ne, and,
 * or, not, len, print, printf, println, template, define).
 */

interface GoRuntime {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

let wasmExecutor: ((template: string, dataJson: string) => string) | null = null;
let loading: Promise<void> | null = null;

export function registerGoTemplateWasm(
  executor: (template: string, dataJson: string) => string,
): void {
  wasmExecutor = executor;
}

export function isGoTemplateWasmLoaded(): boolean {
  return wasmExecutor !== null;
}

/** Load the vendored WASM module (idempotent). */
export function ensureGoTemplateWasm(): Promise<void> {
  if (wasmExecutor) return Promise.resolve();
  if (!loading) loading = instantiateGoTemplateWasm();
  return loading;
}

export function executeGoTemplate(
  templateSource: string,
  data: unknown,
): string {
  const dataJson = JSON.stringify(data);
  if (!wasmExecutor) {
    throw new Error(
      "Go template WASM runtime is not loaded. " +
        "Call ensureGoTemplateWasm() before Conversion Test Run, " +
        "or rebuild with `deno task wasm:go-template`.",
    );
  }
  const raw = wasmExecutor(templateSource, dataJson);
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

async function instantiateGoTemplateWasm(): Promise<void> {
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
  const execute = (globalThis as { goTextTemplateExecute?: (t: string, d: string) => string })
    .goTextTemplateExecute;
  if (typeof execute !== "function") {
    throw new Error("Go WASM module did not export goTextTemplateExecute");
  }
  wasmExecutor = execute;
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
    return decodeURIComponent(new URL(filename, wasmDir).pathname);
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
