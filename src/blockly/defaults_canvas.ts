import type { BlockSvg, WorkspaceSvg } from "blockly/core";
import type { SkeletonNode, TargetFormatId } from "../types/mod.ts";
import { Blockly } from "./blockly_core.ts";
import {
  bindDefaultPoints,
  contextMapFromDefaultsJson,
  DEFAULT_CONTEXT_MAP_TYPE,
  DEFAULTS_MAP_NAME,
  factoryDefaultsMapBlockState,
  isEmptyContextMapState,
  MAPS_GET,
  mapsGetExpression,
} from "../core/defaults/mod.ts";
import { createMapsGetBlock, registerMapBlocks } from "./blocks/map_blocks.ts";
import { registerDefaultContextMapBlock } from "./blocks/default_context_map.ts";
import {
  connectExpressionToDataValueShell,
  expressionBlockFromDataValueShell,
  isDataValueBlock,
  registerRmBlocks,
  optionalRmInputName,
  RM_SPECIALIZATION_INPUT,
  rmAttributeInputName,
} from "./blocks/rm_blocks.ts";
import { isTermPickBlock, registerTermPickBlock } from "./blocks/term_pick.ts";
import { defaultsMapValueBlock, listDefaultContextMapEntries } from "./hardcode_defaults.ts";

const DEFAULTS_X = 20;
const DEFAULTS_Y = 20;
const SKELETON_GAP = 16;

function finalize(block: Blockly.Block): Blockly.Block {
  const svg = block as BlockSvg;
  if (typeof document !== "undefined") {
    svg.initSvg?.();
    svg.render?.();
  }
  return block;
}

function registerDefaultsBlocks(): void {
  registerMapBlocks();
  registerDefaultContextMapBlock();
  registerTermPickBlock();
  registerRmBlocks();
}

export function createEmptyMapBlock(workspace: Blockly.Workspace): Blockly.Block {
  registerDefaultsBlocks();
  const block = workspace.newBlock(DEFAULT_CONTEXT_MAP_TYPE) as Blockly.Block & {
    itemCount_: number;
    updateShape_: () => void;
  };
  block.itemCount_ = 0;
  block.updateShape_();
  return finalize(block);
}

/** Factory default context map from bundled `defaults_openEHR_1.map.json` (language ← UI). */
export function createFactoryMapBlock(
  workspace: Blockly.Workspace,
  uiLanguage: string,
): Blockly.Block {
  registerDefaultsBlocks();
  if (typeof Blockly.serialization?.blocks?.append !== "function") {
    return createEmptyMapBlock(workspace);
  }
  const state = factoryDefaultsMapBlockState(uiLanguage);
  const appended = Blockly.serialization.blocks.append(
    state,
    workspace,
  ) as Blockly.Block | undefined;
  if (!appended) return createEmptyMapBlock(workspace);
  appended.setDeletable(false);
  return finalize(appended);
}

export interface EnsureDefaultsOptions {
  /** When false, never dump the openEHR factory (blank project / New map). */
  factory?: boolean;
}

/**
 * Ensure the singleton default context map exists.
 * Blank-project callers should pass `{ factory: false }` so no openEHR-shaped rows appear
 * before a target is jointly loaded.
 */
export function ensureDefaultsBlock(
  workspace: Blockly.Workspace,
  uiLanguage: string,
  targetFormat?: TargetFormatId,
  options?: EnsureDefaultsOptions,
): Blockly.Block {
  registerDefaultsBlocks();
  const existing = findDefaultsBlock(workspace);
  if (existing) {
    existing.setDeletable(false);
    return existing;
  }
  const allowFactory = options?.factory !== false &&
    targetFormat !== "json-schema" &&
    targetFormat !== "xml-schema";
  const block = allowFactory
    ? createFactoryMapBlock(workspace, uiLanguage)
    : createEmptyMapBlock(workspace);
  if (typeof (block as BlockSvg).moveBy === "function") {
    (block as BlockSvg).moveBy(DEFAULTS_X, DEFAULTS_Y);
  }
  block.setDeletable(false);
  dropDuplicateDefaults(workspace, block);
  return block;
}

export function findDefaultsBlock(workspace: Blockly.Workspace): Blockly.Block | null {
  for (const block of workspace.getTopBlocks(false)) {
    if (block.type === DEFAULT_CONTEXT_MAP_TYPE) return block;
  }
  return null;
}

