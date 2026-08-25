import type { SkeletonNode } from "../../types/mod.ts";
import { isSubtypeOf } from "../rm_meta.ts";

/** Leaf on the typed shell / party block that a Map lookup plugs into. */
export type DefaultPointLeaf = "code_string" | "value" | "name";

export interface DefaultPoint {
  /** Defaults Map key (simplified-format ctx field, no `ctx/` prefix). */
  mapKey: string;
  /** RM type of the parent that owns `rmAttribute` (ENTRY matches subtypes). */
  parentRmType: string;
  rmAttribute: string;
  leaf: DefaultPointLeaf;
  /** Insert this optional RM attribute when scaffolding if it is missing. */
  optionalInsert?: { rmType: string };
}

/**
 * v1 openEHR default-point table: one Defaults Map key may bind many slots.
 */
export const OPENEHR_DEFAULT_POINTS: DefaultPoint[] = [
  { mapKey: "language", parentRmType: "COMPOSITION", rmAttribute: "language", leaf: "code_string" },
  { mapKey: "language", parentRmType: "ENTRY", rmAttribute: "language", leaf: "code_string" },
  { mapKey: "territory", parentRmType: "COMPOSITION", rmAttribute: "territory", leaf: "code_string" },
  { mapKey: "encoding", parentRmType: "ENTRY", rmAttribute: "encoding", leaf: "code_string" },
  { mapKey: "time", parentRmType: "EVENT_CONTEXT", rmAttribute: "start_time", leaf: "value" },
  { mapKey: "time", parentRmType: "HISTORY", rmAttribute: "origin", leaf: "value" },
  { mapKey: "time", parentRmType: "EVENT", rmAttribute: "time", leaf: "value" },
  { mapKey: "time", parentRmType: "ACTION", rmAttribute: "time", leaf: "value" },
  { mapKey: "composer_name", parentRmType: "COMPOSITION", rmAttribute: "composer", leaf: "name" },
  {
    mapKey: "health_care_facility",
    parentRmType: "EVENT_CONTEXT",
    rmAttribute: "health_care_facility",
    leaf: "name",
    optionalInsert: { rmType: "PARTY_IDENTIFIED" },
  },
];

export interface BoundDefaultPoint {
  point: DefaultPoint;
  /** Skeleton node for the attribute (language CODE_PHRASE, composer PARTY_IDENTIFIED, …). */
  node: SkeletonNode;
  parent: SkeletonNode;
}

export function bindDefaultPoints(
  skeleton: SkeletonNode[],
  points: readonly DefaultPoint[] = OPENEHR_DEFAULT_POINTS,
): BoundDefaultPoint[] {
  const bound: BoundDefaultPoint[] = [];
  const walk = (nodes: SkeletonNode[], parent: SkeletonNode | null) => {
    for (const node of nodes) {
      if (parent) {
        for (const point of points) {
          if (node.rmAttribute !== point.rmAttribute) continue;
          if (!parentTypeMatches(parent.rmType, point.parentRmType)) continue;
          bound.push({ point, node, parent });
        }
      }
      if (node.children.length) walk(node.children, node);
    }
  };
  walk(skeleton, null);
  return bound;
}

function parentTypeMatches(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  try {
    return isSubtypeOf(actual, expected);
  } catch {
    return false;
  }
}
