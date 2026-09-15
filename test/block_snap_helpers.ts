import { assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";

let blocksReady = false;

/** Register all Blockly block types used in snap matrix tests. */
export function ensureSnapBlocks(): void {
  if (blocksReady) return;
  initBlocklyGenerators();
  blocksReady = true;
}

export function createSnapWorkspace(): Blockly.Workspace {
  ensureSnapBlocks();
  return new Blockly.Workspace();
}

/** Ask Blockly's connection checker whether two connections may snap. */
export function canConnect(
  workspace: Blockly.Workspace,
  a: Blockly.Connection | null | undefined,
  b: Blockly.Connection | null | undefined,
  isDrag = false,
): boolean {
  if (!a || !b) return false;
  return workspace.connectionChecker.canConnect(a, b, isDrag);
}

export type SnapCase = {
  label: string;
  a: Blockly.Connection | null | undefined;
  b: Blockly.Connection | null | undefined;
  expect: boolean;
};

/** Assert a batch of expected snap outcomes; failures include the case label. */
export function assertSnapCases(workspace: Blockly.Workspace, cases: SnapCase[]): void {
  for (const { label, a, b, expect } of cases) {
    assertEquals(canConnect(workspace, a, b, false), expect, label);
  }
}
