import * as Blockly from "blockly/core";

export function registerExpressionBlocks(): void {
  Blockly.Blocks["source_query"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("source")
        .appendField(new Blockly.FieldTextInput("/path"), "EXPRESSION");
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput("string"), "RETURN_TYPE")
        .setVisible(false);
      this.setOutput(true, null);
      this.setColour(20);
      this.setTooltip("fontoxpath source query");
    },
  };

  Blockly.Blocks["trim"] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("TEXT").setCheck("String");
      this.appendDummyInput().appendField("trim");
      this.setOutput(true, "String");
      this.setColour(20);
    },
  };

  Blockly.Blocks["concat"] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("A").setCheck("String");
      this.appendValueInput("B").setCheck("String").appendField("concat");
      this.setOutput(true, "String");
      this.setColour(20);
    },
  };

  Blockly.Blocks["if_then_else"] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("COND").setCheck("Boolean").appendField("if");
      this.appendValueInput("THEN").appendField("then");
      this.appendValueInput("ELSE").appendField("else");
      this.setOutput(true, null);
      this.setColour(20);
    },
  };

  Blockly.Blocks["math_arithmetic"] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("A").setCheck("Number");
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["+", "ADD"],
          ["-", "MINUS"],
          ["×", "MULTIPLY"],
          ["÷", "DIVIDE"],
        ]),
        "OP",
      );
      this.appendValueInput("B").setCheck("Number");
      this.setOutput(true, "Number");
      this.setColour(20);
    },
  };
}
