export type SheetColumnType = "text" | "numeric" | "dropdown";

/** JSON primitive stored in a Sheet cell. Nested Blockly values are not cells (see Maps). */
export type SheetCell = string | number | boolean | null;

/** Project-owned grid kind: data Sheet vs mapping Decision table (ADR 0005 / #69). */
export type GridKind = "sheet" | "decision-table";

export type DecisionHitPolicy = "FIRST" | "UNIQUE" | "COLLECT";

export type DecisionColumnRole = "condition" | "output";

/** Output cells: plain values/codes, or VMS-Mustache snippet fragments. */
export type DecisionOutputKind = "value" | "snippet";

/** Blockly check for a value output column (snippet outputs are always string). */
export type DecisionValueType = "string" | "number" | "boolean";

export interface DecisionColumnMeta {
  role: DecisionColumnRole;
  /** Present when `role` is `output`. Defaults to `value`. */
  outputKind?: DecisionOutputKind;
  /** Present when `role` is `output` and `outputKind` is `value`. Defaults to `string`. */
  valueType?: DecisionValueType;
}

export interface SheetDocument {
  name: string;
  /**
   * Distinguishes data Sheets from Decision tables in the same convert-time bag.
   * Omitted / `"sheet"` = terminology / lookup grid (existing behaviour).
   */
  kind?: GridKind;
  headers: string[];
  /** Optional unique row names (leftmost identity column). Same length as `values`. */
  rowNames?: string[];
  values: SheetCell[][];
  columnTypes?: SheetColumnType[];
  /** Decision-table hit policy (`FIRST` default). Ignored for data Sheets. */
  hitPolicy?: DecisionHitPolicy;
  /** Join string for `COLLECT` (default `"; "`). */
  collectJoin?: string;
  /** Parallel to `headers` when `kind === "decision-table"`. */
  decisionColumns?: DecisionColumnMeta[];
}

export type SheetBag = Record<string, SheetDocument>;

export const ROW_NAME_COLUMN = "__row";

export const DONT_CARE_GLYPHS = new Set(["", "—", "–", "-", "*"]);
