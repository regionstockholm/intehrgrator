/** A1 notation: column 0 = A, row 0 = 1. */

export interface SheetCoords {
  /** 0-based column. */
  x: number;
  /** 0-based row. */
  y: number;
}

export function lettersToIndex(letters: string): number {
  const upper = letters.toUpperCase();
  let n = 0;
  for (const ch of upper) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) throw new Error(`Invalid column letters: ${letters}`);
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

export function indexToLetters(index: number): string {
  if (!Number.isInteger(index) || index < 0) throw new Error(`Invalid column index: ${index}`);
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function parseA1(ref: string): SheetCoords {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!m) throw new Error(`Invalid A1 reference: ${ref}`);
  const y = Number(m[2]) - 1;
  if (y < 0) throw new Error(`Invalid A1 reference: ${ref}`);
  return { x: lettersToIndex(m[1]!), y };
}

export function coordsToA1(x: number, y: number): string {
  return `${indexToLetters(x)}${y + 1}`;
}
