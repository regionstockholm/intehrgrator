import type { SkeletonNode } from "../../types/mod.ts";
import { attributesFor, baseRmTypeName, isSubtypeOf } from "../rm_meta.ts";
import { skeletonNodeForOptionalRm } from "../skeleton/generate_skeleton.ts";

/** Leaf on the typed shell / party block that a Map lookup plugs into. */
export type DefaultPointLeaf = "code_string" | "value" | "party";

export interface DefaultPoint {
  /** Defaults Map key that lit this slot (`*.language`, `COMPOSITION.composer`, …). */
  mapKey: string;
  /** RM type of the parent that owns `rmAttribute`. */
  parentRmType: string;
  rmAttribute: string;
  leaf: DefaultPointLeaf;
  /** Insert this optional RM attribute when scaffolding if it is missing. */
  optionalInsert?: { rmType: string };
}

export interface BoundDefaultPoint {
  point: DefaultPoint;
  /** Skeleton node for the attribute (language CODE_PHRASE, composer PARTY_IDENTIFIED, …). */
  node: SkeletonNode;
  parent: SkeletonNode;
  /** Defaults Map key for `maps_get`. */
  mapKey: string;
}

/**
 * Bind Default points from live Defaults Map keys only.
 * Keys are RM paths: `Class.attribute`, ancestor paths
 * (`COMPOSITION.context.health_care_facility`), and wildcards (`*.language`).
 * Bare simplified-format `ctx` names are ignored.
 */
export function bindDefaultPoints(
  skeleton: SkeletonNode[],
  mapKeys?: ReadonlySet<string>,
): BoundDefaultPoint[] {
  if (!mapKeys?.size) return [];
  const bound: BoundDefaultPoint[] = [];
  const seen = new Set<string>();
  const keys = [...mapKeys]
    .filter((key) => parseDefaultsPathKey(key))
    .sort((a, b) => pathKeySpecificity(b) - pathKeySpecificity(a));
  for (const key of keys) {
    const parsed = parseDefaultsPathKey(key);
    if (!parsed) continue;
    walkContainers(skeleton, [], (parent, trail) => {
      if (!pathKeyMatches(key, trail, parsed.attribute)) return;
      const id = `${parent.slotId}::${parsed.attribute}`;
      if (seen.has(id)) return;
      if (isProhibited(parent, parsed.attribute)) return;
      const existing = parent.children.find((child) => child.rmAttribute === parsed.attribute);
      const slot = slotMeta(parent.rmType, parsed.attribute);
      if (!slot) return;
      // Missing mandatory RM (language, subject, …) is a skeleton gap, not an insert.
      // Only optional RM (health_care_facility, …) is created so the lookup has a mouth.
      if (!existing && slot.mandatory) return;
      seen.add(id);
      const node = existing ?? skeletonNodeForOptionalRm(parent, slot.rmType, parsed.attribute);
      bound.push({
        point: {
          mapKey: key,
          parentRmType: parent.rmType,
          rmAttribute: parsed.attribute,
          leaf: leafForRmType(slot.rmType),
          optionalInsert: existing ? undefined : { rmType: slot.rmType },
        },
        node,
        parent,
        mapKey: key,
      });
    });
  }
  return bound;
}

/** Last path segment of a Class.attribute / wildcard key; `undefined` for bare names. */
export function parseDefaultsPathKey(
  key: string,
): { attribute: string; parts: string[] } | undefined {
  const parts = key.split(".").filter(Boolean);
  if (parts.length < 2) return undefined;
  const attribute = parts[parts.length - 1]!;
  if (!attribute || attribute === "*") return undefined;
  return { attribute, parts };
}

/**
 * Choose the most specific Defaults Map key that lights `attribute` on `trail`.
 */
export function resolveDefaultsMapKey(
  mapKeys: ReadonlySet<string> | undefined,
  trail: readonly SkeletonNode[],
  attribute: string,
): string | undefined {
  if (!mapKeys?.size) return undefined;
  let best: { key: string; score: number } | undefined;
  for (const key of mapKeys) {
    if (!pathKeyMatches(key, trail, attribute)) continue;
    const score = pathKeySpecificity(key);
    if (!best || score > best.score) best = { key, score };
  }
  return best?.key;
}

function pathKeySpecificity(key: string): number {
  return key.split(".").filter(Boolean).reduce(
    (score, part) => score + (part === "*" ? 1 : 11),
    0,
  );
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

function pathKeyMatches(key: string, trail: readonly SkeletonNode[], attribute: string): boolean {
  const parsed = parseDefaultsPathKey(key);
  if (!parsed || parsed.attribute !== attribute) return false;
  const prefix = parsed.parts.slice(0, -1);
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

function slotMeta(
  parentRmType: string,
  attribute: string,
): { rmType: string; mandatory: boolean } | undefined {
  const meta = attributesFor(parentRmType).find((attr) => attr.name === attribute);
  if (!meta) return undefined;
  return { rmType: baseRmTypeName(meta.typeName), mandatory: meta.mandatory };
}

function leafForRmType(rmType: string): DefaultPointLeaf {
  if (rmType.startsWith("PARTY_")) return "party";
  if (rmType === "CODE_PHRASE") return "code_string";
  return "value";
}

function isProhibited(parent: SkeletonNode, attribute: string): boolean {
  return Boolean(
    parent.attributeConstraints?.some((row) => row.name === attribute && row.prohibited),
  );
}

function parentTypeMatches(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  try {
    return isSubtypeOf(actual, expected);
  } catch {
    return false;
  }
}
