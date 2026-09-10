/**
 * Blockly-check → type-fit glyphs for non-openEHR blocks.
 * ZipEHR emoji table is preferred for primitives; abstract unions use ⁇.
 */
import type { Input } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import { zipehrEmojiForRmType } from "../core/rm_emoji.ts";
import {
  ABSTRACT_SLOT_GLYPH,
  BLOCK_OUT_EMOJI_FIELD,
  createRmTypeEmojiField,
  rmTypeConnectionTooltip,
  slotEmojiFieldName,
} from "./rm_type_emoji.ts";

/** Blockly output / socket check → display glyph. */
const BLOCKLY_TYPE_GLYPH: Record<string, string> = {
  String: "🔤",
  Number: "🔢",
  Boolean: "✓",
  Array: "📋",
  Map: "↦",
  Source: "📂",
};

export function glyphForBlocklyCheck(
  check: string | string[] | null | undefined,
  forSlot = false,
): string | undefined {
  if (!check) return undefined;
  if (Array.isArray(check)) {
    if (check.length === 1) return glyphForBlocklyCheck(check[0], forSlot);
    const concrete = check.map((t) => glyphForSingleCheck(t)).filter(Boolean);
    const unique = [...new Set(concrete)];
    if (unique.length === 1) return unique[0];
    return ABSTRACT_SLOT_GLYPH;
  }
  return glyphForSingleCheck(check, forSlot);
}

function glyphForSingleCheck(check: string, forSlot = false): string | undefined {
  const zipehr = zipehrEmojiForRmType(check);
  if (zipehr) return zipehr;
  if (BLOCKLY_TYPE_GLYPH[check]) return BLOCKLY_TYPE_GLYPH[check];
  if (check === "DATA_VALUE") return ABSTRACT_SLOT_GLYPH;
  return undefined;
}

export function blocklyCheckTooltip(
  check: string | string[] | null | undefined,
): string {
  if (!check) return "any type";
  if (Array.isArray(check)) {
    if (check.length === 1) return blocklyCheckTooltip(check[0]);
    return ["Allowed:", ...check.map((t) => `${glyphForSingleCheck(t) ?? ABSTRACT_SLOT_GLYPH} ${t}`)].join("\n");
  }
  const rmTip = rmTypeConnectionTooltip(check);
  if (rmTip !== check) return rmTip;
  const glyph = glyphForSingleCheck(check);
  return glyph ? `${glyph} ${check}` : check;
}

/** Output-tab glyph from a Blockly check string. */
export function appendBlockOutputGlyph(
  header: Input,
  check: string | string[] | null,
): void {
  const glyph = glyphForBlocklyCheck(check, false);
  if (!glyph) return;
  const rmField = createRmTypeEmojiField(
    Array.isArray(check) ? (check[0] ?? "") : (check ?? ""),
    false,
  );
  if (rmField && glyph !== ABSTRACT_SLOT_GLYPH) {
    header.appendField(rmField, BLOCK_OUT_EMOJI_FIELD);
    return;
  }
  header.appendField(
    new Blockly.FieldLabel(glyph, "blockly-rm-emoji"),
    BLOCK_OUT_EMOJI_FIELD,
  );
}

/** Socket glyph appended to an input row. */
export function appendInputTypeGlyph(
  input: Input,
  check: string | string[] | null,
): void {
  const glyph = glyphForBlocklyCheck(check, true);
  if (!glyph) return;
  const name = slotEmojiFieldName(input.name);
  const existing = input.fieldRow.find((f) => f.name === name);
  if (existing) {
    existing.setValue(glyph);
    existing.setTooltip(blocklyCheckTooltip(check));
    return;
  }
  const field = new Blockly.FieldLabel(glyph, glyph === ABSTRACT_SLOT_GLYPH ? "blockly-rm-emoji blockly-rm-emoji-abstract" : "blockly-rm-emoji");
  field.setTooltip(blocklyCheckTooltip(check));
  input.appendField(field, name);
}
