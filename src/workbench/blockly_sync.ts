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

/** Apply Mapping Model expressions and loops onto a Blockly workspace snapshot. */
export function syncModelToBlocklyState(
  blocklyState: unknown,
  model: MappingModel,
): unknown {
  if (!blocklyState || typeof blocklyState !== "object") return blocklyState;
  ensureGenerators();
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
    loadSkeletonIntoWorkspace(
      workspace as unknown as WorkspaceSvg,
      skeleton,
      model,
      null,
      uiLanguage,
      options?.targetFormat,
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
