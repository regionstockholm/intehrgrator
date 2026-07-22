import { Blockly } from "../blockly_core.ts";
import { msg, detectLocale } from "../i18n/locale.ts";

const LOOP_COLOUR = "#A5D6A7";
const SOURCE_COLOUR = "#E87722";

/**
 * intEHRgrator-specific expression/control blocks.
 * Stock Logic/Loops/Math/Text/Lists/Variables come from `blockly/blocks`.
 */
export function registerExpressionBlocks(): void {
  const m = msg(detectLocale());

  Blockly.Blocks["source_query"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField(m.SOURCE_QUERY)
        .appendField(new Blockly.FieldTextInput("/path"), "EXPRESSION");
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput("string"), "RETURN_TYPE")
        .setVisible(false);
      this.setOutput(true, "String");
      this.setColour(SOURCE_COLOUR);
      this.setTooltip(m.SOURCE_QUERY_TOOLTIP);
      this.setStyle?.("colour_blocks");
    },
  };

  /**
   * Loop over nodes from a multi-valued source path.
   * Complements Blockly's controls_forEach for openEHR mapping.
   */
  Blockly.Blocks["for_each_source"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField(m.FOR_EACH_SOURCE_PREFIX)
        .appendField(new Blockly.FieldTextInput("item"), "VAR")
        .appendField(m.FOR_EACH_SOURCE_IN);
      this.appendDummyInput()
        .appendField(m.FOR_EACH_SOURCE_NODES)
        .appendField(new Blockly.FieldTextInput("/path/to/items"), "PATH");
      this.appendStatementInput("DO")
        .appendField(m.FOR_EACH_SOURCE_DO);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(LOOP_COLOUR);
      this.setTooltip(m.FOR_EACH_SOURCE_TOOLTIP);
      this.setStyle?.("loop_blocks");
      this.setInputsInline(false);
    },
  };
}
