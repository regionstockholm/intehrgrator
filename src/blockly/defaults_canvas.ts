import type { BlockSvg, WorkspaceSvg } from "blockly/core";
import type { SkeletonNode, TargetFormatId } from "../types/mod.ts";
import { Blockly } from "./blockly_core.ts";
import {
  bindDefaultPoints,
  DEFAULTS_BLOCK_TYPE,
  DEFAULTS_MAP_NAME,
  factoryDefaultsMapBlockState,
  MAPS_CREATE_WITH,
  MAPS_GET,
  mapsGetExpression,
} from "../core/defaults/mod.ts";
import { createMapsGetBlock, registerMapBlocks } from "./blocks/map_blocks.ts";
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
import { defaultsMapKeys, defaultsMapValueBlock } from "./hardcode_defaults.ts";

const DEFAULTS_X = 20;
const DEFAULTS_Y = 20;
/** Gap between the bottom of Defaults and the top of Conversion start / skeleton. */
const SKELETON_GAP = 16;

function finalize(block: Blockly.Block): Blockly.Block {
  const svg = block as BlockSvg;
  if (typeof document !== "undefined") {
    svg.initSvg?.();
    svg.render?.();
  }
  return block;
}

export function createEmptyMapBlock(workspace: Blockly.Workspace): Blockly.Block {
  registerMapBlocks();
  const map = workspace.newBlock(MAPS_CREATE_WITH) as Blockly.Block & {
    itemCount_: number;
    updateShape_: () => void;
  };
  map.itemCount_ = 0;
  map.updateShape_();
  return finalize(map);
}

/** Factory Defaults Map from bundled `defaults_openEHR_1.map.json` (language ← UI). */
export function createFactoryMapBlock(
  workspace: Blockly.Workspace,
  uiLanguage: string,
): Blockly.Block {
  registerMapBlocks();
  registerTermPickBlock();
  registerRmBlocks();
  if (typeof Blockly.serialization?.blocks?.append !== "function") {
    return createEmptyMapBlock(workspace);
  }
  const state = factoryDefaultsMapBlockState(uiLanguage);
  const appended = Blockly.serialization.blocks.append(
    state,
    workspace,
  ) as Blockly.Block | undefined;
  if (!appended) return createEmptyMapBlock(workspace);
  return finalize(appended);
}

/** Ensure the singleton Defaults block exists, with a factory Map if none is plugged in. */
export function ensureDefaultsBlock(
  workspace: Blockly.Workspace,
  uiLanguage: string,
  targetFormat?: TargetFormatId,
): Blockly.Block {
  registerMapBlocks();
  const useEmptyMap = targetFormat === "json-schema" || targetFormat === "xml-schema";
  const existing = findDefaultsBlock(workspace);
  if (existing) {
    if (!existing.getInputTargetBlock("MAP")) {
      const map = useEmptyMap
        ? createEmptyMapBlock(workspace)
        : createFactoryMapBlock(workspace, uiLanguage);
      existing.getInput("MAP")?.connection?.connect(map.outputConnection!);
    }
    existing.setDeletable(false);
    return existing;
  }
  const block = workspace.newBlock(DEFAULTS_BLOCK_TYPE);
  const map = useEmptyMap
    ? createEmptyMapBlock(workspace)
    : createFactoryMapBlock(workspace, uiLanguage);
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
  targetFormat?: TargetFormatId,
): void {
  if (state && typeof Blockly.serialization?.blocks?.append === "function") {
    try {
      Blockly.serialization.blocks.append(state, workspace);
      const block = findDefaultsBlock(workspace);
      block?.setDeletable(false);
      dropDuplicateDefaults(workspace, block ?? findDefaultsBlock(workspace)!);
      if (findDefaultsBlock(workspace)) return;
    } catch {
      // fall through to factory
    }
  }
  ensureDefaultsBlock(workspace, uiLanguage, targetFormat);
}

/** Y for the top of the scaffold stack so it sits close under Defaults. */
export function yJustBelowDefaults(defaultsHeight: number, gap = SKELETON_GAP): number {
  return DEFAULTS_Y + defaultsHeight + gap;
}

/** Place the Defaults stack at top-left; put Template Skeleton underneath it. */
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
    if (block.type === DEFAULTS_BLOCK_TYPE) continue;
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

/** Replace abstract party shells with a Defaults Map lookup of the whole party. */
function attachPartyLookup(workspace: Blockly.Workspace, target: Blockly.Block, key: string): void {
  // Prefer plugging into PARTY_PROXY.KIND so the shell (and its SLOT_ID) stay.
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

/** Plug `maps_get` into COMPOSITION.composer / EVENT_CONTEXT.health_care_facility. */
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

/** Replace a CODE_PHRASE / term_pick shell with a Defaults Map lookup of the whole object. */
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

/**
 * Scaffold Default points: optional RM insert when needed, then Map lookup.
 * Object-valued Defaults Map keys (`term_pick`, `PARTY_IDENTIFIED`) plug into
 * the RM attribute mouth (COMPOSITION.language, EVENT_CONTEXT.health_care_facility, …).
 * Scalar keys (`*.time`, `*.start_time`, `*.origin`) still plug into the typed-shell leaf.
 * Skips slots that already have a non-shadow, non-literal mapping.
 */
function isUnderRoot(block: Blockly.Block | null, root: Blockly.Block): boolean {
  let current: Blockly.Block | null = block;
  while (current) {
    if (current.id === root.id) return true;
    current = current.getParent();
  }
  return false;
}

export function attachDefaultPointLookups(
  workspace: WorkspaceSvg | Blockly.Workspace,
  skeleton: SkeletonNode[],
  insertOptional?: OptionalInsertFn,
  scope?: { root: Blockly.Block },
): void {
  registerMapBlocks();
  const mapKeys = defaultsMapKeys(workspace as Blockly.Workspace);
  const bound = bindDefaultPoints(skeleton, mapKeys);
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
  targetFormat?: TargetFormatId,
): void {
  const defaults = ensureDefaultsBlock(workspace, uiLanguage, targetFormat);
  const input = defaults.getInput("MAP");
  const existing = input?.connection?.targetBlock();
  if (existing) existing.dispose(false);
  if (!mapBlockState || typeof Blockly.serialization?.blocks?.append !== "function") {
    const useEmptyMap = targetFormat === "json-schema" || targetFormat === "xml-schema";
    const map = useEmptyMap
      ? createEmptyMapBlock(workspace)
      : createFactoryMapBlock(workspace, uiLanguage);
    input?.connection?.connect(map.outputConnection!);
    return;
  }
  const appended = Blockly.serialization.blocks.append(
    mapBlockState as Record<string, unknown>,
    workspace,
  ) as Blockly.Block | undefined;
  if (appended?.outputConnection && input?.connection) {
    input.connection.connect(appended.outputConnection);
  }
}
