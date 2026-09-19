import type { SkeletonNode } from "../../types/mod.ts";
import { attributesFor, baseRmTypeName, isSubtypeOf } from "../rm_meta.ts";
import { skeletonNodeForOptionalRm } from "../skeleton/generate_skeleton.ts";

/** Leaf on the typed shell / party block that a Map lookup plugs into. */
export type DefaultPointLeaf = "code_string" | "value" | "name" | "party";

export interface DefaultPoint {
  /** Defaults Map key (simplified-format ctx field, no `ctx/` prefix). */
  mapKey: string;
  /** RM type of the parent that owns `rmAttribute` (ENTRY matches subtypes). */
  parentRmType: string;
  rmAttribute: string;
  leaf: DefaultPointLeaf;
  /** Insert this optional RM attribute when scaffolding if it is missing. */
  optionalInsert?: { rmType: string };
  /**
   * When true, scaffolding only wires the lookup if the Defaults Map currently
   * has this key (used for `subject` → PARTY_SELF).
   */
  requireMapKey?: boolean;
}

/**
 * v1 openEHR default-point table: one Defaults Map key may bind many slots.
 * Path-qualified aliases (`EVENT_CONTEXT.health_care_facility`,
 * `COMPOSITION.context.health_care_facility`, `*.territory`) resolve at bind time
 * from the live Defaults Map keys.
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
    leaf: "party",
    optionalInsert: { rmType: "PARTY_IDENTIFIED" },
  },
  {
    mapKey: "subject",
    parentRmType: "ENTRY",
    rmAttribute: "subject",
    leaf: "party",
    requireMapKey: true,
  },
];

export interface BoundDefaultPoint {
  point: DefaultPoint;
  /** Skeleton node for the attribute (language CODE_PHRASE, composer PARTY_IDENTIFIED, …). */
  node: SkeletonNode;
  parent: SkeletonNode;
  /** Actual Defaults Map key for `maps_get` (path/wildcard or table `mapKey`). */
  mapKey: string;
}

export function bindDefaultPoints(
  skeleton: SkeletonNode[],
  points: readonly DefaultPoint[] = OPENEHR_DEFAULT_POINTS,
  mapKeys?: ReadonlySet<string>,
): BoundDefaultPoint[] {
  const table = points ?? OPENEHR_DEFAULT_POINTS;
  const bound: BoundDefaultPoint[] = [];
  const seen = new Set<string>();

  const consider = (
    point: DefaultPoint,
    node: SkeletonNode,
    parent: SkeletonNode,
    trail: readonly SkeletonNode[],
  ) => {
    const resolved = resolveDefaultsMapKey(
      mapKeys,
      trail,
      parent,
      point.rmAttribute,
      point.mapKey,
    );
    if (point.requireMapKey && mapKeys && !resolved) return;
    const mapKey = resolved ?? point.mapKey;
    const id = `${parent.slotId}::${point.rmAttribute}`;
    if (seen.has(id)) return;
    seen.add(id);
    bound.push({ point, node, parent, mapKey });
  };

  const walk = (nodes: SkeletonNode[], trail: SkeletonNode[]) => {
    for (const node of nodes) {
      const nextTrail = [...trail, node];
      if (trail.length) {
        const parent = trail[trail.length - 1]!;
        for (const point of table) {
          if (node.rmAttribute !== point.rmAttribute) continue;
          if (!parentTypeMatches(parent.rmType, point.parentRmType)) continue;
          consider(point, node, parent, trail);
        }
      }
      if (node.kind === "container") {
        bindMissingOptional(node, nextTrail, table, mapKeys, seen, bound);
      }
      if (node.children.length) walk(node.children, nextTrail);
    }
  };
  walk(skeleton, []);
  bindExtraPathKeys(skeleton, table, mapKeys, seen, bound);
  return bound;
}

/**
 * Choose the Defaults Map key that lights `parent.rmAttribute`.
 * Prefers the table ctx key, then `RM_TYPE.attr`, then an ancestor path, then `*.attr`.
 */
export function resolveDefaultsMapKey(
  mapKeys: ReadonlySet<string> | undefined,
  trail: readonly SkeletonNode[],
  parent: SkeletonNode,
  attribute: string,
  tableMapKey?: string,
): string | undefined {
  if (!mapKeys) return tableMapKey;
  const candidates: string[] = [];
  if (tableMapKey) candidates.push(tableMapKey);
  candidates.push(`${parent.rmType}.${attribute}`);
  const pathFromRoot = trailToPathKey(trail, attribute);
  if (pathFromRoot) candidates.push(pathFromRoot);
  candidates.push(`*.${attribute}`);
  for (const key of candidates) {
    if (mapKeys.has(key)) return key;
  }
  for (const key of mapKeys) {
    if (!key.includes(".")) continue;
    if (pathKeyMatches(key, trail, attribute)) return key;
  }
  return undefined;
}

