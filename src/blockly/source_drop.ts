/**
 * Source-tree → Blockly canvas drop targeting.
 *
 * Slot hits must be **value-slot** blocks (`element`, generic values, DV_*),
 * not composition/map containers that also carry `SLOT_ID`.
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
