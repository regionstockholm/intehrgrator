/**
 * Loop-scoped value blocks for `for_each_list` (issue #150).
 */
import type { Block } from "blockly/core";
import { Blockly } from "../blockly_core.ts";
import { appendBlockOutputGlyph } from "../block_type_glyph.ts";
import { msg, detectLocale } from "../i18n/locale.ts";
import { FOR_EACH_LIST_BLOCK } from "../loop_block.ts";
import { currentItemName, LOGIC_CURRENT_ITEM_BLOCK } from "./logic_blocks.ts";

export const LOOP_INDEX_BLOCK = "loop_index";
export const LOOP_LENGTH_BLOCK = "loop_length";

const LOOP_COLOUR = "#A5D6A7";

/** Blocks that resolve against the nearest enclosing `for_each_list`. */
export const LOOP_ACCESSOR_BLOCK_TYPES = [
  LOGIC_CURRENT_ITEM_BLOCK,
  LOOP_INDEX_BLOCK,
  LOOP_LENGTH_BLOCK,
] as const;

/** Nearest enclosing `for_each_list` block, if any. */
export function enclosingForEachList(block: Block | null): Block | null {
  let current = block;
  while (current) {
    if (current.type === FOR_EACH_LIST_BLOCK) return current;
    current = current.getParent();
  }
  return null;
}

export function registerLoopAccessorBlocks(): void {
  const m = msg(detectLocale());

  Blockly.Blocks[LOOP_INDEX_BLOCK] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER");
      appendBlockOutputGlyph(header, "Number");
      header.appendField(m.LOOP_INDEX);
      this.setOutput(true, "Number");
      this.setColour(LOOP_COLOUR);
      this.setTooltip(m.LOOP_INDEX_TOOLTIP);
      this.setStyle?.("loop_blocks");
    },
  };

  Blockly.Blocks[LOOP_LENGTH_BLOCK] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER");
      appendBlockOutputGlyph(header, "Number");
      header.appendField(m.LOOP_LENGTH);
      this.setOutput(true, "Number");
      this.setColour(LOOP_COLOUR);
      this.setTooltip(m.LOOP_LENGTH_TOOLTIP);
      this.setStyle?.("loop_blocks");
    },
  };

  // Restyle "this item" to match the loop family when shown beside for_each.
  const current = Blockly.Blocks[LOGIC_CURRENT_ITEM_BLOCK];
  if (current?.init) {
    const originalInit = current.init as (this: Blockly.Block) => void;
    current.init = function (this: Blockly.Block) {
      originalInit.call(this);
      this.setColour(LOOP_COLOUR);
      this.setStyle?.("loop_blocks");
    };
  }
}

export function loopItemVarName(block: Block): string {
  const loop = enclosingForEachList(block);
  if (!loop) return currentItemName(block);
  return String(loop.getFieldValue("VAR") || "item");
}
