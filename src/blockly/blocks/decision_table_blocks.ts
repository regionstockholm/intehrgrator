import { Blockly } from "../blockly_core.ts";
import {
  appendBlockOutputGlyph,
  appendInputTypeGlyph,
  inputAlignLeft,
  inputAlignRight,
} from "../block_type_glyph.ts";

const DT_COLOUR = "#00796B";
const DT_DECL_COLOUR = "#004D40";

export const DECISION_TABLE_BLOCK = "decision_table";
export const DECISION_TABLE_DECL = "decision_table_decl";

let decisionTableFocusHandler: ((name: string) => void) | null = null;

/** Workbench shows the Sheets tab and selects this named Decision table. */
export function setDecisionTableFocusHandler(handler: ((name: string) => void) | null): void {
  decisionTableFocusHandler = handler;
}

function nameField(defaultName = "Decision1"): Blockly.FieldTextInput {
  return new Blockly.FieldTextInput(defaultName, undefined, { spellcheck: false });
}

/**
 * Value block: named Decision table + locals Map (condition keys + snippet bindings) → output column.
 * Flatten nested/complex sources into Map keys (or via variables_set → variables_get) before wiring.
 */
export function registerDecisionTableBlocks(): void {
  if (Blockly.Blocks[DECISION_TABLE_BLOCK]) return;

  Blockly.Blocks[DECISION_TABLE_DECL] = {
    init: function (this: Blockly.Block) {
      const field = nameField("Decision1");
      this.appendDummyInput()
        .appendField("decision table")
        .appendField(field, "NAME");
      this.setColour(DT_DECL_COLOUR);
      this.setTooltip("Named Decision table. Select to open the Sheets editor.");
      this.setPreviousStatement(false);
      this.setNextStatement(false);
    },
    onchange: function (this: Blockly.Block, event: { type?: string; newElementId?: string }) {
      if (event?.type === "selected" && event.newElementId === this.id) {
        decisionTableFocusHandler?.(String(this.getFieldValue("NAME") || "Decision1"));
      }
    },
  };

  Blockly.Blocks[DECISION_TABLE_BLOCK] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER").setAlign(inputAlignLeft());
      appendBlockOutputGlyph(header, ["String", "Number", "Boolean"]);
      header
        .appendField("decision")
        .appendField(nameField("Decision1"), "NAME");
      const inputs = this.appendValueInput("INPUTS")
        .setAlign(inputAlignRight())
        .appendField("locals");
      appendInputTypeGlyph(inputs, null);
      header.appendField("→").appendField(
        new Blockly.FieldTextInput("out", undefined, { spellcheck: false }),
        "OUTPUT",
      );
      this.setOutput(true, ["String", "Number", "Boolean"]);
      this.setColour(DT_COLOUR);
      this.setInputsInline(true);
      this.setTooltip(
        "Evaluate a Decision table: locals Map keys match condition columns and VMS-Mustache snippet names.",
      );
    },
    onchange: function (this: Blockly.Block, event: { type?: string; newElementId?: string }) {
      if (event?.type === "selected" && event.newElementId === this.id) {
        decisionTableFocusHandler?.(String(this.getFieldValue("NAME") || "Decision1"));
      }
    },
  };
}
