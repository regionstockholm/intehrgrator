/**
 * Resolve which Target value slot sits under a client pointer on the Blockly canvas.
 */
import type { Block, BlockSvg, Connection, Input, WorkspaceSvg } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import { isGenericValueBlockType, isSchemaStructureBlock } from "./blocks/target_blocks.ts";
import { schemaSlotIdForInput } from "./schema_blocks.ts";
import { slotIdFromBlock } from "./skeleton_loader.ts";
import { owningValueSlotId } from "./listening.ts";

const VALUE_INPUT_TYPE = Blockly.INPUT_VALUE ?? 1;

export interface SlotHitTestOptions {
  /** When set, ignore hits outside this client rect (e.g. `#blockly-mount`). */
  mountRect?: DOMRect | { left: number; top: number; right: number; bottom: number };
}

/** Pick the innermost mappable slot at a client coordinate. */
export function findSlotIdAtPoint(
  workspace: WorkspaceSvg,
  clientX: number,
  clientY: number,
  options: SlotHitTestOptions = {},
): string | null {
  const mount = options.mountRect;
  if (mount) {
    const inMount = clientX >= mount.left && clientX <= mount.right &&
      clientY >= mount.top && clientY <= mount.bottom;
    if (!inMount) return null;
  }

  let best: { slotId: string; area: number } | null = null;
  const consider = (slotId: string | null, area: number) => {
    if (!slotId || area <= 0) return;
    if (!best || area < best.area) best = { slotId, area };
  };

  // Element / generic value blocks first: SVG roots include nested children,
  // so use the block body only (matches where users aim on RM element rows).
  for (const block of workspace.getAllBlocks(false)) {
    if (block.type !== "element" && !isGenericValueBlockType(block.type)) continue;
    const slotId = slotIdFromBlock(block);
    if (!slotId) continue;
    const rect = blockBodyClientRect(block as BlockSvg);
    if (!rect || !pointInRect(clientX, clientY, rect)) continue;
    consider(slotId, rect.width * rect.height);
  }
  if (best) return best.slotId;

  // Schema / nested value inputs (precise mouth hit targets).
  for (const block of workspace.getAllBlocks(false)) {
    const svg = block as BlockSvg;
    for (const input of block.inputList) {
      if (input.type !== VALUE_INPUT_TYPE) continue;
      const slotId = valueInputSlotId(block, input);
      if (!slotId) continue;
      const rect = inputConnectionClientRect(svg, input.connection);
      if (!rect || !pointInRect(clientX, clientY, rect)) continue;
      consider(slotId, rect.width * rect.height);
    }
  }

  return best?.slotId ?? null;
}

function valueInputSlotId(block: Block, input: Input): string | null {
  if (block.type === "element" || isGenericValueBlockType(block.type)) {
    return slotIdFromBlock(block);
  }
  if (isSchemaStructureBlock(block)) {
    return schemaSlotIdForInput(block, input.name);
  }
  return owningValueSlotId(block);
}

/** Client rect of an element / generic value block body (excludes nested blocks). */
export function blockDropTargetClientRect(block: BlockSvg): DOMRect | null {
  return blockBodyClientRect(block);
}

function blockBodyClientRect(block: BlockSvg): DOMRect | null {
  const path = block.pathObject?.svgPath;
  if (!path || typeof path.getBoundingClientRect !== "function") return null;
  const rect = path.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return rect;
}

function inputConnectionClientRect(
  block: BlockSvg,
  connection: Connection | null | undefined,
): DOMRect | null {
  if (!connection || typeof document === "undefined") return null;
  const rendered = connection as Connection & {
    getOffsetInBlock?: () => { x: number; y: number };
  };
  const loc = rendered.getOffsetInBlock?.();
  if (!loc) return null;
  const ws = block.workspace as WorkspaceSvg;
  const scale = typeof ws.getScale === "function" ? ws.getScale() : 1;
  const metrics = typeof ws.getMetrics === "function" ? ws.getMetrics() : null;
  if (!metrics) return null;
  const blockPos = typeof block.getRelativeToSurfaceXY === "function"
    ? block.getRelativeToSurfaceXY()
    : { x: 0, y: 0 };
  const surfaceX = (blockPos.x + loc.x) * scale + metrics.absoluteLeft;
  const surfaceY = (blockPos.y + loc.y) * scale + metrics.absoluteTop;
  const size = Math.max(22, 18 * scale);
  return new DOMRect(surfaceX - size / 2, surfaceY - size / 2, size, size);
}

function pointInRect(
  x: number,
  y: number,
  rect: DOMRect | { left: number; top: number; right: number; bottom: number },
): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
