/**
 * Compact `[min..max]` labels on Blockly slots, bold when the live count
 * is outside the allowed range. Interval math lives in `core/cardinality.ts`.
 */
import type { Field, Input } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import {
  type CardinalityInterval,
  formatCardinalityBrackets,
  isCardinalityMet as intervalIsMet,
  parseCardinality,
  rmAttributeInterval,
} from "../core/cardinality.ts";

export const SLOT_CARD_FIELD_PREFIX = "SLOT_CARD_";

export type SlotCardinality = CardinalityInterval;

export {
  OVERLAY_DELTA,
  constraintOverlayHelp,
  formatCardinalityCompact,
  intervalsEqual,
  isProhibitedInterval,
  isStrictNarrowing,
  intervalFromAmAttribute,
  intervalFromAmBound,
} from "../core/cardinality.ts";

// deno-lint-ignore no-explicit-any
const FieldLabelBase = Blockly.FieldLabel as any;

export class FieldSlotCardinality extends FieldLabelBase {
  readonly isSlotCardinalityField = true;
  EDITABLE = false;
  SERIALIZABLE = false;
  min = 0;
  max: number | null = 1;
  unmet = false;

  constructor(card: SlotCardinality) {
    super(formatSlotCardinality(card), cssClass(false));
    this.min = card.min;
    this.max = card.max;
  }

  setCardinality(card: SlotCardinality): void {
    this.min = card.min;
    this.max = card.max;
    this.setValue(formatSlotCardinality(card));
    this.syncUnmetClass_();
  }

  setUnmet(unmet: boolean): void {
    if (this.unmet === unmet) return;
    this.unmet = unmet;
    this.syncUnmetClass_();
  }

  private syncUnmetClass_(): void {
    this.setClass?.(cssClass(this.unmet));
  }
}

export function isSlotCardinalityField(
  field: Field | null | undefined,
): field is FieldSlotCardinality {
  return Boolean(field && (field as FieldSlotCardinality).isSlotCardinalityField);
}

export function slotCardinalityFieldName(inputName: string): string {
  return `${SLOT_CARD_FIELD_PREFIX}${inputName}`;
}

/** Always `[n..m]` / `[n..*]`, including `[1..1]` rather than a bare `1`. */
export function formatSlotCardinality(card: SlotCardinality): string {
  return formatCardinalityBrackets(card);
}

export function parseSlotCardinality(raw?: string | null): SlotCardinality | undefined {
  return parseCardinality(raw);
}

export function rmAttributeCardinality(
  rmType: string,
  attrName: string,
): SlotCardinality | undefined {
  return rmAttributeInterval(rmType, attrName);
}

export function isCardinalityMet(count: number, card: SlotCardinality): boolean {
  return intervalIsMet(count, card);
}

/**
 * Last-but-one field on a value/statement input (ZipEHR emoji stays last,
 * against the socket).
 */
export function appendSlotCardinality(
  input: Input,
  card: SlotCardinality | undefined,
): void {
  if (!card) return;
  const name = slotCardinalityFieldName(input.name);
  const existing = input.fieldRow.find((field) => field.name === name);
  if (existing && isSlotCardinalityField(existing)) {
    existing.setCardinality(card);
    return;
  }
  if (existing) {
    existing.setValue(formatSlotCardinality(card));
    return;
  }
  input.appendField(new FieldSlotCardinality(card), name);
}

export function cardinalityFieldOnInput(input: Input | null): FieldSlotCardinality | null {
  if (!input) return null;
  const field = input.fieldRow.find((item) => isSlotCardinalityField(item));
  return field && isSlotCardinalityField(field) ? field : null;
}

function cssClass(unmet: boolean): string {
  return unmet ? "blockly-slot-card blockly-slot-card--unmet" : "blockly-slot-card";
}
