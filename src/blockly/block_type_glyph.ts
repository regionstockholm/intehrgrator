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
  createTypeGlyphField,
  rmTypeConnectionTooltip,
  slotEmojiFieldName,
} from "./rm_type_emoji.ts";
import {
  blockTypeUsesMouthLayout,
  enforceMouthCaptionLayout,
  ensureClassChromeHeader,
  inputAlignLeft,
  inputAlignRight,
} from "./mouth_layout.ts";

export { inputAlignLeft, inputAlignRight };

/** Same mark Blockly FieldCheckbox uses (U+2713). */
export const BOOLEAN_TYPE_GLYPH = "✓";

/** Blockly output / socket check → display glyph. */
const BLOCKLY_TYPE_GLYPH: Record<string, string> = {
  String: "🔤",
  Number: "🔢",
  Boolean: BOOLEAN_TYPE_GLYPH,
  Array: "☰",
  /** Display-only: sheet row/column/data (socket check stays `Array`). */
  Sheet: "⊞",
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

function glyphForSingleCheck(check: string, _forSlot = false): string | undefined {
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

function appendGlyphField(input: Input, check: string | string[] | null, atStart: boolean): void {
  const glyph = glyphForBlocklyCheck(check, false);
  if (!glyph) return;
  const rmField = createRmTypeEmojiField(
    Array.isArray(check) ? (check[0] ?? "") : (check ?? ""),
    false,
  );
  const field = rmField && glyph !== ABSTRACT_SLOT_GLYPH
    ? rmField
    : createTypeGlyphField(glyph, blocklyCheckTooltip(check));
  if (atStart && typeof input.insertFieldAt === "function") {
    input.insertFieldAt(0, field, BLOCK_OUT_EMOJI_FIELD);
    return;
  }
  input.appendField(field, BLOCK_OUT_EMOJI_FIELD);
}

/** Output-tab glyph from a Blockly check string. */
export function appendBlockOutputGlyph(
  header: Input,
  check: string | string[] | null,
): void {
  appendGlyphField(header, check, false);
}

export function prependBlockOutputGlyph(
  input: Input,
  check: string | string[] | null,
): void {
  appendGlyphField(input, check, true);
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
  const field = createTypeGlyphField(glyph, blocklyCheckTooltip(check));
  if (glyph === ABSTRACT_SLOT_GLYPH) {
    field.setClass?.("blockly-rm-emoji blockly-rm-emoji-abstract");
  }
  input.appendField(field, name);
}

/** Puts the output glyph on a LEFT-aligned HEADER (never on a mouth row). */
export function ensureBlockOutputHeaderGlyph(block: Block): void {
  if (!block.outputConnection) return;
  const check = block.outputConnection.getCheck();
  // Drop a glyph that was prepended onto a mouth row (pre-issue-66 stock lists).
  for (const input of [...block.inputList]) {
    if (input.name === "HEADER") continue;
    if (!input.fieldRow.some((field) => field.name === BLOCK_OUT_EMOJI_FIELD)) continue;
    try {
      input.removeField(BLOCK_OUT_EMOJI_FIELD, true);
    } catch {
      // Already removed.
    }
  }
  const header = ensureClassChromeHeader(block);
  if (block.getField(BLOCK_OUT_EMOJI_FIELD)) {
    header.setAlign(inputAlignLeft());
    return;
  }
  appendBlockOutputGlyph(header, check);
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
      if (blockTypeUsesMouthLayout(type)) enforceMouthCaptionLayout(this);
    };
    const originalUpdate = def.updateShape_ as ((this: Block) => void) | undefined;
    if (typeof originalUpdate === "function" && blockTypeUsesMouthLayout(type)) {
      def.updateShape_ = function (this: Block) {
        originalUpdate.call(this);
        ensureBlockOutputHeaderGlyph(this);
        enforceMouthCaptionLayout(this);
      };
    }
    const originalUpdateAt = def.updateAt_ as ((this: Block, hasAt: boolean) => void) | undefined;
    if (typeof originalUpdateAt === "function" && blockTypeUsesMouthLayout(type)) {
      def.updateAt_ = function (this: Block, hasAt: boolean) {
        originalUpdateAt.call(this, hasAt);
        ensureBlockOutputHeaderGlyph(this);
        enforceMouthCaptionLayout(this);
      };
    }
    stockGlyphPatches.add(type);
  }
}
