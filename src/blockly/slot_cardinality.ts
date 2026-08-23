/**
 * Compact `[min..max]` labels on Blockly slots, bold when the live count
 * is outside the allowed range.
 */
import type { Field, Input } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import { attributesFor } from "../core/rm_meta.ts";

export const SLOT_CARD_FIELD_PREFIX = "SLOT_CARD_";

export interface SlotCardinality {
  min: number;
  max: number | null;
}

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
  const upper = card.max == null ? "*" : String(card.max);
  return `[${card.min}..${upper}]`;
}

export function parseSlotCardinality(raw?: string | null): SlotCardinality | undefined {
  if (!raw) return undefined;
  const text = raw.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (text === "1") return { min: 1, max: 1 };
  const star = /^(\d+)\.\.\*$/.exec(text);
  if (star) return { min: Number(star[1]), max: null };
  const range = /^(\d+)\.\.(\d+)$/.exec(text);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  return undefined;
}

export function rmAttributeCardinality(
  rmType: string,
  attrName: string,
): SlotCardinality | undefined {
  const meta = attributesFor(rmType).find((a) => a.name === attrName);
  if (!meta?.multiplicity) return undefined;
  return {
    min: Number(meta.multiplicity.min ?? 0),
    max: meta.multiplicity.max == null ? null : Number(meta.multiplicity.max),
  };
}

export function isCardinalityMet(count: number, card: SlotCardinality): boolean {
  if (count < card.min) return false;
  if (card.max != null && count > card.max) return false;
  return true;
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
