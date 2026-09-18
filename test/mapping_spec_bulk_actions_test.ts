import { assert, assertEquals } from "@std/assert";
import type { SkeletonNode } from "@intehrgrator/types/mod.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { registerRmBlocks } from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { registerMapBlocks } from "@intehrgrator/blockly/blocks/map_blocks.ts";
import { loadSkeletonIntoWorkspace } from "@intehrgrator/blockly/skeleton_loader.ts";
import {
  refreshWorkspaceConstraints,
  UNMAPPED_OPTIONAL_SCAFFOLD_WARNING,
  blockConstraintMessages,
} from "@intehrgrator/blockly/block_constraints.ts";
import {
  blocksEligibleForBulkMark,
  deleteMarkedSpecBlocks,
  pruneCheckedBlockIds,
  topLevelBlockIds,
} from "@intehrgrator/workbench/mapping_spec/bulk_actions.ts";

function ensureBlocks(): void {
  registerRmBlocks();
  registerMapBlocks();
}

Deno.test("optional scaffolded observation gets unmapped optional warning", () => {
  ensureBlocks();
  const skeleton: SkeletonNode[] = [{
    slotId: "t",
    blockType: "composition",
    rmType: "COMPOSITION",
    label: "Encounter",
    kind: "container",
    mandatory: true,
    children: [{
      slotId: "t/content/bp",
      blockType: "observation",
      rmType: "OBSERVATION",
      label: "Blood pressure",
      rmAttribute: "content",
      kind: "container",
      mandatory: false,
      children: [],
    }],
  }];
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  refreshWorkspaceConstraints(workspace);
  const bp = workspace.getAllBlocks(false).find(
    (block) => block.getFieldValue("NAME") === "Blood pressure",
  );
  assert(bp, "expected optional observation scaffold");
  const warning = blockConstraintMessages(bp).join("\n");
  assertEquals(warning.includes(UNMAPPED_OPTIONAL_SCAFFOLD_WARNING), true);
  workspace.dispose();
});

Deno.test("blocksEligibleForBulkMark returns optional unmapped scaffold roots", () => {
  ensureBlocks();
  const skeleton: SkeletonNode[] = [{
    slotId: "t",
    blockType: "composition",
    rmType: "COMPOSITION",
    label: "Encounter",
    kind: "container",
    mandatory: true,
    children: [{
      slotId: "t/content/bp",
      blockType: "observation",
      rmType: "OBSERVATION",
      label: "Blood pressure",
      rmAttribute: "content",
      kind: "container",
      mandatory: false,
      children: [],
    }],
  }];
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  refreshWorkspaceConstraints(workspace);
  const bp = workspace.getAllBlocks(false).find(
    (block) => block.getFieldValue("NAME") === "Blood pressure",
  );
  assert(bp);
  assertEquals(blocksEligibleForBulkMark(workspace), [bp.id]);
  workspace.dispose();
});

Deno.test("topLevelBlockIds keeps only outermost checked nodes", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const first = workspace.newBlock("observation");
  const second = workspace.newBlock("observation");
  first.nextConnection!.connect(second.previousConnection!);
  const marked = topLevelBlockIds(workspace, [first.id, second.id]);
  assertEquals(marked, [first.id]);
  workspace.dispose();
});

Deno.test("deleteMarkedSpecBlocks removes checked optional scaffold as one undo step", () => {
  ensureBlocks();
  const skeleton: SkeletonNode[] = [{
    slotId: "t",
    blockType: "composition",
    rmType: "COMPOSITION",
    label: "Encounter",
    kind: "container",
    mandatory: true,
    children: [{
      slotId: "t/content/bp",
      blockType: "observation",
      rmType: "OBSERVATION",
      label: "Blood pressure",
      rmAttribute: "content",
      kind: "container",
      mandatory: false,
      children: [],
    }],
  }];
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  refreshWorkspaceConstraints(workspace);
  const bp = workspace.getAllBlocks(false).find(
    (block) => block.getFieldValue("NAME") === "Blood pressure",
  );
  assert(bp);
  const deleted = deleteMarkedSpecBlocks(workspace, new Set([bp.id]));
  assertEquals(deleted, [bp.id]);
  assertEquals(
    workspace.getAllBlocks(false).some((block) => block.getFieldValue("NAME") === "Blood pressure"),
    false,
  );
  workspace.dispose();
});

Deno.test("pruneCheckedBlockIds drops ids that no longer exist", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock("text");
  const pruned = pruneCheckedBlockIds(workspace, new Set([block.id, "missing"]));
  assertEquals([...pruned], [block.id]);
  workspace.dispose();
});
