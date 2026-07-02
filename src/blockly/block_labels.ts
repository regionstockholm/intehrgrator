import type { Block } from "blockly/core";
import type { SkeletonNode } from "../types/mod.ts";
import { archetypeShortName } from "../core/skeleton/template_terms.ts";

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
  if (node.archetypeNodeId) {
    setFieldIfPresent(block, "AT_CODE", node.archetypeNodeId);
  }
  if (node.archetypeRef) {
    const short = node.archetypeShortName ?? archetypeShortName(node.archetypeRef);
    setFieldIfPresent(block, "ARCHETYPE_CTX", short);
  }
  block.setTooltip(skeletonBlockTooltip(node));
}

function setFieldIfPresent(block: Block, name: string, value: string): void {
  const field = block.getField(name);
  if (field) field.setValue(value);
}
