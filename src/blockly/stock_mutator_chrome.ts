/**
 * Header cogwheel mutator chrome for stock Blockly blocks (issue #150).
 */
import type { Block, BlockSvg } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import {
  appendMutatorCogwheel,
  hideDefaultMutatorIcon,
  openBlockMutator,
} from "./dynamic_mutator.ts";

const PATCHED = new Set<string>();

const STOCK_MUTATOR_BLOCKS = [
  "text_join",
  "lists_create_with",
] as const;

export function registerStockMutatorChrome(): void {
  for (const type of STOCK_MUTATOR_BLOCKS) {
    if (PATCHED.has(type)) continue;
    const def = Blockly.Blocks[type];
    if (!def?.init) continue;
    const originalInit = def.init as (this: Block) => void;
    def.init = function (this: Block) {
      originalInit.call(this);
      if (this.getField("MUTATOR_COG")) return;
      const dummyType = Blockly.inputs?.inputTypes?.DUMMY ?? Blockly.DUMMY_INPUT ?? 5;
      const host = this.inputList.find((input) => input.type === dummyType) ??
        this.inputList[0];
      if (!host) return;
      appendMutatorCogwheel(host);
      hideDefaultMutatorIcon(this);
      const cog = this.getField("MUTATOR_COG") as Blockly.FieldImage | null;
      if (cog) {
        const prev = cog.onClick;
        cog.onClick = function (this: Blockly.FieldImage) {
          openBlockMutator(this.getSourceBlock() as Block);
          prev?.call(this);
        };
      }
    };
    PATCHED.add(type);
  }
}
