/**
 * Decision-table evaluate + lint (#69).
 * Condition columns use equality + don't-care; output columns are values or VMS-Mustache snippets.
 * Local bindings: the inputs record keys are both match keys and snippet Mustache names —
 * callers flatten nested/complex sources into those locals before eval.
 */
import Handlebars from "handlebars";
import { checkVmsMustache, type TemplateDiagnostic } from "../output/vms_hbs.ts";
import { emptySheet } from "./model.ts";
import {
  DONT_CARE_GLYPHS,
  type DecisionColumnMeta,
  type DecisionHitPolicy,
  type DecisionOutputKind,
  type SheetCell,
  type SheetDocument,
} from "./types.ts";

export function isDontCare(cell: SheetCell | undefined): boolean {
  if (cell == null) return true;
  if (typeof cell === "string") return DONT_CARE_GLYPHS.has(cell.trim());
  return false;
}

export function emptyDecisionTable(name = "Decision1", conditionCols = 2, outputCols = 1): SheetDocument {
  const base = emptySheet(name, conditionCols + outputCols, 3);
  const decisionColumns: DecisionColumnMeta[] = [
    ...Array.from({ length: conditionCols }, () => ({ role: "condition" as const })),
    ...Array.from({ length: outputCols }, () => ({
      role: "output" as const,
      outputKind: "value" as DecisionOutputKind,
    })),
  ];
  // Sensible default headers: condA, condB, … out1
  const headers = [
    ...Array.from({ length: conditionCols }, (_, i) => `in${i + 1}`),
    ...Array.from({ length: outputCols }, (_, i) => (outputCols === 1 ? "out" : `out${i + 1}`)),
  ];
  return {
    ...base,
    headers,
    kind: "decision-table",
    hitPolicy: "FIRST",
    collectJoin: "; ",
    decisionColumns,
  };
}

export function isDecisionTable(sheet: SheetDocument): boolean {
  return sheet.kind === "decision-table";
}

function columnMeta(sheet: SheetDocument): DecisionColumnMeta[] {
  const width = sheet.headers.length;
  const raw = sheet.decisionColumns ?? [];
  const out: DecisionColumnMeta[] = [];
  for (let i = 0; i < width; i++) {
    const m = raw[i];
    if (m?.role === "output") {
      out.push({ role: "output", outputKind: m.outputKind ?? "value" });
    } else if (m?.role === "condition") {
      out.push({ role: "condition" });
    } else {
      // Heuristic: last column(s) without meta → treat trailing half as output if none marked
      out.push({ role: "condition" });
    }
  }
  if (!raw.length && width > 0) {
    // Default: all but last are conditions; last is value output
    for (let i = 0; i < width - 1; i++) out[i] = { role: "condition" };
    out[width - 1] = { role: "output", outputKind: "value" };
  }
  return out;
}

function cellsEqual(cell: SheetCell, match: unknown): boolean {
  if (isDontCare(cell)) return true;
  if (cell == null && (match == null || match === "")) return true;
  if (typeof cell === "number" && typeof match === "number") return cell === match;
  if (typeof cell === "boolean" && typeof match === "boolean") return cell === match;
  return String(cell ?? "") === String(match ?? "");
}

function rowMatches(
  sheet: SheetDocument,
  meta: DecisionColumnMeta[],
  y: number,
  inputs: Record<string, unknown>,
): boolean {
  const row = sheet.values[y] ?? [];
  for (let x = 0; x < meta.length; x++) {
    if (meta[x]?.role !== "condition") continue;
    const header = sheet.headers[x] ?? "";
    const cell = row[x] ?? null;
    if (isDontCare(cell)) continue;
    const inputVal = inputs[header];
    if (!cellsEqual(cell, inputVal)) return false;
  }
  return true;
}

