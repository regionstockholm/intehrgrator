/**
 * Headless Blockly JSON ↔ Mapping Model sync (no DOM).
 * Used by WorkbenchService and the Agent API so MCP callers mutate block model JSON.
 */

import { Blockly } from "../blockly/blockly_core.ts";
import {
  applyModelExpressions,
  hydrateDefaultsMapArgument,
  initBlocklyGenerators,
  loadSkeletonIntoWorkspace,
  migrateForEachSourceState,
  registerSchemaBlocksFromSkeleton,
  workspaceToModelJson,
} from "../blockly/mod.ts";
import type { MappingModelExtract } from "../blockly/mapping_ir.ts";
import type { MappingModel, SkeletonNode, TargetFormatId } from "../types/mod.ts";
import type { WorkspaceSvg } from "blockly/core";
let generatorsReady = false;

function ensureGenerators(): void {
  if (generatorsReady) return;
  initBlocklyGenerators();
  generatorsReady = true;
}

/** Register schema-generated block types (TakeCare XSD, JSON Schema, …) before load. */
export function ensureSchemaBlocksForSkeleton(skeleton: SkeletonNode[]): void {
  ensureGenerators();
  if (skeleton.length) registerSchemaBlocksFromSkeleton(skeleton);
}

/** Apply Mapping Model expressions and loops onto a Blockly workspace snapshot. */
export function syncModelToBlocklyState(
  blocklyState: unknown,
  model: MappingModel,
  skeleton: SkeletonNode[] = [],
): unknown {
  if (!blocklyState || typeof blocklyState !== "object") return blocklyState;
  ensureSchemaBlocksForSkeleton(skeleton);
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(
      migrateForEachSourceState(JSON.parse(JSON.stringify(blocklyState))) as Record<string, unknown>,
      workspace,
    );
    applyModelExpressions(workspace, model, { recordUndo: false });
    return Blockly.serialization.workspaces.save(workspace);
  } finally {
    workspace.dispose();
  }
}

/** Headless Template Skeleton: Conversion start, Defaults, default-point lookups. */
export function scaffoldBlocklyFromSkeleton(
  skeleton: SkeletonNode[],
  model: MappingModel,
  options?: {
    uiLanguage?: string;
    targetFormat?: TargetFormatId;
    defaultsMap?: unknown;
  },
): { blocklyState: unknown; extract: MappingModelExtract } {
  ensureGenerators();
  const workspace = new Blockly.Workspace();
  const uiLanguage = options?.uiLanguage ?? "en";
  try {
    // Hydrate the pending Defaults Map *before* scaffolding so Default points
    // (including optional RM such as EVENT_CONTEXT.health_care_facility) bind
    // to the map that will actually sit on the canvas.
    if (options?.defaultsMap) {
      hydrateDefaultsMapArgument(
        workspace,
        options.defaultsMap,
        uiLanguage,
        options.targetFormat,
      );
    }
    loadSkeletonIntoWorkspace(
      workspace as unknown as WorkspaceSvg,
      skeleton,
      model,
      null,
      uiLanguage,
      options?.targetFormat,
      { factory: !options?.defaultsMap },
    );
    return {
      blocklyState: Blockly.serialization.workspaces.save(workspace),
      extract: workspaceToModelJson(workspace),
    };
  } finally {
    workspace.dispose();
  }
}

/**
 * Keep a catalog / imported Blockly mapping and extract the Mapping Model from
 * it. Do not apply an empty model back onto the canvas (that wipes mouths).
 */
export function adoptBlocklyState(
  blocklyState: unknown,
  skeleton: SkeletonNode[],
  options?: {
    defaultsMap?: unknown;
    uiLanguage?: string;
    targetFormat?: TargetFormatId;
  },
): { blocklyState: unknown; extract: MappingModelExtract } {
  if (!blocklyState || typeof blocklyState !== "object") {
    throw new Error("adoptBlocklyState requires Blockly workspace JSON");
  }
  ensureSchemaBlocksForSkeleton(skeleton);
  const workspace = new Blockly.Workspace();
  const uiLanguage = options?.uiLanguage ?? "en";
  try {
    Blockly.serialization.workspaces.load(
      migrateForEachSourceState(JSON.parse(JSON.stringify(blocklyState))) as Record<string, unknown>,
      workspace,
    );
    if (options?.defaultsMap) {
      hydrateDefaultsMapArgument(
        workspace,
        options.defaultsMap,
        uiLanguage,
        options.targetFormat,
      );
    }
    return {
      blocklyState: Blockly.serialization.workspaces.save(workspace),
      extract: workspaceToModelJson(workspace),
    };
  } finally {
    workspace.dispose();
  }
}
