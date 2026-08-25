import type { BlockSvg, WorkspaceSvg } from "blockly/core";
import type { SkeletonNode } from "../types/mod.ts";
import { Blockly } from "./blockly_core.ts";
import {
  bindDefaultPoints,
  DEFAULTS_BLOCK_TYPE,
  DEFAULTS_MAP_NAME,
  factoryDefaultsEntries,
  MAPS_CREATE_WITH,
  mapsGetExpression,
  migrateMapsCreateWithJson,
} from "../core/defaults/mod.ts";
import { createMapsGetBlock, registerMapBlocks } from "./blocks/map_blocks.ts";
import {
  applyFixedFieldsToDataValueShell,
  connectExpressionToDataValueShell,
  expressionBlockFromDataValueShell,
  isDataValueBlock,
  rmAttributeInputName,
} from "./blocks/rm_blocks.ts";
import { createTermPickBlock, isTermPickBlock, registerTermPickBlock } from "./blocks/term_pick.ts";
import { termSetById, termSetIdForDefaultsKey } from "../core/openehr_term_catalog.ts";
import { parseExpression } from "../core/expression/mod.ts";
import { astToExpressionBlock } from "./expression_serialize.ts";
import { createSourceQueryBlock } from "./source_query.ts";

const DEFAULTS_X = 20;
const DEFAULTS_Y = 20;
const SKELETON_GAP = 48;

function finalize(block: Blockly.Block): Blockly.Block {
  const svg = block as BlockSvg;
  if (typeof document !== "undefined") {
    svg.initSvg?.();
    svg.render?.();
  }
  return block;
}

function connectText(
  workspace: Blockly.Workspace,
  parent: Blockly.Block,
  inputName: string,
  value: string,
): void {
  const input = parent.getInput(inputName);
  if (!input?.connection) return;
  const existing = input.connection.targetBlock();
  if (existing && !existing.isShadow()) existing.dispose(false);
  if (typeof input.connection.setShadowState === "function") {
    input.connection.setShadowState({
      type: "text",
      fields: { TEXT: value },
    });
    return;
  }
  const text = workspace.newBlock("text");
  text.setFieldValue(value, "TEXT");
  if (text.outputConnection) input.connection.connect(text.outputConnection);
  finalize(text);
}

function connectDefaultValue(
  workspace: Blockly.Workspace,
  parent: Blockly.Block,
  inputName: string,
  key: string,
  value: string,
): void {
  const setId = termSetIdForDefaultsKey(key);
  const set = setId ? termSetById(setId) : undefined;
  if (set && value && set.codes.some((item) => item.code === value)) {
    const input = parent.getInput(inputName);
    if (!input?.connection) return;
    const existing = input.connection.targetBlock();
    if (existing) existing.dispose(false);
    const pick = createTermPickBlock(workspace, set, value);
    if (pick.outputConnection) input.connection.connect(pick.outputConnection);
    pick.setShadow?.(true);
    finalize(pick);
    return;
  }
  connectText(workspace, parent, inputName, value);
}

export function createFactoryMapBlock(
  workspace: Blockly.Workspace,
  uiLanguage: string,
): Blockly.Block {
  registerMapBlocks();
  registerTermPickBlock();
  const entries = factoryDefaultsEntries(uiLanguage);
  const map = workspace.newBlock(MAPS_CREATE_WITH) as Blockly.Block & {
    itemCount_: number;
    updateShape_: () => void;
  };
  map.itemCount_ = entries.length;
  map.updateShape_();
  for (let i = 0; i < entries.length; i++) {
    map.setFieldValue(entries[i]!.key, `KEY${i}`);
    connectDefaultValue(workspace, map, `VAL${i}`, entries[i]!.key, entries[i]!.value);
  }
  return finalize(map);
}

/** Ensure the singleton Defaults block exists, with a factory Map if none is plugged in. */
export function ensureDefaultsBlock(
  workspace: Blockly.Workspace,
  uiLanguage: string,
): Blockly.Block {
  registerMapBlocks();
  const existing = findDefaultsBlock(workspace);
  if (existing) {
    if (!existing.getInputTargetBlock("MAP")) {
      const map = createFactoryMapBlock(workspace, uiLanguage);
      existing.getInput("MAP")?.connection?.connect(map.outputConnection!);
    }
    existing.setDeletable(false);
    return existing;
  }
  const block = workspace.newBlock(DEFAULTS_BLOCK_TYPE);
  const map = createFactoryMapBlock(workspace, uiLanguage);
  block.getInput("MAP")?.connection?.connect(map.outputConnection!);
  if (typeof (block as BlockSvg).moveBy === "function") {
    (block as BlockSvg).moveBy(DEFAULTS_X, DEFAULTS_Y);
  }
  block.setDeletable(false);
  finalize(block);
  dropDuplicateDefaults(workspace, block);
  return block;
}

