import type { BlocklyJsonDocument } from "./project.ts";

export interface SpecWarningMarker {
  blockId: string;
  from: number;
  message: string;
}

/** Tick top (px) on the overview track from document layout coordinates. */
export function specOverviewTickTopPx(
  lineTop: number,
  lineHeight: number,
  scrollHeight: number,
  trackHeight: number,
  tickHeight = 6,
): number {
  if (scrollHeight <= 0 || trackHeight <= 0) return 0;
  const center = ((lineTop + lineHeight / 2) / scrollHeight) * trackHeight;
  return Math.max(0, Math.min(trackHeight - tickHeight, center - tickHeight / 2));
}

/** Warning markers for the Mapping Spec right-hand overview ruler. */
export function specWarningMarkers(
  doc: BlocklyJsonDocument,
  warnings: Record<string, string>,
): SpecWarningMarker[] {
  const out: SpecWarningMarker[] = [];
  for (const widget of doc.widgets) {
    const ids = [widget.line.blockId, ...(widget.line.aliasIds ?? [])].filter(
      (id): id is string => Boolean(id),
    );
    for (const id of ids) {
      const message = warnings[id];
      if (!message) continue;
      out.push({ blockId: widget.line.blockId ?? id, from: widget.from, message });
      break;
    }
  }
  return out;
}
