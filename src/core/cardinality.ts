/**
 * Attribute existence/cardinality intervals: RM BMM vs effective OPT.
 * Blockly captions and Constraint Overlay are a view of this pair.
 */

import { attributesFor } from "./rm_meta.ts";

export type CardinalityInterval = {
  min: number;
  max: number | null;
};

/** Better Archetype Designer-style delta glyph for Constraint Overlay. */
export const OVERLAY_DELTA = "Δ";

/** Always `[n..m]` / `[n..*]`, including `[1..1]` rather than a bare `1`. */
export function formatCardinalityBrackets(card: CardinalityInterval): string {
  const upper = card.max == null ? "*" : String(card.max);
  return `[${card.min}..${upper}]`;
}

/** Compact `1` / `0..1` / `0..*` form used on SkeletonNode strings. */
export function formatCardinalityCompact(card: CardinalityInterval): string {
  const upper = card.max == null ? "*" : String(card.max);
  if (card.min === 1 && card.max === 1) return "1";
  return `${card.min}..${upper}`;
}

export function parseCardinality(raw?: string | null): CardinalityInterval | undefined {
  if (!raw) return undefined;
  const text = raw.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (text === "1") return { min: 1, max: 1 };
  const star = /^(\d+)\.\.\*$/.exec(text);
  if (star) return { min: Number(star[1]), max: null };
  const range = /^(\d+)\.\.(\d+)$/.exec(text);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  return undefined;
}

export function intervalsEqual(
  a: CardinalityInterval,
  b: CardinalityInterval,
): boolean {
  return a.min === b.min && a.max === b.max;
}

/**
 * True when `effective` is a strict narrowing of `rm` (higher min and/or
 * lower max; unbounded `*` is wider than any finite max).
 */
export function isStrictNarrowing(
  rm: CardinalityInterval,
  effective: CardinalityInterval,
): boolean {
  if (effective.min > rm.min) return true;
  if (rm.max == null && effective.max != null) return true;
  if (rm.max != null && effective.max != null && effective.max < rm.max) {
    return true;
  }
  return false;
}

export function isProhibitedInterval(card: CardinalityInterval): boolean {
  return card.max === 0;
}

export function isCardinalityMet(
  count: number,
  card: CardinalityInterval,
): boolean {
  if (count < card.min) return false;
  if (card.max != null && count > card.max) return false;
  return true;
}

export function rmAttributeInterval(
  rmType: string,
  attrName: string,
): CardinalityInterval | undefined {
  const meta = attributesFor(rmType).find((a) => a.name === attrName);
  if (!meta?.multiplicity) return undefined;
  return {
    min: Number(meta.multiplicity.min ?? 0),
    max: meta.multiplicity.max == null ? null : Number(meta.multiplicity.max),
  };
}

/**
 * Parse AOM `Multiplicity_interval` / occurrences / existence objects
 * (`lower`, `upper`, `upper_unbounded`).
 */
export function intervalFromAmBound(occ: unknown): CardinalityInterval | undefined {
  if (!occ || typeof occ !== "object") return undefined;
  const rec = occ as {
    lower?: unknown;
    upper?: unknown;
    _upper?: unknown;
    upper_unbounded?: unknown;
    _upper_unbounded?: unknown | { value?: unknown };
  };
  const lower = Number(rec.lower ?? 0);
  const unbounded = rec.upper_unbounded === true ||
    rec._upper_unbounded === true ||
    (typeof rec._upper_unbounded === "object" &&
      rec._upper_unbounded?.value === true);
  const upperRaw = rec.upper ?? rec._upper;
  if (unbounded || upperRaw == null) {
    return { min: Number.isFinite(lower) ? lower : 0, max: null };
  }
  const upper = Number(upperRaw);
  if (Number.isNaN(upper) || upper < 0) {
    return { min: lower > 0 ? 1 : 0, max: null };
  }
  return { min: Number.isFinite(lower) ? lower : 0, max: upper };
}

/**
 * Effective interval of a C_ATTRIBUTE: container `cardinality` first,
 * otherwise `existence`. Object occurrences are not used (mouths show
 * attribute constraints only).
 */
export function intervalFromAmAttribute(attr: unknown): CardinalityInterval | undefined {
  if (!attr || typeof attr !== "object") return undefined;
  const rec = attr as {
    cardinality?: { interval?: unknown } | unknown;
    existence?: unknown;
    is_prohibited?: unknown;
  };
  if (rec.is_prohibited === true) return { min: 0, max: 0 };
  if (rec.cardinality) {
    const card = rec.cardinality as { interval?: unknown };
    const interval = card.interval ?? rec.cardinality;
    return intervalFromAmBound(interval);
  }
  if (rec.existence) return intervalFromAmBound(rec.existence);
  return undefined;
}

export function constraintOverlayHelp(
  rm: CardinalityInterval,
  effective: CardinalityInterval,
): string {
  const rmText = formatCardinalityBrackets(rm);
  const effText = formatCardinalityBrackets(effective);
  if (isProhibitedInterval(effective)) {
    return `RM ${rmText} is prohibited (${effText}) by the operational template.`;
  }
  return `RM ${rmText} narrowed to ${effText} by the operational template.`;
}
