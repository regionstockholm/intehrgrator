/**
 * Shared Blockly mouth/caption layout: class chrome stays left, slot captions
 * hug their sockets. One routine for RM, XML, schema, lists, maps, and stock
 * blocks so alignment cannot drift per block type.
 */
import type { Block, Input } from "blockly/core";
import { Blockly } from "./blockly_core.ts";

/** Header field that opens the mutator bubble (replaces Blockly's top-left icon). */
export const MUTATOR_COG_FIELD = "MUTATOR_COG";

/** Output-type glyph field name (must match `BLOCK_OUT_EMOJI_FIELD` in rm_type_emoji). */
const OUTPUT_GLYPH_FIELD = "RM_OUT_EMOJI";

/** Fields that belong on the far right of the class-chrome row. */
export function isTrailingChromeFieldName(name: string | null | undefined): boolean {
  return name === MUTATOR_COG_FIELD || name === OUTPUT_GLYPH_FIELD;
}

/** Blockly Align.LEFT — header chrome hugs the left edge. */
export function inputAlignLeft(): number {
  return (Blockly.inputs?.Align?.LEFT ?? Blockly.ALIGN_LEFT ?? -1) as number;
}

/** Blockly Align.RIGHT — captions sit just left of their mouth / socket. */
export function inputAlignRight(): number {
  return (Blockly.inputs?.Align?.RIGHT ?? Blockly.ALIGN_RIGHT ?? 1) as number;
}

/** Blockly `inputTypes.STATEMENT` (value sockets stay RIGHT-packed). */
export function isStatementInput(input: Input): boolean {
  const statement = Blockly.inputs?.inputTypes?.STATEMENT ?? 3;
  return input.type === statement;
}

/**
 * Keep HEADER left-aligned. Slot captions (statement C and value sockets)
 * hug their mouths (RIGHT). Call after init / shape sync so JSON
 * `inputsInline: true` cannot merge HEADER onto a mouth row.
 */
export function enforceMouthCaptionLayout(block: Block): void {
  block.setInputsInline(false);
  const header = block.getInput("HEADER");
  if (header) header.setAlign(inputAlignLeft());
  for (const input of block.inputList) {
    if (input.name === "HEADER") continue;
    if (!input.connection) continue;
    input.setAlign(inputAlignRight());
  }
}

/**
 * Title on the STACK statement row so `[caption][C]` packs like COMPOSITION.content.
 * A separate dummy title row left the C-only STACK row with statementEdge ≈ 0,
 * so snap/highlight sat inside the block instead of on the C bump.
 */
export function initMutatorStackMouth(block: Block, title: string): void {
  const stack = block.appendStatementInput("STACK").setAlign(inputAlignRight());
  stack.appendField(title);
  enforceMouthCaptionLayout(block);
}

/**
 * Ensure a LEFT-aligned dummy `HEADER` exists as the first input and is ready
 * for class chrome (output glyph / title). Pulls an existing HEADER to the top
 * when it was appended later. Shared so lists/maps/logic cannot drift from RM.
 */
export function ensureClassChromeHeader(block: Block): Input {
  let header = block.getInput("HEADER");
  if (!header) {
    header = block.appendDummyInput("HEADER");
  }
  header.setAlign(inputAlignLeft());
  const first = block.inputList[0];
  if (first && first.name !== "HEADER") {
    try {
      block.moveInputBefore("HEADER", first.name);
    } catch {
      // Some Blockly stubs lack moveInputBefore; HEADER still left-aligned.
    }
  }
  return header;
}

/** Stock list constructors whose captions should hug mouths like RM slots. */
export function blockTypeUsesMouthLayout(type: string): boolean {
  return type.startsWith("lists_") || type === "for_each_list" || type === "text_join";
}

/**
 * Dummy row that carries title + trailing cog/type-glyph. HEADER when present;
 * otherwise the NAME dummy (stock Functions).
 */
export function chromeHostInput(block: Block): Input | undefined {
  const header = block.getInput("HEADER");
  if (header) return header;
  const named = block.inputList.find((input) =>
    !input.connection && input.fieldRow.some((field) => field.name === "NAME")
  );
  if (named) return named;
  return block.inputList.find((input) => !input.connection && input.fieldRow.length > 0);
}

/**
 * Put MUTATOR_COG then the output type glyph at the end of the chrome row so
 * the compact renderer can pack leftover width in front of them (far right).
 */
export function orderHeaderTrailingChrome(block: Block): void {
  const host = chromeHostInput(block);
  if (!host) return;
  const trailing: Array<{ field: (typeof host.fieldRow)[number]; name: string }> = [];
  for (const name of [MUTATOR_COG_FIELD, OUTPUT_GLYPH_FIELD]) {
    const field = host.fieldRow.find((item) => item.name === name);
    if (field) trailing.push({ field, name });
  }
  if (!trailing.length) return;
  for (const { name } of trailing) {
    try {
      host.removeField(name);
    } catch {
      // Already detached.
    }
  }
  for (const { field, name } of trailing) {
    host.appendField(field, name);
  }
}
