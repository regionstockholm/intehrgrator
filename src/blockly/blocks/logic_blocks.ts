import { Blockly } from "../blockly_core.ts";
import { FieldDropdownHug } from "../field_dropdown_hug.ts";
import { msg, detectLocale } from "../i18n/locale.ts";

const LOGIC_COLOUR = "#D1C4E9";

export const LOGIC_QUANTIFY_BLOCK = "logic_quantify";
export const LOGIC_CARDINALITY_BLOCK = "logic_cardinality";
export const LOGIC_SET_OPERATION_BLOCK = "logic_set_operation";
export const LOGIC_SET_NOT_BLOCK = "logic_set_not";

export const LOGIC_DL_BLOCK_TYPES = [
  LOGIC_QUANTIFY_BLOCK,
  LOGIC_CARDINALITY_BLOCK,
  LOGIC_SET_OPERATION_BLOCK,
  LOGIC_SET_NOT_BLOCK,
] as const;

const LIST_CHECK = ["Array", "Source"];

/**
 * Description-Logic-inspired Logic blocks for evaluating lists/sets:
 * Manchester `only`/`some`/`none` (∀/∃), `min`/`max`/`exactly` (cardinality),
 * and class operators `and`/`or`/`not` (intersection/union/complement).
 */
export function registerLogicBlocks(): void {
  const m = msg(detectLocale());

  Blockly.Blocks[LOGIC_QUANTIFY_BLOCK] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("LIST")
        .setCheck(LIST_CHECK);
      this.appendDummyInput()
        .appendField(
          new FieldDropdownHug([
            [m.LOGIC_ONLY, "ONLY"],
            [m.LOGIC_SOME, "SOME"],
            [m.LOGIC_NONE, "NONE"],
          ]),
          "OP",
        )
        .appendField(m.LOGIC_AS)
        .appendField(new Blockly.FieldVariable("item"), "VAR");
      this.appendValueInput("PRED")
        .setCheck("Boolean");
      this.setInputsInline(true);
      this.setOutput(true, "Boolean");
      this.setColour(LOGIC_COLOUR);
      this.setTooltip(m.LOGIC_QUANTIFY_TOOLTIP);
      this.setStyle?.("logic_blocks");
    },
  };

  Blockly.Blocks[LOGIC_CARDINALITY_BLOCK] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("LIST")
        .setCheck(LIST_CHECK);
      this.appendValueInput("N")
        .setCheck("Number")
        .appendField(
          new FieldDropdownHug([
            [m.LOGIC_MIN, "MIN"],
            [m.LOGIC_MAX, "MAX"],
            [m.LOGIC_EXACTLY, "EXACTLY"],
          ]),
          "OP",
        );
      this.appendDummyInput()
        .appendField(m.LOGIC_AS)
        .appendField(new Blockly.FieldVariable("item"), "VAR");
      this.appendValueInput("PRED")
        .setCheck("Boolean");
      this.setInputsInline(true);
      this.setOutput(true, "Boolean");
      this.setColour(LOGIC_COLOUR);
      this.setTooltip(m.LOGIC_CARDINALITY_TOOLTIP);
      this.setStyle?.("logic_blocks");
    },
  };

  Blockly.Blocks[LOGIC_SET_OPERATION_BLOCK] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("A")
        .setCheck(LIST_CHECK);
      this.appendValueInput("B")
        .setCheck(LIST_CHECK)
        .appendField(
          new FieldDropdownHug([
            [m.LOGIC_SET_AND, "AND"],
            [m.LOGIC_SET_OR, "OR"],
          ]),
          "OP",
        );
      this.setInputsInline(true);
      this.setOutput(true, "Array");
      this.setColour(LOGIC_COLOUR);
      this.setTooltip(m.LOGIC_SET_OP_TOOLTIP);
      this.setStyle?.("logic_blocks");
    },
  };

  Blockly.Blocks[LOGIC_SET_NOT_BLOCK] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("SET")
        .setCheck(LIST_CHECK)
        .appendField(m.LOGIC_SET_NOT);
      this.appendValueInput("UNIVERSE")
        .setCheck(LIST_CHECK)
        .appendField(m.LOGIC_SET_IN);
      this.setInputsInline(true);
      this.setOutput(true, "Array");
      this.setColour(LOGIC_COLOUR);
      this.setTooltip(m.LOGIC_SET_NOT_TOOLTIP);
      this.setStyle?.("logic_blocks");
    },
  };
}

export function quantifyOpToCall(op: string): "all_of" | "any_of" | "none_of" {
  if (op === "SOME") return "any_of";
  if (op === "NONE") return "none_of";
  return "all_of";
}

export function callToQuantifyOp(name: string): "ONLY" | "SOME" | "NONE" {
  if (name === "any_of") return "SOME";
  if (name === "none_of") return "NONE";
  return "ONLY";
}

export function cardinalityOpToCall(op: string): "at_least" | "at_most" | "exactly" {
  if (op === "MAX") return "at_most";
  if (op === "EXACTLY") return "exactly";
  return "at_least";
}

export function callToCardinalityOp(name: string): "MIN" | "MAX" | "EXACTLY" {
  if (name === "at_most") return "MAX";
  if (name === "exactly") return "EXACTLY";
  return "MIN";
}

export function variableFieldName(block: Blockly.Block, field = "VAR"): string {
  return block.getField(field)?.getText() ?? "item";
}