function bindMissingOptional(
  parent: SkeletonNode,
  trail: readonly SkeletonNode[],
  table: readonly DefaultPoint[],
  mapKeys: ReadonlySet<string> | undefined,
  seen: Set<string>,
  bound: BoundDefaultPoint[],
): void {
  if (!mapKeys) return;
  for (const point of table) {
    if (!point.optionalInsert) continue;
    if (!parentTypeMatches(parent.rmType, point.parentRmType)) continue;
    if (parent.children.some((child) => child.rmAttribute === point.rmAttribute)) continue;
    const resolved = resolveDefaultsMapKey(
      mapKeys,
      trail,
      parent,
      point.rmAttribute,
      point.mapKey,
    );
    if (!resolved) continue;
    const id = `${parent.slotId}::${point.rmAttribute}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = skeletonNodeForOptionalRm(parent, point.optionalInsert.rmType, point.rmAttribute);
    bound.push({ point, node, parent, mapKey: resolved });
  }
}

function bindExtraPathKeys(
  skeleton: SkeletonNode[],
  table: readonly DefaultPoint[],
  mapKeys: ReadonlySet<string> | undefined,
  seen: Set<string>,
  bound: BoundDefaultPoint[],
): void {
  if (!mapKeys) return;
  for (const key of mapKeys) {
    if (!key.includes(".")) continue;
    const attribute = key.split(".").pop();
    if (!attribute) continue;
    walkContainers(skeleton, [], (parent, trail) => {
      if (!pathKeyMatches(key, trail, attribute)) return;
      const id = `${parent.slotId}::${attribute}`;
      if (seen.has(id)) return;
      const existing = parent.children.find((child) => child.rmAttribute === attribute);
      const tablePoint = table.find((point) =>
        point.rmAttribute === attribute && parentTypeMatches(parent.rmType, point.parentRmType)
      );
      const slotType = slotRmType(parent.rmType, attribute, tablePoint);
      if (!slotType) return;
      const point = tablePoint ?? {
        mapKey: key,
        parentRmType: parent.rmType,
        rmAttribute: attribute,
        leaf: leafForRmType(slotType),
        optionalInsert: { rmType: slotType },
      };
      const node = existing ?? skeletonNodeForOptionalRm(parent, slotType, attribute);
      if (!existing && !point.optionalInsert) return;
      seen.add(id);
      bound.push({ point, node, parent, mapKey: key });
    });
  }
}

function walkContainers(
  nodes: SkeletonNode[],
  trail: SkeletonNode[],
  visit: (node: SkeletonNode, trail: readonly SkeletonNode[]) => void,
): void {
  for (const node of nodes) {
    const next = [...trail, node];
    if (node.kind === "container") visit(node, next);
    if (node.children.length) walkContainers(node.children, next, visit);
  }
}

function trailToPathKey(trail: readonly SkeletonNode[], attribute: string): string | undefined {
  if (!trail.length) return undefined;
  const parts: string[] = [];
  for (let i = 0; i < trail.length; i++) {
    const node = trail[i]!;
    parts.push(i === 0 ? node.rmType : (node.rmAttribute || node.rmType));
  }
  parts.push(attribute);
  return parts.join(".");
}

function pathKeyMatches(key: string, trail: readonly SkeletonNode[], attribute: string): boolean {
  const parts = key.split(".").filter(Boolean);
  if (parts.length < 2) return false;
  const last = parts[parts.length - 1]!;
  if (last !== attribute && last !== "*") return false;
  const prefix = parts.slice(0, -1);
  if (prefix.length === 1 && prefix[0] === "*") return true;
  if (prefix.length > trail.length) return false;
  const start = trail.length - prefix.length;
  for (let i = 0; i < prefix.length; i++) {
    const part = prefix[i]!;
    const node = trail[start + i]!;
    if (part === "*") continue;
    if (parentTypeMatches(node.rmType, part)) continue;
    if (node.rmAttribute === part) continue;
    return false;
  }
  return true;
}

function slotRmType(
  parentRmType: string,
  attribute: string,
  tablePoint: DefaultPoint | undefined,
): string | undefined {
  if (tablePoint?.optionalInsert?.rmType) return tablePoint.optionalInsert.rmType;
  const meta = attributesFor(parentRmType).find((attr) => attr.name === attribute);
  if (!meta) return undefined;
  return baseRmTypeName(meta.typeName);
}

function leafForRmType(rmType: string): DefaultPointLeaf {
  if (rmType.startsWith("PARTY_")) return "party";
  if (rmType === "CODE_PHRASE") return "code_string";
  return "value";
}

function parentTypeMatches(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  try {
    return isSubtypeOf(actual, expected);
  } catch {
    return false;
  }
}