function dropDuplicateDefaults(workspace: Blockly.Workspace, keep: Blockly.Block): void {
  for (const block of workspace.getTopBlocks(false)) {
    if (block.type === DEFAULT_CONTEXT_MAP_TYPE && block.id !== keep.id) {
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
  targetFormat?: TargetFormatId,
  options?: EnsureDefaultsOptions,
): void {
  const converted = state ? contextMapFromDefaultsJson(state) ?? state : null;
  const empty = !converted || isEmptyContextMapState(converted);
  if (converted && !empty && typeof Blockly.serialization?.blocks?.append === "function") {
    try {
      Blockly.serialization.blocks.append(converted as Record<string, unknown>, workspace);
      const block = findDefaultsBlock(workspace);
      block?.setDeletable(false);
      if (block) dropDuplicateDefaults(workspace, block);
      if (findDefaultsBlock(workspace)) return;
    } catch {
      // fall through
    }
  }
  ensureDefaultsBlock(workspace, uiLanguage, targetFormat, options);
}

export function yJustBelowDefaults(defaultsHeight: number, gap = SKELETON_GAP): number {
  return DEFAULTS_Y + defaultsHeight + gap;
}

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
  const skeletonY = yJustBelowDefaults(size.height);
  for (const block of workspace.getTopBlocks(false)) {
    if (block.type === DEFAULT_CONTEXT_MAP_TYPE) continue;
    if (typeof (block as BlockSvg).moveBy !== "function") continue;
    const xy = block.getRelativeToSurfaceXY?.() ?? { x: 0, y: 0 };
    const dx = DEFAULTS_X - xy.x;
    const dy = skeletonY - xy.y;
    if (dx !== 0 || dy !== 0) {
      (block as BlockSvg).moveBy(dx, dy);
    }
  }
}

function slotAlreadyMapped(block: Blockly.Block): boolean {
  const expr = isDataValueBlock(block) || block.type === "code_phrase"
    ? expressionBlockFromDataValueShell(block)
    : block.getInputTargetBlock(rmAttributeInputName("name"));
  if (!expr || expr.isShadow()) return false;
  return true;
}

function isPartyValueBlock(block: Blockly.Block | null): boolean {
  return Boolean(
    block &&
      (block.type === "party_identified" ||
        block.type === "party_related" ||
        block.type === "party_self" ||
        block.type === "party_proxy"),
  );
}

function attachPartyLookup(workspace: Blockly.Workspace, target: Blockly.Block, key: string): void {
  if (target.type === "party_proxy") {
    const kind = target.getInput(RM_SPECIALIZATION_INPUT);
    if (kind?.connection) {
      const existing = kind.connection.targetBlock();
      if (existing && !existing.isShadow()) return;
      if (existing) existing.dispose(false);
      const lookup = createMapsGetBlock(workspace, DEFAULTS_MAP_NAME, key);
      finalize(lookup);
      if (lookup.outputConnection) kind.connection.connect(lookup.outputConnection);
      finalize(lookup);
      finalize(target);
      return;
    }
  }
  attachPartyObjectLookup(workspace, target, key);
}

function attachPartyObjectLookup(
  workspace: Blockly.Workspace,
  target: Blockly.Block,
  key: string,
): void {
  if (target.type === MAPS_GET) return;
  const parentConnection = target.outputConnection?.targetConnection;
  if (!parentConnection) return;
  const slotId = target.getFieldValue("SLOT_ID");
  const rmType = target.getFieldValue("RM_TYPE") || "PARTY_IDENTIFIED";
  target.dispose(false);
  const lookup = createMapsGetBlock(workspace, DEFAULTS_MAP_NAME, key, { slotId, rmType });
  finalize(lookup);
  if (lookup.outputConnection) parentConnection.connect(lookup.outputConnection);
  finalize(lookup);
}

function attachPhraseLookup(workspace: Blockly.Workspace, target: Blockly.Block, key: string): void {
  if (target.type === MAPS_GET) return;
  const parentConnection = target.outputConnection?.targetConnection;
  if (!parentConnection) return;
  const slotId = target.getFieldValue("SLOT_ID");
  const rmType = target.getFieldValue("RM_TYPE") || "CODE_PHRASE";
  target.dispose(false);
  const lookup = createMapsGetBlock(workspace, DEFAULTS_MAP_NAME, key, { slotId, rmType });
  finalize(lookup);
  if (lookup.outputConnection) parentConnection.connect(lookup.outputConnection);
  finalize(lookup);
}

function attachLookup(
  workspace: Blockly.Workspace,
  target: Blockly.Block,
  key: string,
  leaf: string,
): void {
  if (leaf === "party") {
    attachPartyLookup(workspace, target, key);
    return;
  }
  const mapValue = defaultsMapValueBlock(workspace, key);
  if (isTermPickBlock(mapValue) || isTermPickBlock(target)) {
    attachPhraseLookup(workspace, target, key);
    return;
  }
  if (isPartyValueBlock(mapValue) && target.type !== "party_proxy") {
    attachPartyObjectLookup(workspace, target, key);
    return;
  }
  if (slotAlreadyMapped(target)) return;
  const lookup = createMapsGetBlock(workspace, DEFAULTS_MAP_NAME, key);
  finalize(lookup);
  if (isDataValueBlock(target) || target.type === "code_phrase") {
    connectExpressionToDataValueShell(target, lookup);
    finalize(lookup);
    finalize(target);
    return;
  }
  const nameInput = target.getInput(rmAttributeInputName("name"));
  if (nameInput?.connection && lookup.outputConnection) {
    const existing = nameInput.connection.targetBlock();
    if (existing && !existing.isShadow()) existing.dispose(false);
    nameInput.connection.connect(lookup.outputConnection);
    finalize(lookup);
    finalize(target);
    return;
  }
  lookup.dispose(false);
}

function findBlocksBySlotId(
  workspace: Blockly.Workspace,
  slotId: string,
): Blockly.Block[] {
  return workspace.getAllBlocks(false).filter((block) => block.getFieldValue("SLOT_ID") === slotId);
}

export type OptionalInsertFn = (
  parent: Blockly.Block,
  insertion: { rmType: string; attributeName: string },
) => Blockly.Block | null;

function isUnderRoot(block: Blockly.Block | null, root: Blockly.Block): boolean {
  let current: Blockly.Block | null = block;
  while (current) {
    if (current.id === root.id) return true;
    current = current.getParent();
  }
  return false;
}

/**
 * Scaffold Default points from **scaffold targets**; `maps_get` uses **runtime keys**.
 * Skips slots already replaced with a Source query (source-over-defaults).
 */
export function attachDefaultPointLookups(
  workspace: WorkspaceSvg | Blockly.Workspace,
  skeleton: SkeletonNode[],
  insertOptional?: OptionalInsertFn,
  scope?: { root: Blockly.Block },
): void {
  registerDefaultsBlocks();
  const entries = listDefaultContextMapEntries(workspace as Blockly.Workspace);
  const bound = bindDefaultPoints(skeleton, entries);
  const inScope = (block: Blockly.Block | null): boolean =>
    Boolean(block) && (!scope?.root || isUnderRoot(block, scope.root));
  for (const { point, node, parent, mapKey } of bound) {
    const key = mapKey || point.mapKey;
    let targets = findBlocksBySlotId(workspace, node.slotId).filter(inScope);
    if (!targets.length && point.optionalInsert) {
      const parentBlock = findBlocksBySlotId(workspace, parent.slotId).find(inScope) ?? null;
      if (parentBlock && insertOptional) {
        insertOptional(parentBlock, {
          rmType: point.optionalInsert.rmType,
          attributeName: point.rmAttribute,
        });
      }
      targets = findBlocksBySlotId(workspace, node.slotId).filter(inScope);
      const fallback = parentBlock?.getInputTargetBlock(rmAttributeInputName(point.rmAttribute)) ??
        parentBlock?.getInputTargetBlock(optionalRmInputName(point.rmAttribute)) ??
        null;
      if (!targets.length && fallback && inScope(fallback)) targets = [fallback];
    }
    for (const target of targets) {
      attachLookup(workspace, target, key, point.leaf);
    }
  }
}

/** Discrete structure apply (joint confirm / Apply icon / later target refresh). */
export function applyDefaultContextMap(
  workspace: WorkspaceSvg | Blockly.Workspace,
  skeleton: SkeletonNode[],
  insertOptional?: OptionalInsertFn,
): void {
  attachDefaultPointLookups(workspace, skeleton, insertOptional);
}

export { mapsGetExpression };

export function serializeDefaultsMapArgument(workspace: Blockly.Workspace): unknown | null {
  return captureDefaultsBlockState(workspace);
}

/** Replace the unique default context map (Save as / Example Set / Browse / joint load). */
export function hydrateDefaultsMapArgument(
  workspace: Blockly.Workspace,
  mapBlockState: unknown,
  uiLanguage: string,
  targetFormat?: TargetFormatId,
): void {
  registerDefaultsBlocks();
  const existing = findDefaultsBlock(workspace);
  const xy = existing && typeof existing.getRelativeToSurfaceXY === "function"
    ? existing.getRelativeToSurfaceXY()
    : { x: DEFAULTS_X, y: DEFAULTS_Y };
  existing?.dispose(false);
  const converted = mapBlockState ? contextMapFromDefaultsJson(mapBlockState) : null;
  if (!converted || typeof Blockly.serialization?.blocks?.append !== "function") {
    const block = ensureDefaultsBlock(workspace, uiLanguage, targetFormat, {
      factory: targetFormat !== "json-schema" && targetFormat !== "xml-schema",
    });
    moveTo(block, xy.x, xy.y);
    return;
  }
  const appended = Blockly.serialization.blocks.append(
    converted,
    workspace,
  ) as Blockly.Block | undefined;
  if (!appended) {
    ensureDefaultsBlock(workspace, uiLanguage, targetFormat);
    return;
  }
  appended.setDeletable(false);
  moveTo(appended, xy.x, xy.y);
  dropDuplicateDefaults(workspace, appended);
  finalize(appended);
}

function moveTo(block: Blockly.Block, x: number, y: number): void {
  if (typeof (block as BlockSvg).moveBy !== "function") return;
  const cur = typeof block.getRelativeToSurfaceXY === "function"
    ? block.getRelativeToSurfaceXY()
    : { x: 0, y: 0 };
  (block as BlockSvg).moveBy(x - cur.x, y - cur.y);
}
