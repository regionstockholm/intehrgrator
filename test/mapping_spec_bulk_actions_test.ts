import { join } from "@std/path";
import { assert, assertEquals } from "@std/assert";
import type { SkeletonNode } from "@intehrgrator/types/mod.ts";
import { generateSkeleton } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
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
import { blocklyJsonDocument } from "@intehrgrator/workbench/mapping_spec/project.ts";
import { specWarningMarkers } from "@intehrgrator/workbench/mapping_spec/overview.ts";
import {
  blocksEligibleForBulkMark,
  deleteMarkedSpecBlocks,
  isWithinOptionalUnmappedScaffold,
  optionalUnmappedScaffoldRootIds,
  pruneCheckedBlockIds,
  specRowBlockIdsEligibleForBulkMark,
  topLevelBlockIds,
} from "@intehrgrator/workbench/mapping_spec/bulk_actions.ts";

function ensureBlocks(): void {
  registerRmBlocks();
  registerMapBlocks();
}

function optionalObservation(label: string, slotId: string): SkeletonNode {
  return {
    slotId,
    blockType: "observation",
    rmType: "OBSERVATION",
    label,
    rmAttribute: "content",
    kind: "container",
    mandatory: false,
    children: [],
  };
}

function warningsForWorkspace(workspace: Blockly.Workspace): Record<string, string> {
  const warnings: Record<string, string> = {};
  for (const block of workspace.getAllBlocks(false)) {
    const messages = blockConstraintMessages(block);
    if (messages.length) warnings[block.id] = messages.join("\n");
  }
  return warnings;
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
    children: [optionalObservation("Blood pressure", "t/content/bp")],
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

Deno.test("blocksEligibleForBulkMark returns every optional unmapped scaffold block", () => {
  ensureBlocks();
  const skeleton: SkeletonNode[] = [{
    slotId: "t",
    blockType: "composition",
    rmType: "COMPOSITION",
    label: "Encounter",
    kind: "container",
    mandatory: true,
    children: [
      optionalObservation("Blood pressure", "t/content/bp"),
      optionalObservation("Pulse oximetry", "t/content/pulse"),
    ],
  }];
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  refreshWorkspaceConstraints(workspace);
  const eligible = blocksEligibleForBulkMark(workspace);
  assertEquals(eligible.length, 2);
  workspace.dispose();
});

Deno.test("specRowBlockIdsEligibleForBulkMark marks every warned spec row", () => {
  ensureBlocks();
  const skeleton: SkeletonNode[] = [{
    slotId: "t",
    blockType: "composition",
    rmType: "COMPOSITION",
    label: "Encounter",
    kind: "container",
    mandatory: true,
    children: [
      optionalObservation("Blood pressure", "t/content/bp"),
      optionalObservation("Pulse oximetry", "t/content/pulse"),
    ],
  }];
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  refreshWorkspaceConstraints(workspace);
  const state = Blockly.serialization.workspaces.save(workspace);
  const warnings = warningsForWorkspace(workspace);
  const doc = blocklyJsonDocument(state);
  const markers = specWarningMarkers(doc, warnings);
  const eligible = specRowBlockIdsEligibleForBulkMark(workspace, doc, warnings);
  assert(markers.length >= 2, `expected at least 2 warned spec rows, got ${markers.length}`);
  assertEquals(
    eligible.length,
    markers.length,
    "every warned optional scaffold spec row should be eligible for bulk mark",
  );
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
    children: [optionalObservation("Blood pressure", "t/content/bp")],
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

Deno.test("specRowBlockIdsEligibleForBulkMark includes nested rows in optional scaffold subtrees", async () => {
  ensureBlocks();
  const opt = await Deno.readTextFile(join(import.meta.dirname!, "fixtures/blood_pressure.opt"));
  const { skeleton } = generateSkeleton(opt);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  refreshWorkspaceConstraints(workspace);

  const warnings = warningsForWorkspace(workspace);
  const doc = blocklyJsonDocument(Blockly.serialization.workspaces.save(workspace));
  const eligible = specRowBlockIdsEligibleForBulkMark(workspace, doc, warnings);
  const eligibleLabels = eligible.map((id) => {
    const line = doc.widgets.find((w) => w.line.blockId === id)?.line;
    return `${line?.indent}:${line?.label}`;
  });

  assert(
    eligible.some((id) =>
      doc.widgets.find((w) => w.line.blockId === id)?.line.label === "Admin detail"
    ),
    "expected optional cluster root row",
  );
  assert(
    eligible.some((id) =>
      doc.widgets.find((w) => w.line.blockId === id)?.line.label === "Name"
    ),
    "expected nested mandatory element under optional cluster",
  );
  assert(
    !eligible.some((id) =>
      doc.widgets.find((w) => w.line.blockId === id)?.line.label === "Systolic"
    ),
    "mandatory observation elements outside optional scaffold should not be marked",
  );
  assert(eligible.length >= 12, `expected deep subtree coverage, got ${eligibleLabels.join(", ")}`);
  workspace.dispose();
});

Deno.test("mark after delete finds remaining optional scaffold rows", async () => {
  ensureBlocks();
  const opt = await Deno.readTextFile(join(import.meta.dirname!, "fixtures/blood_pressure.opt"));
  const { skeleton } = generateSkeleton(opt);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  refreshWorkspaceConstraints(workspace);

  const warnings = () => warningsForWorkspace(workspace);
  const doc = () => blocklyJsonDocument(Blockly.serialization.workspaces.save(workspace));
  const roots = optionalUnmappedScaffoldRootIds(workspace);
  const adminRoot = [...roots].find((id) =>
    workspace.getBlockById(id)?.getFieldValue("NAME") === "Admin detail"
  );
  assert(adminRoot, "expected Admin detail optional scaffold root");

  deleteMarkedSpecBlocks(workspace, new Set([adminRoot]));
  refreshWorkspaceConstraints(workspace);

  const afterDelete = specRowBlockIdsEligibleForBulkMark(workspace, doc(), warnings());
  assertEquals(afterDelete.includes(adminRoot), false);
  assert(
    afterDelete.length > 0,
    "remaining optional scaffold rows should still be eligible after delete",
  );
  workspace.dispose();
});

Deno.test("optionalUnmappedScaffoldRootIds excludes nested eligible blocks under a root", () => {
  ensureBlocks();
  const skeleton: SkeletonNode[] = [{
    slotId: "t",
    blockType: "composition",
    rmType: "COMPOSITION",
    label: "Encounter",
    kind: "container",
    mandatory: true,
    children: [optionalObservation("Blood pressure", "t/content/bp")],
  }];
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  refreshWorkspaceConstraints(workspace);
  const roots = optionalUnmappedScaffoldRootIds(workspace);
  const eligible = blocksEligibleForBulkMark(workspace);
  assertEquals(roots.size, 1);
  assertEquals([...roots], topLevelBlockIds(workspace, eligible));
  for (const id of eligible) {
    assert(isWithinOptionalUnmappedScaffold(workspace, id, roots));
  }
  workspace.dispose();
});
