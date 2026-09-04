import { Blockly } from "../blockly_core.ts";
import type { BlockSvg } from "blockly/core";
import {
  TERM_PICK_NONE,
  termPickDropdownOptions,
  termSetById,
  termSetDropdownOptions,
  type TermSet,
} from "../../core/openehr_term_catalog.ts";
import { appendBlockOutputEmoji, BLOCK_OUT_EMOJI_FIELD, isRmTypeEmojiField } from "../rm_type_emoji.ts";
import { FieldDropdownHug } from "../field_dropdown_hug.ts";
import { FieldSkeletonTitle, isSkeletonTitleField } from "../field_skeleton_title.ts";

export const TERM_PICK_BLOCK_TYPE = "term_pick";

const TERM_COLOUR = "#4A6FA5";

export function registerTermPickBlock(): void {
  if (Blockly.Blocks[TERM_PICK_BLOCK_TYPE]) return;

  Blockly.Blocks[TERM_PICK_BLOCK_TYPE] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER").setAlign(
        (Blockly.inputs?.Align?.LEFT ?? Blockly.ALIGN_LEFT ?? 0) as number,
      );
      appendBlockOutputEmoji(header, "CODE_PHRASE");
      header
        .appendField(new FieldSkeletonTitle("CODE_PHRASE", "built-in"), "NAME")
        .appendField(
          new FieldDropdownHug(termSetDropdownOptions, function (this: Blockly.FieldDropdown, newSet: string) {
            const block = this.getSourceBlock() as Blockly.Block | null;
            block?.syncTermPick_?.(newSet);
            return newSet;
          }),
          "SET",
        )
        .appendField(
          new FieldDropdownHug(function (this: Blockly.FieldDropdown) {
            const block = this.getSourceBlock();
            const setId = block?.getFieldValue("SET") || "";
            const options = termPickDropdownOptions(setId);
            const current = this.getValue();
            if (current && !options.some((option) => option[1] === current)) {
              options.push([String(current), current]);
            }
            return options;
          }),
          "CODE",
        );

      this.appendDummyInput()
        .appendField(new Blockly.FieldLabelSerializable(""), "SLOT_ID");
      this.getField("SLOT_ID")!.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldLabelSerializable("CODE_PHRASE"), "RM_TYPE");
      this.getField("RM_TYPE")!.setVisible(false);
      if (!this.getField("MANDATORY")) {
        this.appendDummyInput()
          .appendField(new Blockly.FieldLabelSerializable(""), "MANDATORY");
        this.getField("MANDATORY")!.setVisible(false);
      }

      this.setOutput(true, ["CODE_PHRASE", "DV_CODED_TEXT"]);
      this.setColour(TERM_COLOUR);
      this.setTooltip("Pick a built-in openEHR / RM code (CODE_PHRASE)");
      this.setInputsInline(true);
      this.syncTermPick_();
    },
    syncTermPick_: function (this: Blockly.Block, setId?: string) {
      const set = termSetById(setId ?? this.getFieldValue("SET"));
      const rmType = set?.valueRmType ?? "CODE_PHRASE";
      if (this.getField("RM_TYPE")) this.setFieldValue(rmType, "RM_TYPE");
      const title = this.getField("NAME");
      if (isSkeletonTitleField(title)) title.setClassName(rmType);
      const emoji = this.getField(BLOCK_OUT_EMOJI_FIELD);
      if (isRmTypeEmojiField(emoji)) emoji.setRmType(rmType);
      const codeField = this.getField("CODE") as Blockly.FieldDropdown | null;
      const code = this.getFieldValue("CODE");
      const allowed = new Set((set?.codes ?? []).map((item) => item.code));
      if (code && code !== TERM_PICK_NONE && !allowed.has(code)) {
        this.setFieldValue(TERM_PICK_NONE, "CODE");
      }
      codeField?.getOptions?.(false);
      codeField?.forceRerender?.();
      this.getField("SET")?.forceRerender?.();
    },
  };
}

function refreshCodeOptions(block: Blockly.Block): Blockly.FieldDropdown | null {
  const codeField = block.getField("CODE") as Blockly.FieldDropdown | null;
  if (!codeField) return null;
  // Blockly caches generated dropdowns; true = use cache (stale after SET changes).
  codeField.getOptions(false);
  codeField.forceRerender?.();
  return codeField;
}

export function configureTermPick(
  block: Blockly.Block,
  set: TermSet,
  code?: string,
  slotId?: string,
): void {
  if (block.getField("SET")) block.setFieldValue(set.id, "SET");
  block.syncTermPick_?.(set.id);
  refreshCodeOptions(block);
  if (code && set.codes.some((item) => item.code === code)) {
    refreshCodeOptions(block);
    block.setFieldValue(code, "CODE");
    block.getField("CODE")?.forceRerender?.();
  }
  if (slotId && block.getField("SLOT_ID")) block.setFieldValue(slotId, "SLOT_ID");
}

export function createTermPickBlock(
  workspace: Blockly.Workspace,
  set: TermSet,
  code?: string,
  slotId?: string,
): BlockSvg {
  const block = workspace.newBlock(TERM_PICK_BLOCK_TYPE) as BlockSvg;
  configureTermPick(block, set, code, slotId);
  return block;
}

export function isTermPickBlock(block: Blockly.Block | null): boolean {
  return block?.type === TERM_PICK_BLOCK_TYPE;
}

declare module "blockly/core" {
  interface Block {
    syncTermPick_?: (setId?: string) => void;
  }
}
