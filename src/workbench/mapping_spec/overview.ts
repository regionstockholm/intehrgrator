import type { BlocklyJsonDocument } from "./project.ts";

export interface SpecWarningMarker {
  blockId: string;
  from: number;
  ratio: number;
  message: string;
}

/** Tick positions for the Mapping Spec right-hand overview ruler. */
export function specWarningMarkers(
  doc: BlocklyJsonDocument,
  warnings: Record<string, string>,
  docLength: number,
): SpecWarningMarker[] {
  const denom = Math.max(docLength, 1);
  const out: SpecWarningMarker[] = [];
  for (const widget of doc.widgets) {
    const blockId = widget.line.blockId;
    if (!blockId) continue;
    const message = warnings[blockId];
    if (!message) continue;
    out.push({
      blockId,
      from: widget.from,
      ratio: widget.from / denom,
      message,
    });
  }
  return out;
}
