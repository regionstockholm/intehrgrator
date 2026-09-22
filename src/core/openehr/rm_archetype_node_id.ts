/**
 * RM `archetype_node_id` for a skeleton node.
 *
 * Archetype roots are addressed by their archetype id (Web Template AQL
 * predicates such as `/content[openEHR-EHR-ACTION.medication.v1]` and
 * `items[openEHR-EHR-CLUSTER.medication.v2]`). Nodes inside an archetype
 * keep the at-code stored on `archetypeNodeId`.
 * The skeleton field itself stays the at-code so slot ids and term lookup
 * do not change.
 */

import type { SkeletonNode } from "../../types/mod.ts";
import { isArchetypeId } from "../skeleton/template_terms.ts";

export function rmArchetypeNodeId(
  node: Pick<SkeletonNode, "archetypeNodeId" | "archetypeRef">,
  parentArchetypeRef?: string,
): string | undefined {
  const ref = node.archetypeRef;
  if (ref && isArchetypeId(ref) && ref !== parentArchetypeRef) return ref;
  const at = node.archetypeNodeId?.trim();
  return at || undefined;
}

/** Slot ids whose emitted RM identity is an archetype id, not the at-code on the block. */
export function archetypeRootIdBySlot(nodes: SkeletonNode[]): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (node: SkeletonNode, parentRef?: string) => {
    const id = rmArchetypeNodeId(node, parentRef);
    if (id && isArchetypeId(id) && id !== node.archetypeNodeId) {
      map.set(node.slotId, id);
    }
    const next = node.archetypeRef ?? parentRef;
    for (const child of node.children) walk(child, next);
  };
  for (const node of nodes) walk(node);
  return map;
}
