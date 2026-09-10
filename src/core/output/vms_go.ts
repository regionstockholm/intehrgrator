/**
 * VMS-Go checker (ADR 0009) via vendored Go text/template WASM.
 */
import {
  ensureGoTemplateWasm,
  isGoTemplateWasmLoaded,
} from "./go_template_runtime.ts";
import type { TemplateCheckResult, TemplateDiagnostic } from "./vms_hbs.ts";

export type { TemplateCheckResult, TemplateDiagnostic };

let checkFn: ((template: string) => string) | null = null;

/** Register a check executor (tests / custom hosts). */
export function registerGoTemplateCheck(
  executor: (template: string) => string,
): void {
  checkFn = executor;
}

function resolveCheckFn(): ((template: string) => string) | null {
  if (checkFn) return checkFn;
  const globalFn = (globalThis as {
    goTextTemplateCheck?: (t: string) => string;
  }).goTextTemplateCheck;
  return typeof globalFn === "function" ? globalFn : null;
}

function parseCheckResult(raw: string): TemplateCheckResult {
  try {
    const value = JSON.parse(raw) as {
      ok?: boolean;
      diagnostics?: Array<{ message?: string }>;
      error?: string;
    };
    const diagnostics: TemplateDiagnostic[] = (value.diagnostics ?? [])
      .map((d) => ({
        message: String(d.message ?? "VMS-Go violation"),
        severity: "warning" as const,
      }));
    if (!value.ok && diagnostics.length === 0 && value.error) {
      diagnostics.push({ message: value.error, severity: "warning" });
    }
    return { ok: Boolean(value.ok) && diagnostics.length === 0, diagnostics };
  } catch {
    return {
      ok: false,
      diagnostics: [{ message: raw || "VMS-Go check failed", severity: "warning" }],
    };
  }
}

/** Soft-check a Go text/template against VMS-Go. Loads WASM if needed. */
export async function checkVmsGo(source: string): Promise<TemplateCheckResult> {
  if (!resolveCheckFn()) {
    await ensureGoTemplateWasm();
  }
  const fn = resolveCheckFn();
  if (!fn) {
    return {
      ok: false,
      diagnostics: [{
        message: "Go template checker is not loaded (rebuild with deno task wasm:go-template)",
        severity: "warning",
      }],
    };
  }
  return parseCheckResult(fn(source));
}

export async function isVmsGo(source: string): Promise<boolean> {
  return (await checkVmsGo(source)).ok;
}

/** Sync check when WASM is already loaded (CodeMirror lint source). */
export function checkVmsGoSync(source: string): TemplateCheckResult {
  const fn = resolveCheckFn();
  if (!fn) {
    if (!isGoTemplateWasmLoaded()) {
      return { ok: true, diagnostics: [] }; // defer until WASM ready
    }
    return {
      ok: false,
      diagnostics: [{
        message: "Go template checker is not loaded",
        severity: "warning",
      }],
    };
  }
  return parseCheckResult(fn(source));
}
