/**
 * Resolve a Target value slot from a Source-tree drag position on the canvas.
 */
import type { Block, WorkspaceSvg } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import { isGenericValueBlockType } from "./blocks/target_blocks.ts";
import { schemaSlotIdForInput } from "./schema_blocks.ts";
import { owningValueSlotId } from "./listening.ts";
import { slotIdFromBlock } from "./skeleton_loader.ts";
import { workspacePositionFromClient } from "./source_query.ts";

const INPUT_VALUE = Blockly.INPUT_VALUE ?? 1;
/** Screen pixels — scaled to workspace units per zoom level. */
const HIT_RADIUS_PX = 40;

export function findSlotIdAtPoint(
  workspace: WorkspaceSvg,
  clientX: number,
  clientY: number,
): string | null {
  const fromConnection = findSlotIdNearValueConnection(workspace, clientX, clientY);
  if (fromConnection) return fromConnection;
  return findSlotIdFromBlockBounds(workspace, clientX, clientY);
}

function findSlotIdNearValueConnection(
  workspace: WorkspaceSvg,
  clientX: number,
  clientY: number,
): string | null {
  const { x, y } = workspacePositionFromClient(workspace, clientX, clientY);
  const scale = workspace.scale || 1;
  const radius = HIT_RADIUS_PX / scale;
  let best: { slotId: string; dist: number } | null = null;

  for (const block of workspace.getAllBlocks(false)) {
    for (const input of block.inputList) {
      if (input.type !== INPUT_VALUE) continue;
      const conn = input.connection;
      if (!conn) continue;
      const dx = conn.x - x;
      const dy = conn.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) continue;
      const slotId = slotIdForValueInput(block, input.name);
      if (!slotId) continue;
      if (!best || dist < best.dist) best = { slotId, dist };
    }
  }
  return best?.slotId ?? null;
}

function slotIdForValueInput(block: Block, inputName: string): string | null {
  if (inputName === "VALUE") {
    if (block.type === "element" || isGenericValueBlockType(block.type)) {
      const slotId = block.getFieldValue("SLOT_ID");
      return slotId ? String(slotId) : null;
    }
  }
  if (inputName.startsWith("TARGET_") || inputName.startsWith("SCHEMA_OPT_")) {
    return schemaSlotIdForInput(block, inputName);
  }
  return null;
}

function findSlotIdFromBlockBounds(
  workspace: WorkspaceSvg,
  clientX: number,
  clientY: number,
): string | null {
  let best: { slotId: string; area: number } | null = null;
  for (const block of workspace.getAllBlocks(false)) {
    const svg = block as Block & { getSvgRoot?: () => SVGElement | null };
    const root = typeof svg.getSvgRoot === "function" ? svg.getSvgRoot() : null;
    if (!root) continue;
    const rect = root.getBoundingClientRect();
    if (
      clientX < rect.left || clientX > rect.right ||
      clientY < rect.top || clientY > rect.bottom
    ) {
      continue;
    }
    let slotId = slotIdFromBlock(block);
    if (!slotId) slotId = owningValueSlotId(block);
    if (!slotId) continue;
    const area = rect.width * rect.height;
    if (!best || area < best.area) best = { slotId, area };
  }
  return best?.slotId ?? null;
}
