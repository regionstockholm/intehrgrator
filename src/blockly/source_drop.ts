/**
 * Source-tree → Blockly canvas drop targeting.
 *
 * Slot hits must be **value-slot** blocks (`element`, generic values, DV_*),
 * not composition/map containers that also carry `SLOT_ID`.
 *
 * A block's SVG root includes `next` statement siblings. Hit-testing uses the
 * block's own height/width so a drop on a later ELEMENT in the stack maps that
 * slot, not the first sibling whose bbox swallowed the chain.
 */
import { isGenericValueBlockType } from "./blocks/target_blocks.ts";

export function isSourceDropSlotBlock(block: {
  type?: string | null;
}): boolean {
  const type = block.type ?? "";
  if (!type) return false;
  if (type === "element") return true;
  if (isGenericValueBlockType(type)) return true;
  if (type.startsWith("dv_") || type === "code_phrase") return true;
  return false;
}

export function isUsableSourceDropPoint(
  x: number,
  y: number,
  mount: { left: number; top: number; right: number; bottom: number } | null,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x === 0 && y === 0) return false;
  if (!mount) return true;
  return x >= mount.left && x <= mount.right && y >= mount.top && y <= mount.bottom;
}

/** CSS-pixel box for this block only (excludes `next` statement siblings). */
export function blockOwnClientRect(
  full: { left: number; top: number; width: number; height: number },
  own: { width: number; height: number },
  scale = 1,
): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
  const width = Math.min(full.width, Math.max(0, own.width * scale));
  const height = Math.min(full.height, Math.max(0, own.height * scale));
  return {
    left: full.left,
    top: full.top,
    right: full.left + width,
    bottom: full.top + height,
    width,
    height,
  };
}

export function pointInRect(
  x: number,
  y: number,
  rect: { left: number; top: number; right: number; bottom: number },
): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
