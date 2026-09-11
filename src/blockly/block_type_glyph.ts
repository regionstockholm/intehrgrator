/**
 * Blockly-check → type-fit glyphs for non-openEHR blocks.
 * ZipEHR emoji table is preferred for primitives; abstract unions use ⁇.
 *
 * Blockly uses the connection check name `Array` for lists (1-D arrays, possibly
 * of objects). UI copy may say “list”; there is no separate `List` check type.
 * Sheet blocks pass the display-only `Sheet` label for table-shaped values (⊞)
 * while keeping `Array` on the socket for compatibility.
 */
import type { Block, Input } from "blockly/core";
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
  Array: "☰",
  /** Display-only: sheet row/column/data (socket check stays `Array`). */
  Sheet: "⊞",
  Map: "↦",
  Source: "📂",
};

/** Blockly Align.RIGHT — slot captions and glyphs hug mouths. */
export function inputAlignRight(): number {
  return (Blockly.inputs?.Align?.RIGHT ?? Blockly.ALIGN_RIGHT ?? 1) as number;
}

/** Blockly Align.LEFT — block chrome / header row. */
export function inputAlignLeft(): number {
  return (Blockly.inputs?.Align?.LEFT ?? Blockly.ALIGN_LEFT ?? -1) as number;
}

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

/** Update an existing HEADER output glyph after `setOutput` changes the check. */
export function setBlockOutputGlyph(
  block: Block,
  check: string | string[] | null,
): void {
  const field = block.getField(BLOCK_OUT_EMOJI_FIELD) as
    | { setValue?: (v: string) => void; setTooltip?: (t: string) => void }
    | null;
  const glyph = glyphForBlocklyCheck(check, false) ?? "";
  field?.setValue?.(glyph);
  field?.setTooltip?.(blocklyCheckTooltip(check));
}

export function setBlockOutputCheck(block: Block, check: string): void {
  block.setOutput(true, check);
  setBlockOutputGlyph(block, check);
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

/** Prepends a HEADER row with the block output glyph (openEHR-style). */
export function ensureBlockOutputHeaderGlyph(block: Block): void {
  if (!block.outputConnection) return;
  if (block.getInput("HEADER")) return;
  const header = block.appendDummyInput("HEADER").setAlign(inputAlignLeft());
  const first = block.inputList[0];
  if (first && first.name !== "HEADER") {
    block.moveInputBefore("HEADER", first.name);
  }
  appendBlockOutputGlyph(header, block.outputConnection.getCheck());
}

/** Appends socket glyphs as the last field on each value input. */
export function decorateValueInputGlyphs(block: Block): void {
  for (const input of block.inputList) {
    if (input.type !== Blockly.INPUT_VALUE) continue;
    if (input.name === "HEADER") continue;
    input.setAlign(inputAlignRight());
    appendInputTypeGlyph(input, input.connection?.getCheck() ?? null);
  }
}

const STOCK_GLYPH_BLOCK_TYPES = [
  "logic_compare",
  "logic_operation",
  "logic_negate",
  "logic_boolean",
  "logic_ternary",
  "lists_create_with",
  "lists_length",
  "lists_isEmpty",
  "lists_indexOf",
  "lists_getIndex",
  "lists_getSublist",
  "lists_split",
  "lists_sort",
  "lists_reverse",
  "for_each_list",
] as const;

const stockGlyphPatches = new Set<string>();

/** Stock Blockly blocks from `blockly/blocks` — glyphs after labels, sockets right-aligned. */
export function registerStockBlocklyGlyphs(): void {
  for (const type of STOCK_GLYPH_BLOCK_TYPES) {
    if (stockGlyphPatches.has(type)) continue;
    const def = Blockly.Blocks[type];
    if (!def?.init) continue;
    const originalInit = def.init as (this: Block) => void;
    def.init = function (this: Block) {
      originalInit.call(this);
      ensureBlockOutputHeaderGlyph(this);
      decorateValueInputGlyphs(this);
    };
    stockGlyphPatches.add(type);
  }
}
