/**
 * Debounced @codemirror/lint sources for VMS-Hbs / VMS-Go (ADR 0009 / #40).
 * Warning severity, autoPanel: false — authors can still type; convert is the hard gate.
 */
import { linter, type Diagnostic } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import { checkVmsHbs } from "../core/output/vms_hbs.ts";
import { checkVmsGoSync } from "../core/output/vms_go.ts";

const LINT_DELAY_MS = 600;

function toDiagnostics(
  docLength: number,
  messages: Array<{ message: string; from?: number; to?: number }>,
): Diagnostic[] {
  return messages.map((d) => {
    const from = clamp(d.from ?? 0, 0, docLength);
    const to = clamp(d.to ?? Math.min(docLength, from + 1), from, docLength);
    return {
      from,
      to: to === from && docLength > from ? from + 1 : to,
      severity: "warning" as const,
      message: d.message,
    };
  });
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Lint extensions for Handlebars / Go template panes (empty for other langs). */
export function vmsTemplateLintExtensions(
  language: "handlebars" | "go-template" | string,
): Extension[] {
  if (language === "handlebars") {
    return [
      linter((view) => {
        const text = view.state.doc.toString();
        const result = checkVmsHbs(text);
        return toDiagnostics(view.state.doc.length, result.diagnostics);
      }, { delay: LINT_DELAY_MS, autoPanel: false }),
    ];
  }
  if (language === "go-template") {
    return [
      linter((view) => {
        const text = view.state.doc.toString();
        const result = checkVmsGoSync(text);
        return toDiagnostics(view.state.doc.length, result.diagnostics);
      }, { delay: LINT_DELAY_MS, autoPanel: false }),
    ];
  }
  return [];
}
