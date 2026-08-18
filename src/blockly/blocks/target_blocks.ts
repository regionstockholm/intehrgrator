import { Blockly } from "../blockly_core.ts";
import type { Block } from "blockly/core";

const TARGET_STRUCTURE_COLOUR = "#4B5563";
const TARGET_VALUE_COLOUR = "#6B7280";
const TARGET_CHILD_PREFIX = "TARGET_";

export function registerTargetBlocks(): void {
  if (!Blockly.Blocks["target_structure"]) {
    Blockly.Blocks["target_structure"] = {
      init: function (this: Block) {
        this.appendDummyInput("HEADER")
          .appendField(new Blockly.FieldLabel("target"), "NAME")
          .appendField(new Blockly.FieldLabelSerializable(""), "TARGET_TYPE");
        this.getField("TARGET_TYPE")?.setVisible(false);
        this.appendDummyInput()
          .appendField(new Blockly.FieldTextInput(""), "SLOT_ID");
        this.getField("SLOT_ID")?.setVisible(false);
        this.setColour(TARGET_STRUCTURE_COLOUR);
        this.setTooltip("Target structure");
      },
    };
  }

  if (!Blockly.Blocks["target_value"]) {
    Blockly.Blocks["target_value"] = {
      init: function (this: Block) {
        this.appendDummyInput("HEADER")
          .appendField(new Blockly.FieldLabel("value"), "NAME")
          .appendField(new Blockly.FieldLabelSerializable(""), "TARGET_TYPE");
        this.getField("TARGET_TYPE")?.setVisible(false);
        this.appendValueInput("VALUE").setCheck(null).appendField("value");
        this.appendDummyInput()
          .appendField(new Blockly.FieldTextInput(""), "SLOT_ID");
        this.getField("SLOT_ID")?.setVisible(false);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(TARGET_VALUE_COLOUR);
        this.setTooltip("Target value slot");
        this.setInputsInline(true);
      },
    };
  }
}

export function syncTargetChildInputs(
  block: Block,
  childGroups: string[],
): void {
  for (const input of [...block.inputList]) {
    if (input.name.startsWith(TARGET_CHILD_PREFIX)) block.removeInput(input.name);
  }
  for (const group of childGroups) {
    block.appendStatementInput(targetChildInputName(group)).appendField(group);
  }
}

export function targetChildInputName(group: string): string {
  return `${TARGET_CHILD_PREFIX}${group}`;
}
