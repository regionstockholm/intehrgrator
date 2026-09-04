import type { SheetCell, SheetDocument } from "./types.ts";

/** Parse Excel/Sheets clipboard (tab) or CSV (comma) into a 2D string grid. */
export function parseSpreadsheetText(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!source.trim()) return [];
  const delimiter = detectDelimiter(source);
  return parseDelimited(source, delimiter);
}

export function sheetToCsv(sheet: SheetDocument, includeHeaders = true): string {
  const rows: unknown[][] = [];
  if (includeHeaders) {
    const header = sheet.rowNames ? ["", ...sheet.headers] : [...sheet.headers];
    rows.push(header);
  }
  for (let y = 0; y < sheet.values.length; y++) {
    const row = sheet.values[y] ?? [];
    rows.push(sheet.rowNames ? [sheet.rowNames[y] ?? "", ...row] : [...row]);
  }
  return rows.map((row) => row.map(csvField).join(",")).join("\n") + (rows.length ? "\n" : "");
}

function detectDelimiter(source: string): "," | "\t" {
  const first = source.split("\n").find((line) => line.length > 0) ?? "";
  const tabs = (first.match(/\t/g) ?? []).length;
  const commas = countUnquoted(first, ",");
  return tabs > commas ? "\t" : ",";
}

function countUnquoted(line: string, ch: string): number {
  let n = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (c === ch && !inQuotes) n++;
  }
  return n;
}

function parseDelimited(source: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (inQuotes) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.length) || rows.length) rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  if (inQuotes || field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvField(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function applyParsedGrid(
  headersFromFirstRow: boolean,
  grid: string[][],
): { headers: string[]; values: SheetCell[][] } {
  if (!grid.length) return { headers: [], values: [] };
  if (headersFromFirstRow) {
    const headers = grid[0]!.map((h) => h);
    const values = grid.slice(1).map((row) => row.map((c) => c as SheetCell));
    return { headers, values };
  }
  return { headers: [], values: grid.map((row) => row.map((c) => c as SheetCell)) };
}
