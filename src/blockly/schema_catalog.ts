/** In-memory skeleton index for schema target blocks (toolbox + optional-field mutator). */

import type { SkeletonNode } from "../types/mod.ts";

let catalogRoots: SkeletonNode[] = [];

export function setSchemaCatalog(skeleton: SkeletonNode[]): void {
  catalogRoots = skeleton;
}

export function findSkeletonNode(slotId: string): SkeletonNode | undefined {
  const walk = (nodes: SkeletonNode[]): SkeletonNode | undefined => {
    for (const node of nodes) {
      if (node.slotId === slotId) return node;
      const nested = walk(node.children);
      if (nested) return nested;
    }
    return undefined;
  };
  return walk(catalogRoots);
}

export function optionalSchemaChildren(slotId: string): SkeletonNode[] {
  const node = findSkeletonNode(slotId);
  if (!node) return [];
  return node.children.filter((child) => child.mandatory !== true);
}

export function skeletonToolboxSignature(skeleton: SkeletonNode[]): string {
  const parts: string[] = [];
  const walk = (node: SkeletonNode) => {
    parts.push(`${node.slotId}|${node.label}|${node.mandatory}|${node.blockType}`);
    for (const child of node.children) walk(child);
  };
  for (const root of skeleton) walk(root);
  return parts.join(";");
}
