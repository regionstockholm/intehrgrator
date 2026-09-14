/**
 * Shared Blockly mouth layout: class chrome stays left; every connected
 * input hugs its socket (Align.RIGHT, not inline).
 *
 * RM, XML, schema, Maps, and stock list constructors all call this so slot
 * captions do not drift depending on which block factory built the row.
 */
import type { Block } from "blockly/core";
import { Blockly } from "./blockly_core.ts";

/** Blockly Align.LEFT — header chrome (emoji / title / cog). */
export function inputAlignLeft(): number {
  return (Blockly.inputs?.Align?.LEFT ?? Blockly.ALIGN_LEFT ?? -1) as number;
}

/** Blockly Align.RIGHT — slot captions sit just left of their mouth / socket. */
export function inputAlignRight(): number {
  return (Blockly.inputs?.Align?.RIGHT ?? Blockly.ALIGN_RIGHT ?? 1) as number;
}

/**
 * Keep HEADER on its own left-aligned top row; every connected input hugs
 * its socket. Call after init / mutator shape sync so saved
 * `inputsInline: true` cannot merge chrome onto a value row.
 */
export function enforceMouthLayout(block: Block): void {
  block.setInputsInline(false);
  const header = block.getInput("HEADER");
  if (header) header.setAlign(inputAlignLeft());
  for (const input of block.inputList) {
    if (input.name === "HEADER") continue;
    if (input.connection) input.setAlign(inputAlignRight());
  }
}

/** Stock list constructors whose captions should hug mouths like RM slots. */
export function blockTypeUsesMouthLayout(type: string): boolean {
  return type.startsWith("lists_") || type === "for_each_list" || type === "for_each_source";
}
