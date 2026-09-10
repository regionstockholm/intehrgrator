/**
 * Type-fit glyphs and a header mutator cog on every Blockly block.
 *
 * openEHR blocks already draw ZipEHR glyphs and a header cog. This wraps
 * remaining `init` (and `updateShape_`) so Logic / Lists & maps / Sheets /
 * schema / stock blocks show the same chrome (#52).
 */
import type { BlockSvg } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import {
  appendMutatorCogwheel,
  hideDefaultMutatorIcon,
} from "./dynamic_mutator.ts";
import {
  BLOCK_OUT_EMOJI_FIELD,
  createCheckTypeEmojiField,
  slotEmojiFieldName,
} from "./rm_type_emoji.ts";
import { isSlotLabelField } from "./slot_label.ts";

const VALUE_INPUT = Blockly.inputs?.inputTypes?.VALUE ?? 1;
const STATEMENT_INPUT = Blockly.inputs?.inputTypes?.STATEMENT ?? 3;

const SKIP_BLOCK_TYPES = new Set<string>([
  "lists_create_with_item",
  "lists_create_with_container",
  "text_join_container",
  "text_join_item",
  "procedures_mutatorcontainer",
  "procedures_mutatorarg",
  "controls_if_if",
  "controls_if_elseif",
  "controls_if_else",
  "maps_create_with_item",
  "maps_create_with_container",
  "optional_rm_mutator_container",
  "optional_rm_mutator_item",
  "dv_fields_mutator_item",
  "schema_fields_mutator_container",
  "schema_fields_mutator_item",
]);

const wrappedDefs = new WeakSet<object>();

type BlockDef = {
  init?: (this: Blockly.Block, ...args: unknown[]) => void;
  updateShape_?: (this: Blockly.Block, ...args: unknown[]) => void;
  onchange?: (this: Blockly.Block, event: unknown) => void;
};

export function installTypeFitGlyphs(): void {
  for (const type of Object.keys(Blockly.Blocks)) {
    wrapBlockTypeInit(type);
  }
}

export function wrapBlockTypeInit(type: string): void {
  if (SKIP_BLOCK_TYPES.has(type)) return;
  const def = Blockly.Blocks[type] as BlockDef | undefined;
  if (!def?.init || wrappedDefs.has(def)) return;
  wrappedDefs.add(def);
  const origInit = def.init;
  def.init = function (this: Blockly.Block, ...args: unknown[]) {
    origInit.apply(this, args);
    applyTypeFitChrome(this);
  };
  if (typeof def.updateShape_ === "function") {
    const origUpdate = def.updateShape_;
    def.updateShape_ = function (this: Blockly.Block, ...args: unknown[]) {
      origUpdate.apply(this, args);
      applyTypeFitChrome(this);
    };
  }
}

export function applyTypeFitChrome(block: Blockly.Block): void {
  if (SKIP_BLOCK_TYPES.has(block.type)) return;
  if (typeof block.isShadow === "function" && block.isShadow()) return;
  unifyMutatorCog(block);
  applyOutputGlyph(block);
  applySlotGlyphs(block);
}

function applyOutputGlyph(block: Blockly.Block): void {
  if (!block.outputConnection) return;
  if (block.getField(BLOCK_OUT_EMOJI_FIELD)) return;
  const header = block.getInput("HEADER") ?? block.inputList[0];
  if (!header) return;
  const check = connectionCheck(block.outputConnection);
  const field = createCheckTypeEmojiField(check, false);
  if (!field) return;
  header.insertFieldAt(0, field, BLOCK_OUT_EMOJI_FIELD);
}

function applySlotGlyphs(block: Blockly.Block): void {
  for (const input of block.inputList) {
    if (input.type !== VALUE_INPUT && input.type !== STATEMENT_INPUT) continue;
    if (input.fieldRow.some((field) => isSlotLabelField(field))) continue;
    const name = slotEmojiFieldName(input.name);
    if (input.fieldRow.some((field) => field.name === name)) continue;
    const check = connectionCheck(input.connection);
    const field = createCheckTypeEmojiField(check, true);
    if (!field) continue;
    input.appendField(field, name);
  }
}

function connectionCheck(
  connection: { getCheck?: () => string | string[] | null } | null | undefined,
): string | string[] | null {
  return connection?.getCheck?.() ?? null;
}

function unifyMutatorCog(block: Blockly.Block): void {
  if (!hasMutatorIcon(block)) return;
  if (block.getField("MUTATOR_COG")) {
    hideDefaultMutatorIcon(block);
    return;
  }
  const header = block.getInput("HEADER") ?? labeledInput(block) ?? block.inputList[0];
  if (!header) return;
  appendMutatorCogwheel(header);
  hideDefaultMutatorIcon(block);
}

function labeledInput(block: Blockly.Block) {
  return block.inputList.find((input) =>
    input.fieldRow.some((field) =>
      field.name !== BLOCK_OUT_EMOJI_FIELD && field.name !== "MUTATOR_COG"
    )
  );
}

function hasMutatorIcon(block: Blockly.Block): boolean {
  const svg = block as BlockSvg;
  const type = Blockly.icons?.MutatorIcon?.TYPE;
  if (type && typeof svg.getIcon === "function" && svg.getIcon(type)) return true;
  if ((block as Blockly.Block & { mutator?: unknown }).mutator) return true;
  return typeof (block as Blockly.Block & { compose?: unknown }).compose === "function";
}
