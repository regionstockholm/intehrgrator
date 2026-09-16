import { Blockly } from "../blockly_core.ts";
import { blocklyCheckForReturnType } from "../block_checks.ts";
import { createHiddenSerializableField } from "../hidden_serializable_field.ts";
import { msg, detectLocale } from "../i18n/locale.ts";
import { enforceMouthCaptionLayout } from "../mouth_layout.ts";
import {
  type SourceReturnType,
  sourceBlockTypeForReturnType,
  sourceQueryFieldLabel,
} from "../source_query.ts";
import { MAPPING_CONTROL_TYPES } from "../../core/xml_shape.ts";

const LOOP_COLOUR = "#A5D6A7";
const SOURCE_COLOUR = "#E87722";

/** Previous/next check so loops nest in XML/schema mouths and the Product stack, not every C. */
const LOOP_STACK_CHECK = [...MAPPING_CONTROL_TYPES, "INSTANCE_ROOT"];

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
  restrictStockControlsIfStack();

  /**
   * Loop over nodes from a multi-valued source path.
   * Complements `for_each_list` (computed list values) for openEHR mapping.
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
      this.setPreviousStatement(true, LOOP_STACK_CHECK);
      this.setNextStatement(true);
      this.setColour(LOOP_COLOUR);
      this.setTooltip(m.FOR_EACH_SOURCE_TOOLTIP);
      this.setStyle?.("loop_blocks");
      enforceMouthCaptionLayout(this);
    },
  };

  /**
   * Bounded iteration over a list / map-keys / sheet-rows value.
   * Not stock `controls_forEach` (no break/continue; grain is the list item).
   */
  Blockly.Blocks["for_each_list"] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("LIST")
        .appendField(m.FOR_EACH_SOURCE_PREFIX)
        .appendField(new Blockly.FieldTextInput("item"), "VAR")
        .appendField(m.FOR_EACH_SOURCE_IN);
      this.appendStatementInput("DO")
        .appendField(m.FOR_EACH_SOURCE_DO);
      this.setPreviousStatement(true, LOOP_STACK_CHECK);
      this.setNextStatement(true);
      this.setColour(LOOP_COLOUR);
      this.setTooltip(m.FOR_EACH_LIST_TOOLTIP);
      this.setStyle?.("loop_blocks");
      enforceMouthCaptionLayout(this);
    },
  };
}

function restrictStockControlsIfStack(): void {
  const def = Blockly.Blocks["controls_if"] as { init?: (this: Blockly.Block) => void } | undefined;
  if (!def?.init || (def.init as { mappingControlCheck_?: boolean }).mappingControlCheck_) {
    return;
  }
  const orig = def.init;
  const wrapped = function (this: Blockly.Block) {
    orig.call(this);
    this.setPreviousStatement(true, [...MAPPING_CONTROL_TYPES]);
    this.setNextStatement(true);
  };
  wrapped.mappingControlCheck_ = true;
  def.init = wrapped;
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