export function findDefaultsBlock(workspace: Blockly.Workspace): Blockly.Block | null {
  for (const block of workspace.getTopBlocks(false)) {
    if (block.type === DEFAULTS_BLOCK_TYPE) return block;
  }
  return null;
}

function dropDuplicateDefaults(workspace: Blockly.Workspace, keep: Blockly.Block): void {
  for (const block of workspace.getTopBlocks(false)) {
    if (block.type === DEFAULTS_BLOCK_TYPE && block.id !== keep.id) {
      block.dispose(false);
    }
  }
}

export function captureDefaultsBlockState(workspace: Blockly.Workspace): unknown | null {
  const block = findDefaultsBlock(workspace);
  if (!block || typeof Blockly.serialization?.blocks?.save !== "function") return null;
  return Blockly.serialization.blocks.save(block, { addCoordinates: true });
}

export function restoreDefaultsBlockState(
  workspace: Blockly.Workspace,
  state: unknown,
  uiLanguage: string,
): void {
  if (state && typeof Blockly.serialization?.blocks?.append === "function") {
    try {
      migrateMapsCreateWithJson(state);
      Blockly.serialization.blocks.append(state, workspace);
      const block = findDefaultsBlock(workspace);
      block?.setDeletable(false);
      dropDuplicateDefaults(workspace, block ?? findDefaultsBlock(workspace)!);
      if (findDefaultsBlock(workspace)) return;
    } catch {
      // fall through to factory
    }
  }
  ensureDefaultsBlock(workspace, uiLanguage);
}

/** Place the Defaults stack at top-left; shift Template Skeleton to the right of it. */
export function placeDefaultsBesideSkeleton(workspace: Blockly.Workspace): void {
  const defaults = findDefaultsBlock(workspace);
  if (!defaults || typeof (defaults as BlockSvg).moveBy !== "function") return;
  const dxy = typeof defaults.getRelativeToSurfaceXY === "function"
    ? defaults.getRelativeToSurfaceXY()
    : { x: DEFAULTS_X, y: DEFAULTS_Y };
  if (dxy.x !== DEFAULTS_X || dxy.y !== DEFAULTS_Y) {
    (defaults as BlockSvg).moveBy(DEFAULTS_X - dxy.x, DEFAULTS_Y - dxy.y);
  }
  const size = typeof (defaults as BlockSvg).getHeightWidth === "function"
    ? (defaults as BlockSvg).getHeightWidth()
    : { width: 280, height: 160 };
  const skeletonX = DEFAULTS_X + size.width + SKELETON_GAP;
  for (const block of workspace.getTopBlocks(false)) {
    if (block.type === DEFAULTS_BLOCK_TYPE) continue;
    if (typeof (block as BlockSvg).moveBy !== "function") continue;
    const xy = block.getRelativeToSurfaceXY?.() ?? { x: 0, y: 0 };
    if (xy.x < skeletonX) {
      (block as BlockSvg).moveBy(skeletonX - xy.x, 0);
    }
  }
}

function expressionToBlock(
  workspace: Blockly.Workspace,
  expression: string,
): Blockly.Block {
  try {
    return astToExpressionBlock(
      workspace,
      parseExpression(expression),
      "string",
      (b) => finalize(b) as BlockSvg,
    );
  } catch {
    return createSourceQueryBlock(workspace, expression, "string");
  }
}

function slotAlreadyMapped(block: Blockly.Block): boolean {
  const expr = isDataValueBlock(block) || block.type === "code_phrase"
    ? expressionBlockFromDataValueShell(block)
    : block.getInputTargetBlock(rmAttributeInputName("name"));
  if (!expr || expr.isShadow()) return false;
  return true;
}

