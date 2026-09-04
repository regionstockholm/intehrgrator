export type SheetColumnType = "text" | "numeric" | "dropdown";

/** JSON primitive stored in a Sheet cell. Nested Blockly values are not cells (see Maps). */
export type SheetCell = string | number | boolean | null;

export interface SheetDocument {
  name: string;
  headers: string[];
  /** Optional unique row names (leftmost identity column). Same length as `values`. */
  rowNames?: string[];
  values: SheetCell[][];
  columnTypes?: SheetColumnType[];
}

export type SheetBag = Record<string, SheetDocument>;

export const ROW_NAME_COLUMN = "__row";
