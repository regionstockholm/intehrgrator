import type { BlockSvg, WorkspaceSvg } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import {
  applyInstanceRootCap,
  CONVERSION_START_TYPE,
  findConversionStartBlock,
  findInstanceRootUnderStart,
  INSTANCE_ROOT_CONNECTION,
  isInstanceRootBlockType,
  registerConversionStartBlock,
} from "./instance_root.ts";
import { DEFAULTS_BLOCK_TYPE } from "../core/defaults/extract.ts";

const START_X = 20;
const START_Y = 20;

function finalize(block: Blockly.Block): Blockly.Block {
  const svg = block as BlockSvg;
  if (typeof document !== "undefined") {
    svg.initSvg?.();
    svg.render?.();
  }
  return block;
}

export function dropDuplicateConversionStart(
  workspace: Blockly.Workspace,
  keep: Blockly.Block,
): void {
  for (const block of workspace.getTopBlocks(false)) {
    if (block.type === CONVERSION_START_TYPE && block.id !== keep.id) {
      block.dispose(false);
    }
  }
}

export function ensureConversionStartBlock(workspace: Blockly.Workspace): Blockly.Block {
  registerConversionStartBlock();
  const existing = findConversionStartBlock(workspace);
  if (existing) {
    dropDuplicateConversionStart(workspace, existing);
    return existing;
  }
  const block = workspace.newBlock(CONVERSION_START_TYPE);
  if (typeof (block as BlockSvg).moveBy === "function") {
    (block as BlockSvg).moveBy(START_X, START_Y);
  }
  finalize(block);
  dropDuplicateConversionStart(workspace, block);
  return block;
}

/** Attach Conversion start above an instance root if not already connected. */
export function attachStartToInstanceRoot(
  workspace: Blockly.Workspace,
  root: Blockly.Block,
): Blockly.Block {
  applyInstanceRootCap(root);
  const start = ensureConversionStartBlock(workspace);
  if (!start.nextConnection?.isConnected() && root.previousConnection) {
    start.nextConnection?.connect(root.previousConnection);
  }
  layoutStartAboveRoot(start, root);
  return start;
}

function layoutStartAboveRoot(start: Blockly.Block, root: Blockly.Block): void {
  const rootSvg = root as BlockSvg;
  const startSvg = start as BlockSvg;
  if (typeof rootSvg.getRelativeToSurfaceXY !== "function") return;
  const pos = rootSvg.getRelativeToSurfaceXY();
  const rootH = rootSvg.getHeightWidth?.().height ?? 80;
  if (typeof startSvg.moveBy === "function") {
    const startPos = startSvg.getRelativeToSurfaceXY?.() ?? { x: START_X, y: START_Y };
    const dx = pos.x - startPos.x;
    const dy = pos.y - rootH - 12 - startPos.y;
    if (dx || dy) startSvg.moveBy(dx, dy);
  }
}

/** Find the scaffold / product root among top blocks (excluding defaults and start). */
export function findScaffoldInstanceRoot(workspace: Blockly.Workspace): Blockly.Block | null {
  const underStart = findInstanceRootUnderStart(workspace);
  if (underStart) return underStart;
  for (const top of workspace.getTopBlocks(false)) {
    if (top.type === DEFAULTS_BLOCK_TYPE || top.type === CONVERSION_START_TYPE) continue;
    if (top.type === "maps_create_with") continue;
    if (isInstanceRootBlockType(top.type) || top.type === "composition") return top;
    if (top.type.startsWith("schema_")) return top;
  }
  return null;
}

/** Ensure Start caps the scaffold root; attach if a suitable root exists without Start. */
export function ensureConversionStartOnScaffold(workspace: Blockly.Workspace): void {
  const root = findScaffoldInstanceRoot(workspace);
  if (!root) return;
  if (root.type === CONVERSION_START_TYPE) return;
  attachStartToInstanceRoot(workspace, root);
}

/** Reject a second Conversion start being placed (dispose the newcomer). */
export function enforceConversionStartUniqueness(workspace: Blockly.Workspace): void {
  const starts = workspace.getTopBlocks(false).filter((b) => b.type === CONVERSION_START_TYPE);
  if (starts.length <= 1) return;
  const keep = findConversionStartBlock(workspace) ?? starts[0]!;
  for (const block of starts) {
    if (block.id !== keep.id) block.dispose(false);
  }
}

export function isValidStartConnection(
  startNext: Blockly.Connection,
  rootPrev: Blockly.Connection,
): boolean {
  return (
    startNext.type === Blockly.NEXT_STATEMENT &&
    rootPrev.type === Blockly.PREVIOUS_STATEMENT &&
    startNext.check === INSTANCE_ROOT_CONNECTION
  );
}
