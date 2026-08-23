import { Blockly } from "../blockly_core.ts";
import type { Block } from "blockly/core";

const TARGET_STRUCTURE_COLOUR = "#4B5563";
const TARGET_VALUE_COLOUR = "#6B7280";
const JSON_COLOUR = "#D97706";
const XML_COLOUR = "#0284C7";
const TARGET_CHILD_PREFIX = "TARGET_";

export const JSON_BLOCK_TYPES = ["json_object", "json_array", "json_value"] as const;
export const XML_BLOCK_TYPES = ["xml_element", "xml_text"] as const;
export const GENERIC_VALUE_BLOCK_TYPES = [
  "target_value",
  "json_value",
  "xml_text",
] as const;

export function registerTargetBlocks(): void {
  defineStructureBlock("target_structure", "target", TARGET_STRUCTURE_COLOUR, "Target structure");
  defineValueBlock("target_value", "value", TARGET_VALUE_COLOUR, "Target value slot");

  defineStructureBlock("json_object", "JSON object", JSON_COLOUR, "Generic JSON object");
  defineStructureBlock("json_array", "JSON array", JSON_COLOUR, "Generic JSON array");
  defineValueBlock("json_value", "JSON value", JSON_COLOUR, "Generic JSON value");

  defineStructureBlock("xml_element", "XML element", XML_COLOUR, "Generic XML element");
  defineValueBlock("xml_text", "XML text", XML_COLOUR, "Generic XML text node");
}

export function isGenericValueBlockType(type: string): boolean {
  return (GENERIC_VALUE_BLOCK_TYPES as readonly string[]).includes(type);
}

function defineStructureBlock(
  type: string,
  defaultName: string,
  colour: string,
  tooltip: string,
): void {
  if (Blockly.Blocks[type]) return;
  Blockly.Blocks[type] = {
    init: function (this: Block) {
      this.appendDummyInput("HEADER")
        .appendField(new Blockly.FieldLabel(defaultName), "NAME")
        .appendField(new Blockly.FieldLabelSerializable(""), "TARGET_TYPE");
      this.getField("TARGET_TYPE")?.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "SLOT_ID");
      this.getField("SLOT_ID")?.setVisible(false);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(colour);
      this.setTooltip(tooltip);
    },
  };
}

function defineValueBlock(
  type: string,
  defaultName: string,
  colour: string,
  tooltip: string,
): void {
  if (Blockly.Blocks[type]) return;
  Blockly.Blocks[type] = {
    init: function (this: Block) {
      this.appendDummyInput("HEADER")
        .appendField(new Blockly.FieldLabel(defaultName), "NAME")
        .appendField(new Blockly.FieldLabelSerializable(""), "TARGET_TYPE");
      this.getField("TARGET_TYPE")?.setVisible(false);
      this.appendValueInput("VALUE").setCheck(null).appendField("value");
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "SLOT_ID");
      this.getField("SLOT_ID")?.setVisible(false);
      appendHiddenTargetMandatory(this);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(colour);
      this.setTooltip(tooltip);
      this.setInputsInline(true);
    },
  };
}

function appendHiddenTargetMandatory(block: Block): void {
  if (block.getField("MANDATORY")) return;
  block.appendDummyInput()
    .appendField(new Blockly.FieldLabelSerializable(""), "MANDATORY");
  block.getField("MANDATORY")?.setVisible(false);
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
