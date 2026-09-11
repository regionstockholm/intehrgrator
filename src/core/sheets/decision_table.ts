/**
 * Decision-table evaluate + lint (#69).
 * Condition columns use equality + don't-care; output columns are values or VMS-Mustache snippets.
 * Local bindings: the inputs record keys are both match keys and snippet Mustache names —
 * callers flatten nested/complex sources into those locals before eval.
 */
import Handlebars from "handlebars";
import { checkVmsMustache, type TemplateDiagnostic } from "../output/vms_hbs.ts";
import { indexToLetters } from "./a1.ts";
import { cloneSheet, emptySheet } from "./model.ts";
import {
  DONT_CARE_GLYPHS,
  type DecisionColumnMeta,
  type DecisionColumnRole,
  type DecisionHitPolicy,
  type DecisionOutputKind,
  type DecisionValueType,
  type SheetCell,
  type SheetDocument,
} from "./types.ts";

/** OUTPUT field / expression sentinel: return a Map of every output column. */
export const DECISION_ALL_OUTPUTS = "*";

export const DECISION_PREVIEW_COLS = 3;
export const DECISION_PREVIEW_ROWS = 3;

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
      valueType: "string" as DecisionValueType,
    })),
  ];
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

export function isAllOutputs(output: string | undefined | null): boolean {
  return output === DECISION_ALL_OUTPUTS;
}

export function decisionColumnMeta(sheet: SheetDocument): DecisionColumnMeta[] {
  const width = sheet.headers.length;
  const raw = sheet.decisionColumns ?? [];
  const out: DecisionColumnMeta[] = [];
  for (let i = 0; i < width; i++) {
    const m = raw[i];
    if (m?.role === "output") {
      const outputKind: DecisionOutputKind = m.outputKind ?? "value";
      const valueType: DecisionValueType = outputKind === "snippet"
        ? "string"
        : (m.valueType === "number" || m.valueType === "boolean" ? m.valueType : "string");
      out.push({ role: "output", outputKind, valueType });
    } else if (m?.role === "condition") {
      out.push({ role: "condition" });
    } else {
      out.push({ role: "condition" });
    }
  }
  if (!raw.length && width > 0) {
    for (let i = 0; i < width - 1; i++) out[i] = { role: "condition" };
    out[width - 1] = { role: "output", outputKind: "value", valueType: "string" };
  }
  return out;
}

export function conditionHeaders(sheet: SheetDocument): string[] {
  const meta = decisionColumnMeta(sheet);
  return sheet.headers.filter((_, i) => meta[i]?.role === "condition");
}

export function outputHeaders(sheet: SheetDocument): string[] {
  const meta = decisionColumnMeta(sheet);
  return sheet.headers.filter((_, i) => meta[i]?.role === "output");
}

export function outputValueType(sheet: SheetDocument, header: string): DecisionValueType {
  const meta = decisionColumnMeta(sheet);
  const i = sheet.headers.findIndex((h) => h === header);
  if (i < 0) return "string";
  const col = meta[i];
  if (col?.role !== "output") return "string";
  if (col.outputKind === "snippet") return "string";
  return col.valueType === "number" || col.valueType === "boolean" ? col.valueType : "string";
}

export function blocklyCheckForValueType(type: DecisionValueType): string {
  if (type === "number") return "Number";
  if (type === "boolean") return "Boolean";
  return "String";
}

export function blocklyCheckForDecisionOutput(
  sheet: SheetDocument | undefined,
  output: string | undefined,
): string {
  if (isAllOutputs(output)) return "Map";
  if (!sheet || !output) return "String";
  return blocklyCheckForValueType(outputValueType(sheet, output));
}

export function coerceOutputValue(value: unknown, type: DecisionValueType): unknown {
  if (value == null || value === "") return value;
  if (type === "number") {
    if (typeof value === "number") return value;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    const s = String(value).trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
    return value;
  }
  return typeof value === "string" ? value : String(value);
}

/**
 * Map each new condition-key index to an old index (or null for a fresh column).
 * Same length → rename-in-place (keep index). Different length → match by name.
 */
export function alignMapKeys(oldKeys: string[], newKeys: string[]): Array<number | null> {
  if (oldKeys.length === newKeys.length) {
    return newKeys.map((_, i) => i);
  }
  const used = new Set<number>();
  return newKeys.map((key) => {
    const idx = oldKeys.findIndex((old, i) => old === key && !used.has(i));
    if (idx >= 0) {
      used.add(idx);
      return idx;
    }
    return null;
  });
}

export function uniqueDecisionHeader(headers: string[], base: string): string {
  if (!headers.includes(base)) return base;
  let i = 2;
  while (headers.includes(`${base}${i}`)) i++;
  return `${base}${i}`;
}

export function addDecisionColumn(
  sheet: SheetDocument,
  role: DecisionColumnRole,
): SheetDocument {
  const next = cloneSheet(sheet);
  const meta = decisionColumnMeta(next);
  if (role === "condition") {
    const firstOut = meta.findIndex((m) => m.role === "output");
    const at = firstOut < 0 ? next.headers.length : firstOut;
    const name = uniqueDecisionHeader(next.headers, `in${conditionHeaders(next).length + 1}`);
    next.headers.splice(at, 0, name);
    meta.splice(at, 0, { role: "condition" });
    next.columnTypes?.splice(at, 0, "text");
    for (const row of next.values) row.splice(at, 0, "");
  } else {
    const outs = outputHeaders(next);
    const name = uniqueDecisionHeader(
      next.headers,
      outs.length === 0 ? "out" : `out${outs.length + 1}`,
    );
    next.headers.push(name);
    meta.push({ role: "output", outputKind: "value", valueType: "string" });
    next.columnTypes?.push("text");
    for (const row of next.values) row.push("");
  }
  next.decisionColumns = meta;
  return next;
}

