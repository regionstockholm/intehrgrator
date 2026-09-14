/**
 * Shared Blockly mouth/caption layout: class chrome stays left, slot captions
 * hug their sockets. One routine for RM, XML, schema, lists, maps, and stock
 * blocks so alignment cannot drift per block type.
 */
import type { Block } from "blockly/core";
import { Blockly } from "./blockly_core.ts";

/** Blockly Align.LEFT — header chrome hugs the left edge. */
export function inputAlignLeft(): number {
  return (Blockly.inputs?.Align?.LEFT ?? Blockly.ALIGN_LEFT ?? -1) as number;
}

/** Blockly Align.RIGHT — captions sit just left of their mouth / socket. */
export function inputAlignRight(): number {
  return (Blockly.inputs?.Align?.RIGHT ?? Blockly.ALIGN_RIGHT ?? 1) as number;
}

/**
 * Keep HEADER left-aligned; every connected input hugs its mouth.
 * Call after init / shape sync so JSON `inputsInline: true` cannot merge
 * HEADER onto a right-aligned value row.
 */
export function enforceMouthCaptionLayout(block: Block): void {
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
