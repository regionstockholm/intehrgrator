import { Blockly } from "../blockly_core.ts";
import { blocklyCheckForReturnType } from "../block_checks.ts";
import { msg, detectLocale } from "../i18n/locale.ts";
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
        // Serializable zero-size label: older workspaces stored RETURN_TYPE here.
        // A FieldTextInput would draw a second "string" box beside the path.
        row.appendField(hiddenSerializableField(returnType), "RETURN_TYPE");
      }
      this.setOutput(true, blocklyCheckForReturnType(returnType));
      this.setColour(SOURCE_COLOUR);
      this.setTooltip(`${returnType}: ${tooltip}`);
      this.setStyle?.("colour_blocks");
      this.setInputsInline(true);
    },
  };
}

/** Label that serializes but never occupies Blockly layout or draws a field rect. */
function hiddenSerializableField(value: string) {
  const field = new Blockly.FieldLabelSerializable(value);
  field.EDITABLE = false;
  field.SERIALIZABLE = true;
  field.initView = () => {};
  const sized = field as unknown as { size_?: { width: number; height: number } };
  if (sized.size_) {
    sized.size_.width = 0;
    sized.size_.height = 0;
  }
  return field;
}