export function setDecisionHeader(sheet: SheetDocument, index: number, title: string): SheetDocument {
  const next = cloneSheet(sheet);
  if (index < 0 || index >= next.headers.length) return next;
  const trimmed = title.trim();
  if (!trimmed) return next;
  next.headers[index] = uniqueDecisionHeader(
    next.headers.filter((_, i) => i !== index),
    trimmed,
  );
  return next;
}

export function setDecisionOutputKind(
  sheet: SheetDocument,
  index: number,
  outputKind: DecisionOutputKind,
): SheetDocument {
  const next = cloneSheet(sheet);
  const meta = decisionColumnMeta(next);
  const col = meta[index];
  if (!col || col.role !== "output") return next;
  col.outputKind = outputKind;
  if (outputKind === "snippet") col.valueType = "string";
  next.decisionColumns = meta;
  return next;
}

export function setDecisionValueType(
  sheet: SheetDocument,
  index: number,
  valueType: DecisionValueType,
): SheetDocument {
  const next = cloneSheet(sheet);
  const meta = decisionColumnMeta(next);
  const col = meta[index];
  if (!col || col.role !== "output") return next;
  if (col.outputKind === "snippet") return next;
  col.valueType = valueType;
  next.decisionColumns = meta;
  return next;
}

/** Drop trailing empty letter-named columns (viewport padding leaked into the document). */
export function trimDecisionTableSpareColumns(sheet: SheetDocument): SheetDocument {
  if (!isDecisionTable(sheet)) return sheet;
  let width = sheet.headers.length;
  while (width > 1) {
    const i = width - 1;
    const header = (sheet.headers[i] ?? "").trim();
    const letter = indexToLetters(i);
    const empty = sheet.values.every((row) => {
      const c = row[i];
      return c == null || c === "";
    });
    if ((header === "" || header === letter) && empty) width--;
    else break;
  }
  if (width === sheet.headers.length) return sheet;
  const next = cloneSheet(sheet);
  next.headers = next.headers.slice(0, width);
  next.columnTypes = next.columnTypes?.slice(0, width);
  next.decisionColumns = (next.decisionColumns ?? decisionColumnMeta(sheet)).slice(0, width);
  next.values = next.values.map((row) => row.slice(0, width));
  return next;
}

export function previewGrid(
  sheet: SheetDocument,
  maxCols = DECISION_PREVIEW_COLS,
  maxRows = DECISION_PREVIEW_ROWS,
): { headers: string[]; rows: SheetCell[][] } {
  const cols = Math.min(Math.max(1, maxCols), Math.max(sheet.headers.length, 1));
  const headers = sheet.headers.slice(0, cols);
  while (headers.length < cols) headers.push("");
  const rows = sheet.values.slice(0, maxRows).map((row) => {
    const cells = row.slice(0, cols);
    while (cells.length < cols) cells.push("");
    return cells;
  });
  return { headers, rows };
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
  if (outputColumn != null && outputColumn !== "" && !isAllOutputs(outputColumn)) {
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
  const col = meta[outIndex];
  const kind: DecisionOutputKind = col?.outputKind ?? "value";
  if (kind === "snippet") {
    return renderSnippet(String(cell ?? ""), locals);
  }
  const type: DecisionValueType = col?.valueType === "number" || col?.valueType === "boolean"
    ? col.valueType
    : "string";
  return coerceOutputValue(cell, type);
}

function rowOutputRecord(
  sheet: SheetDocument,
  meta: DecisionColumnMeta[],
  y: number,
  locals: Record<string, unknown>,
): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (let x = 0; x < meta.length; x++) {
    if (meta[x]?.role !== "output") continue;
    rec[sheet.headers[x] ?? String(x)] = cellOutput(sheet, meta, y, x, locals);
  }
  return rec;
}

/**
 * Evaluate a decision table against local bindings.
 * `inputs` keys match condition column headers (and feed snippet Mustache context).
 * Pass `outputColumn` `"*"` (`DECISION_ALL_OUTPUTS`) to return a Map of every output column.
 */
export function evaluateDecisionTable(
  sheet: SheetDocument,
  inputs: Record<string, unknown>,
  outputColumn?: string,
): unknown {
  const meta = decisionColumnMeta(sheet);
  const policy: DecisionHitPolicy = sheet.hitPolicy ?? "FIRST";
  const join = sheet.collectJoin ?? "; ";
  const all = isAllOutputs(outputColumn);

  const matches: number[] = [];
  for (let y = 0; y < sheet.values.length; y++) {
    if (rowMatches(sheet, meta, y, inputs)) matches.push(y);
  }

  if (matches.length === 0) return null;

  const first = (): unknown =>
    all
      ? rowOutputRecord(sheet, meta, matches[0]!, inputs)
      : cellOutput(sheet, meta, matches[0]!, resolveOutputIndex(sheet, meta, outputColumn), inputs);

  if (policy === "FIRST") return first();

  if (policy === "UNIQUE") {
    if (matches.length > 1) {
      throw new Error(
        `UNIQUE decision table "${sheet.name}" matched ${matches.length} rows for inputs ${JSON.stringify(inputs)}`,
      );
    }
    return first();
  }

  if (all) {
    const rec: Record<string, unknown> = {};
    for (const header of outputHeaders(sheet)) {
      const idx = sheet.headers.indexOf(header);
      const parts = matches.map((y) => cellOutput(sheet, meta, y, idx, inputs));
      rec[header] = parts.map((p) => (p == null ? "" : String(p))).join(join);
    }
    return rec;
  }

  const outIndex = resolveOutputIndex(sheet, meta, outputColumn);
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
  const meta = decisionColumnMeta(sheet);
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
