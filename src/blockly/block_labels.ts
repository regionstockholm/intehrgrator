import type { Block } from "blockly/core";
import type { SkeletonNode } from "../types/mod.ts";
import { archetypeShortName } from "../core/skeleton/template_terms.ts";
import { isSkeletonTitleField } from "./field_skeleton_title.ts";

export function skeletonBlockTooltip(node: SkeletonNode): string {
  const parts: string[] = [];
  if (node.archetypeRef) {
    parts.push(node.archetypeRef);
    const short = node.archetypeShortName ?? archetypeShortName(node.archetypeRef);
    if (short && short !== node.archetypeRef) parts.push(`(${short})`);
  }
  if (node.archetypeNodeId) parts.push(node.archetypeNodeId);
  if (node.rmType) parts.push(node.rmType);
  parts.push(node.slotId);
  return parts.join(" · ");
}

export function applySkeletonBlockLabels(block: Block, node: SkeletonNode): void {
  setFieldIfPresent(block, "NAME", node.label);
  const nameField = block.getField("NAME");
  if (isSkeletonTitleField(nameField)) {
    if (node.rmType) nameField.setClassName(node.rmType);
    nameField.setAtCode(node.archetypeNodeId ?? "");
  } else if (node.archetypeNodeId) {
    setFieldIfPresent(block, "AT_CODE", node.archetypeNodeId);
  }
  if (node.archetypeRef) {
    const short = node.archetypeShortName ?? archetypeShortName(node.archetypeRef);
    setFieldIfPresent(block, "ARCHETYPE_CTX", short);
  }
  block.setTooltip(skeletonBlockTooltip(node));
}

/** Update NAME / ontology labels on existing workspace blocks from a new skeleton. */
export function relabelWorkspaceFromSkeleton(
  workspace: { getAllBlocks: (ordered?: boolean) => Block[] },
  skeleton: SkeletonNode[],
): void {
  const bySlot = new Map<string, SkeletonNode>();
  walkSkeleton(skeleton, (node) => bySlot.set(node.slotId, node));
  for (const block of workspace.getAllBlocks(false)) {
    const slotId = block.getFieldValue?.("SLOT_ID");
    if (typeof slotId !== "string" || !slotId) continue;
    const node = bySlot.get(slotId);
    if (node) applySkeletonBlockLabels(block, node);
  }
}

function walkSkeleton(nodes: SkeletonNode[], visit: (node: SkeletonNode) => void): void {
  for (const node of nodes) {
    visit(node);
    if (node.children.length) walkSkeleton(node.children, visit);
  }
}

function setFieldIfPresent(block: Block, name: string, value: string): void {
  const field = block.getField(name);
  if (field) field.setValue(value);
}
