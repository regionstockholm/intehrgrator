/**
 * Headless Blockly JSON ↔ Mapping Model sync (no DOM).
 * Used by WorkbenchService and the Agent API so MCP callers mutate block model JSON.
 */

import { Blockly } from "../blockly/blockly_core.ts";
import { applyModelExpressions, initBlocklyGenerators } from "../blockly/mod.ts";
import type { MappingModel } from "../types/mod.ts";

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
    Blockly.serialization.workspaces.load(blocklyState as Record<string, unknown>, workspace);
    applyModelExpressions(workspace, model, { recordUndo: false });
    return Blockly.serialization.workspaces.save(workspace);
  } finally {
    workspace.dispose();
  }
}