function attachLookup(workspace: Blockly.Workspace, target: Blockly.Block, key: string): void {
  if (isTermPickBlock(target)) {
    const parentConnection = target.outputConnection?.targetConnection;
    const set = termSetById(target.getFieldValue("SET"));
    const slotId = target.getFieldValue("SLOT_ID");
    target.dispose(false);
    const shell = workspace.newBlock("code_phrase");
    if (shell.getField("RM_TYPE")) shell.setFieldValue("CODE_PHRASE", "RM_TYPE");
    if (slotId && shell.getField("SLOT_ID")) shell.setFieldValue(slotId, "SLOT_ID");
    if (shell.outputConnection && parentConnection) {
      parentConnection.connect(shell.outputConnection);
    }
    applyFixedFieldsToDataValueShell(workspace, shell, {
      terminology_id: set?.terminologyId ?? "",
    });
    const lookup = createMapsGetBlock(workspace, DEFAULTS_MAP_NAME, key);
    finalize(lookup);
    connectExpressionToDataValueShell(shell, lookup);
    finalize(shell);
    return;
  }
  if (slotAlreadyMapped(target)) return;
  const lookup = createMapsGetBlock(workspace, DEFAULTS_MAP_NAME, key);
  finalize(lookup);
  if (isDataValueBlock(target) || target.type === "code_phrase") {
    connectExpressionToDataValueShell(target, lookup);
    return;
  }
  const nameInput = target.getInput(rmAttributeInputName("name"));
  if (nameInput?.connection && lookup.outputConnection) {
    const existing = nameInput.connection.targetBlock();
    if (existing && !existing.isShadow()) existing.dispose(false);
    nameInput.connection.connect(lookup.outputConnection);
    return;
  }
  lookup.dispose(false);
}

function findBlockBySlotId(
  workspace: Blockly.Workspace,
  slotId: string,
): Blockly.Block | null {
  for (const block of workspace.getAllBlocks(false)) {
    if (block.getFieldValue("SLOT_ID") === slotId) return block;
  }
  return null;
}

export type OptionalInsertFn = (
  parent: Blockly.Block,
  insertion: { rmType: string; attributeName: string },
) => Blockly.Block | null;

/**
 * Scaffold Default points: optional RM insert when needed, then Map lookup on the leaf.
 * Skips slots that already have a non-shadow, non-literal mapping.
 */
export function attachDefaultPointLookups(
  workspace: WorkspaceSvg | Blockly.Workspace,
  skeleton: SkeletonNode[],
  insertOptional?: OptionalInsertFn,
): void {
  registerMapBlocks();
  const bound = bindDefaultPoints(skeleton);
  for (const { point, node, parent } of bound) {
    let target = findBlockBySlotId(workspace, node.slotId);
    if (!target && point.optionalInsert) {
      const parentBlock = findBlockBySlotId(workspace, parent.slotId);
      if (parentBlock && insertOptional) {
        insertOptional(parentBlock, {
          rmType: point.optionalInsert.rmType,
          attributeName: point.rmAttribute,
        });
      }
      target = findBlockBySlotId(workspace, node.slotId) ??
        parentBlock?.getInputTargetBlock(rmAttributeInputName(point.rmAttribute)) ??
        null;
    }
    if (!target) continue;
    attachLookup(workspace, target, point.mapKey);
  }
}

export { mapsGetExpression };

export function serializeDefaultsMapArgument(workspace: Blockly.Workspace): unknown | null {
  const defaults = findDefaultsBlock(workspace);
  const map = defaults?.getInputTargetBlock("MAP");
  if (!map || typeof Blockly.serialization?.blocks?.save !== "function") return null;
  return Blockly.serialization.blocks.save(map);
}

/** Replace the Map plugged into the Defaults block (Save as / Example Set / Browse). */
export function hydrateDefaultsMapArgument(
  workspace: Blockly.Workspace,
  mapBlockState: unknown,
  uiLanguage: string,
): void {
  const defaults = ensureDefaultsBlock(workspace, uiLanguage);
  const input = defaults.getInput("MAP");
  const existing = input?.connection?.targetBlock();
  if (existing) existing.dispose(false);
  if (!mapBlockState || typeof Blockly.serialization?.blocks?.append !== "function") {
    const map = createFactoryMapBlock(workspace, uiLanguage);
    input?.connection?.connect(map.outputConnection!);
    return;
  }
  migrateMapsCreateWithJson(mapBlockState);
  const appended = Blockly.serialization.blocks.append(
    mapBlockState as Record<string, unknown>,
    workspace,
  ) as Blockly.Block | undefined;
  if (appended?.outputConnection && input?.connection) {
    input.connection.connect(appended.outputConnection);
  }
}