function resolveOutputIndex(sheet: SheetDocument, meta: DecisionColumnMeta[], outputColumn?: string): number {
  if (outputColumn != null && outputColumn !== "") {
    const byHeader = sheet.headers.findIndex((h) => h === outputColumn);
    if (byHeader >= 0) return byHeader;
    throw new Error(`Unknown decision-table output column: ${outputColumn}`);
  }
  const firstOut = meta.findIndex((m) => m.role === "output");
  if (firstOut >= 0) return firstOut;
  return Math.max(0, sheet.headers.length - 1);
}

function renderSnippet(template: string, locals: Record<string, unknown>): string {
  if (!template.includes("{{")) return template;
  const engine = Handlebars.create();
  const compiled = engine.compile(template, {
    noEscape: true,
    knownHelpersOnly: true,
    knownHelpers: {},
  });
  return compiled(locals);
}

function cellOutput(
  sheet: SheetDocument,
  meta: DecisionColumnMeta[],
  y: number,
  outIndex: number,
  locals: Record<string, unknown>,
): unknown {
  const cell = sheet.values[y]?.[outIndex] ?? null;
  const kind: DecisionOutputKind = meta[outIndex]?.outputKind ?? "value";
  if (kind === "snippet") {
    return renderSnippet(String(cell ?? ""), locals);
  }
  return cell;
}

/**
 * Evaluate a decision table against local bindings.
 * `inputs` keys match condition column headers (and feed snippet Mustache context).
 * Extra keys beyond condition columns are still available to snippets (decomposition locals).
 */
export function evaluateDecisionTable(
  sheet: SheetDocument,
  inputs: Record<string, unknown>,
  outputColumn?: string,
): unknown {
  if (!isDecisionTable(sheet) && sheet.hitPolicy == null && sheet.decisionColumns == null) {
    // Allow evaluating a grid that forgot kind but has decision meta; otherwise refuse.
  }
  const meta = columnMeta(sheet);
  const policy: DecisionHitPolicy = sheet.hitPolicy ?? "FIRST";
  const join = sheet.collectJoin ?? "; ";
  const outIndex = resolveOutputIndex(sheet, meta, outputColumn);

  const matches: number[] = [];
  for (let y = 0; y < sheet.values.length; y++) {
    if (rowMatches(sheet, meta, y, inputs)) matches.push(y);
  }

  if (matches.length === 0) return null;

  if (policy === "FIRST") {
    return cellOutput(sheet, meta, matches[0]!, outIndex, inputs);
  }

  if (policy === "UNIQUE") {
    if (matches.length > 1) {
      throw new Error(
        `UNIQUE decision table "${sheet.name}" matched ${matches.length} rows for inputs ${JSON.stringify(inputs)}`,
      );
    }
    return cellOutput(sheet, meta, matches[0]!, outIndex, inputs);
  }

  // COLLECT
  const parts = matches.map((y) => cellOutput(sheet, meta, y, outIndex, inputs));
  return parts.map((p) => (p == null ? "" : String(p))).join(join);
}

export interface DecisionTableLintDiagnostic extends TemplateDiagnostic {
  row: number;
  column: string;
}

/** Soft-lint snippet output cells with `checkVmsMustache` (#40 / ADR 0009). */
export function lintDecisionTableSnippets(sheet: SheetDocument): DecisionTableLintDiagnostic[] {
  if (!isDecisionTable(sheet) && !(sheet.decisionColumns?.some((c) => c.outputKind === "snippet"))) {
    return [];
  }
  const meta = columnMeta(sheet);
  const out: DecisionTableLintDiagnostic[] = [];
  for (let y = 0; y < sheet.values.length; y++) {
    for (let x = 0; x < meta.length; x++) {
      if (meta[x]?.role !== "output" || meta[x]?.outputKind !== "snippet") continue;
      const cell = sheet.values[y]?.[x];
      if (cell == null || cell === "") continue;
      const result = checkVmsMustache(String(cell));
      for (const d of result.diagnostics) {
        out.push({
          ...d,
          row: y,
          column: sheet.headers[x] ?? String(x),
          message: `r${y + 1}/${sheet.headers[x] ?? x}: ${d.message}`,
        });
      }
    }
  }
  return out;
}
