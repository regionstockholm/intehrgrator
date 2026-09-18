/**
 * Shared Blockly mouth/caption layout: class chrome stays left, slot captions
 * hug their sockets. One routine for RM, XML, schema, lists, maps, and stock
 * blocks so alignment cannot drift per block type.
 */
import type { Block, Input } from "blockly/core";
import { Blockly } from "./blockly_core.ts";

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
 * Keep HEADER left-aligned. Statement C-mouths start just after their caption
 * (stock Blockly LEFT). Value sockets stay RIGHT so captions hug the puzzle tab.
 * Call after init / shape sync so JSON `inputsInline: true` cannot merge
 * HEADER onto a mouth row.
 */
export function enforceMouthCaptionLayout(block: Block): void {
  block.setInputsInline(false);
  const header = block.getInput("HEADER");
  if (header) header.setAlign(inputAlignLeft());
  for (const input of block.inputList) {
    if (input.name === "HEADER") continue;
    if (!input.connection) continue;
    input.setAlign(isStatementInput(input) ? inputAlignLeft() : inputAlignRight());
  }
}

/**
 * Title on the STACK statement row so `[caption][C]` packs like COMPOSITION.content.
 * A separate dummy title row left the C-only STACK row with statementEdge ≈ 0,
 * so snap/highlight sat inside the block instead of on the C bump.
 */
export function initMutatorStackMouth(block: Block, title: string): void {
  const stack = block.appendStatementInput("STACK").setAlign(inputAlignLeft());
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
