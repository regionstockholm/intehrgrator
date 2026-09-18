import type { Block, Workspace } from "blockly/core";
import {
  blockConstraintMessages,
  isInNonMandatoryField,
  isProtectedSpecBlock,
  isUnmappedBlockTree,
} from "../../blockly/block_constraints.ts";
import { replaceCanvasUndoable } from "../../blockly/blockly_events.ts";

function blockHasConstraintWarning(block: Block): boolean {
  return blockConstraintMessages(block).length > 0;
}

function ancestorBlockIds(workspace: Workspace, blockId: string): Set<string> {
  const block = workspace.getBlockById(blockId);
  if (!block) return new Set();
  const ancestors = new Set<string>();
  let current: Block | null = block;
  while (current) {
    const parent = current.getParent() ?? current.getSurroundParent?.() ?? null;
    if (!parent) break;
    ancestors.add(parent.id);
    current = parent;
  }
  return ancestors;
}

/** Top-level ids only — skip a block when an ancestor is also selected. */
export function topLevelBlockIds(workspace: Workspace, ids: Iterable<string>): string[] {
  const set = new Set(ids);
  return [...set].filter((id) => {
    for (const ancestorId of ancestorBlockIds(workspace, id)) {
      if (set.has(ancestorId)) return false;
    }
    return true;
  });
}

/** Unmapped optional scaffold trees that currently show a constraint warning. */
export function blocksEligibleForBulkMark(workspace: Workspace): string[] {
  const eligible: string[] = [];
  for (const block of workspace.getAllBlocks(false)) {
    if (typeof block.isShadow === "function" && block.isShadow()) continue;
    if (isProtectedSpecBlock(block)) continue;
    const slotId = block.getFieldValue("SLOT_ID");
    if (!slotId) continue;
    if (!isInNonMandatoryField(block)) continue;
    if (!isUnmappedBlockTree(block)) continue;
    if (!blockHasConstraintWarning(block)) continue;
    eligible.push(block.id);
  }
  return topLevelBlockIds(workspace, eligible);
}

/** Delete checked spec rows as one undoable canvas step; returns removed root ids. */
export function deleteMarkedSpecBlocks(
  workspace: Workspace,
  checkedIds: ReadonlySet<string>,
): string[] {
  const roots = topLevelBlockIds(
    workspace,
    [...checkedIds].filter((id) => {
      const block = workspace.getBlockById(id);
      return block && !isProtectedSpecBlock(block);
    }),
  );
  if (!roots.length) return [];
  replaceCanvasUndoable(workspace, () => {
    for (const id of roots) {
      workspace.getBlockById(id)?.dispose(true);
    }
  });
  return roots;
}

/** Drop stale checks after the canvas or spec projection changes. */
export function pruneCheckedBlockIds(
  workspace: Workspace,
  checkedIds: ReadonlySet<string>,
): Set<string> {
  const next = new Set<string>();
  for (const id of checkedIds) {
    if (workspace.getBlockById(id)) next.add(id);
  }
  return next;
}
