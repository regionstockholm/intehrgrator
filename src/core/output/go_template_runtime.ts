/**
 * Go text/template runtime.
 *
 * In-browser execution via WASM (to be built separately as a Go binary
 * compiled with GOOS=js GOARCH=wasm). Until the WASM artifact is vendored,
 * this module provides a stub that formats the generated template and data
 * for inspection but does not execute it.
 *
 * FuncMap (curated Sprig subset): replace, regexReplaceAll, trim, quote,
 * lower, substr, int, ge — plus Go stdlib builtins (index, eq, ne, and, or,
 * not, len, print, printf, println).
 */

let wasmExecutor: ((template: string, dataJson: string) => string) | null = null;

/**
 * Register the WASM-backed Go template executor.
 * Called once after the .wasm module is loaded and instantiated.
 */
export function registerGoTemplateWasm(
  executor: (template: string, dataJson: string) => string,
): void {
  wasmExecutor = executor;
}

/**
 * Execute a Go text/template against a JSON-serializable data envelope.
 *
 * @param templateSource - The Go template source code.
 * @param data - Execute context (typically `{ Parameters, Data }`).
 * @returns Rendered output string.
 * @throws When no WASM runtime is loaded.
 */
export function executeGoTemplate(
  templateSource: string,
  data: unknown,
): string {
  const dataJson = JSON.stringify(data);
  if (wasmExecutor) {
    return wasmExecutor(templateSource, dataJson);
  }
  throw new Error(
    "Go template WASM runtime is not loaded. " +
    "The Go template Conversion Test Run requires the WASM artifact. " +
    "See docs/ROADMAP.md §G for build instructions.",
  );
}

/** Check whether the WASM runtime is available. */
export function isGoTemplateWasmLoaded(): boolean {
  return wasmExecutor !== null;
}
