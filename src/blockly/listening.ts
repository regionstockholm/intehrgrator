/**
 * Listening Mode targets: empty Target value slots, or Source query blocks
 * still showing a Placeholder source path.
 */
import type { Block } from "blockly/core";
import { isUnmappedValueBlock } from "./block_constraints.ts";
import { isGenericValueBlockType } from "./blocks/target_blocks.ts";
import {
  expressionBlockFromDataValueShell,
  isDataValueBlock,
} from "./blocks/rm_blocks.ts";
import { isSourceQueryBlockType } from "./source_query.ts";

/** Factory EXPRESSION on a Source query block. */
export const PLACEHOLDER_SOURCE_PATH = "/path";

export function isPlaceholderSourcePath(value: string | null | undefined): boolean {
  const t = (value ?? "").trim();
  return t === "" || t === PLACEHOLDER_SOURCE_PATH;
}

export type ListeningTarget =
  | { kind: "slot"; slotId: string }
  | { kind: "source_block"; blockId: string };

export function owningValueSlotId(block: Block): string | null {
  let current: Block | null = block;
  while (current) {
    if (current.type === "element" || isGenericValueBlockType(current.type)) {
      const slotId = current.getFieldValue("SLOT_ID");
      return slotId || null;
    }
    current = current.getParent();
  }
  return null;
}

export function hasPlaceholderSourceQuery(block: Block): boolean {
  if (
    isSourceQueryBlockType(block.type) &&
    isPlaceholderSourcePath(block.getFieldValue("EXPRESSION"))
  ) {
    return true;
  }
  for (const child of block.getChildren(false)) {
    if (hasPlaceholderSourceQuery(child)) return true;
  }
  return false;
}

/**
 * Where Click-to-Map should bind if this block is selected.
 * Mapped blocks (real paths) return null — Selection only.
 */
export function listeningTargetFromBlock(block: Block): ListeningTarget | null {
  if (isSourceQueryBlockType(block.type)) {
    if (!isPlaceholderSourcePath(block.getFieldValue("EXPRESSION"))) return null;
    const slotId = owningValueSlotId(block);
    if (slotId) return { kind: "slot", slotId };
    return { kind: "source_block", blockId: block.id };
  }
  if (isDataValueBlock(block)) {
    const expr = expressionBlockFromDataValueShell(block);
    const unmapped = !expr || (
      isSourceQueryBlockType(expr.type) &&
      isPlaceholderSourcePath(expr.getFieldValue("EXPRESSION"))
    );
    if (!unmapped) return null;
    const slotId = owningValueSlotId(block);
    return slotId ? { kind: "slot", slotId } : null;
  }
  if (block.type === "element" || isGenericValueBlockType(block.type)) {
    if (!isUnmappedValueBlock(block) && !hasPlaceholderSourceQuery(block)) {
      return null;
    }
    const slotId = block.getFieldValue("SLOT_ID") as string;
    return slotId ? { kind: "slot", slotId } : null;
  }
  return null;
}
