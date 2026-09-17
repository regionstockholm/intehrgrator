import { Blockly } from "../blockly_core.ts";
import { blocklyCheckForReturnType } from "../block_checks.ts";
import { appendInputTypeGlyph, blocklyCheckTooltip } from "../block_type_glyph.ts";
import { createHiddenSerializableField } from "../hidden_serializable_field.ts";
import { msg, detectLocale } from "../i18n/locale.ts";
import { FOR_EACH_LIST_BLOCK, LOOP_LIST_CHECK } from "../loop_block.ts";
import { enforceMouthCaptionLayout, inputAlignRight } from "../mouth_layout.ts";
import { slotEmojiFieldName } from "../rm_type_emoji.ts";
import {
  type SourceReturnType,
  sourceBlockTypeForReturnType,
  sourceQueryFieldLabel,
} from "../source_query.ts";

const LOOP_COLOUR = "#A5D6A7";
const SOURCE_COLOUR = "#E87722";

/**
 * intEHRgrator-specific expression/control blocks.
 * Stock Logic/Loops/Math/Text/Lists/Variables come from `blockly/blocks`.
 */
export function registerExpressionBlocks(): void {
  const m = msg(detectLocale());

  defineSourceQueryBlock("string", m.SOURCE_QUERY, m.SOURCE_QUERY_TOOLTIP);
  defineSourceQueryBlock("number", m.SOURCE_QUERY, m.SOURCE_QUERY_TOOLTIP);
  defineSourceQueryBlock("boolean", m.SOURCE_QUERY, m.SOURCE_QUERY_TOOLTIP);
  defineSourceQueryBlock("node", m.SOURCE_QUERY, m.SOURCE_NODE_TOOLTIP);

  /**
   * Bounded iteration over a list or iterable source nodes.
   * Source-node grain: plug `source_query_node` into LIST (replaces retired
   * `for_each_source`). Not stock `controls_forEach` (no break/continue).
   */
  Blockly.Blocks[FOR_EACH_LIST_BLOCK] = {
    init: function (this: Blockly.Block) {
      const inField = new Blockly.FieldLabel(m.FOR_EACH_SOURCE_IN);
      inField.setTooltip(m.FOR_EACH_IN_TOOLTIP);
      const list = this.appendValueInput("LIST")
        .setCheck([...LOOP_LIST_CHECK])
        .setAlign(inputAlignRight())
        .appendField(m.FOR_EACH_SOURCE_PREFIX)
        .appendField(new Blockly.FieldTextInput("item"), "VAR")
        .appendField(inField);
      appendInputTypeGlyph(list, LOOP_LIST_CHECK);
      this.getField(slotEmojiFieldName("LIST"))?.setTooltip(
        `${m.FOR_EACH_IN_TOOLTIP}\n\n${blocklyCheckTooltip(LOOP_LIST_CHECK)}`,
      );
      this.appendStatementInput("DO")
        .appendField(m.FOR_EACH_SOURCE_DO);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(LOOP_COLOUR);
      this.setTooltip(m.FOR_EACH_LIST_TOOLTIP);
      this.setStyle?.("loop_blocks");
      enforceMouthCaptionLayout(this);
    },
  };
}

function defineSourceQueryBlock(
  returnType: SourceReturnType,
  label: string,
  tooltip: string,
): void {
  const type = sourceBlockTypeForReturnType(returnType);
  Blockly.Blocks[type] = {
    init: function (this: Blockly.Block) {
      const row = this.appendDummyInput()
        .appendField(sourceQueryFieldLabel(returnType, label))
        .appendField(new Blockly.FieldTextInput("/path"), "EXPRESSION");
      if (type === "source_query") {
        // Hidden serializable field so source_query does not draw a second type box.
        row.appendField(createHiddenSerializableField(returnType), "RETURN_TYPE");
      }
      this.setOutput(true, blocklyCheckForReturnType(returnType));
      this.setColour(SOURCE_COLOUR);
      this.setTooltip(`${returnType}: ${tooltip}`);
      this.setStyle?.("colour_blocks");
      this.setInputsInline(true);
    },
  };
}
