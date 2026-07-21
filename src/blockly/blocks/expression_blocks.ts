import { Blockly } from "../blockly_core.ts";
import type { BlockSvg } from "blockly/core";
import { blocklyCheckForReturnType } from "../block_checks.ts";

const SWITCH_CASE_MUTATOR = "switch_case_mutator";
const LOGIC_COLOUR = "#A6745B";

export function registerExpressionBlocks(): void {
  registerSwitchCaseMutator();

  Blockly.Blocks["source_query"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("source")
        .appendField(new Blockly.FieldTextInput("/path"), "EXPRESSION");
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput("string"), "RETURN_TYPE")
        .setVisible(false);
      this.setOutput(true, "String");
      this.setColour(20);
      this.setTooltip("fontoxpath source query");
    },
  };

  Blockly.Blocks["text_literal"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("text")
        .appendField(new Blockly.FieldTextInput(""), "TEXT");
      this.setOutput(true, "String");
      this.setColour(160);
      this.setTooltip("String literal");
    },
  };

  Blockly.Blocks["number_literal"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("number")
        .appendField(new Blockly.FieldNumber(0), "NUM");
      this.setOutput(true, "Number");
      this.setColour(160);
      this.setTooltip("Number literal");
    },
  };

  Blockly.Blocks["boolean_literal"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("boolean")
        .appendField(
          new Blockly.FieldDropdown([["true", "TRUE"], ["false", "FALSE"]]),
          "BOOL",
        );
      this.setOutput(true, "Boolean");
      this.setColour(160);
      this.setTooltip("Boolean literal");
    },
  };

  Blockly.Blocks["trim"] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("TEXT")
        .setCheck("String")
        .appendField("trim");
      this.setOutput(true, "String");
      this.setColour(20);
      this.setInputsInline(false);
    },
  };

  Blockly.Blocks["concat"] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("A")
        .setCheck("String")
        .appendField("concat");
      this.appendValueInput("B")
        .setCheck("String")
        .appendField("+");
      this.setOutput(true, "String");
      this.setColour(20);
      this.setInputsInline(false);
    },
  };

  Blockly.Blocks["if_then_else"] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("COND")
        .setCheck("Boolean")
        .appendField("if");
      this.appendValueInput("THEN")
        .appendField("then");
      this.appendValueInput("ELSE")
        .appendField("else");
      this.setOutput(true, null);
      this.setColour(20);
      this.setInputsInline(false);
    },
  };

  Blockly.Blocks["math_arithmetic"] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("A")
        .setCheck("Number")
        .appendField("calc");
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["+", "ADD"],
            ["-", "MINUS"],
            ["×", "MULTIPLY"],
            ["÷", "DIVIDE"],
          ]),
          "OP",
        );
      this.appendValueInput("B")
        .setCheck("Number")
        .appendField("with");
      this.setOutput(true, "Number");
      this.setColour(20);
      this.setInputsInline(false);
    },
  };

  Blockly.Blocks["switch_case"] = {
    init: function (this: Blockly.Block) {
      this.caseCount_ = 1;
      this.appendValueInput("DISCRIMINANT")
        .setCheck(null)
        .appendField("switch");
      this.appendValueInput("DEFAULT")
        .appendField("default");
      this.setOutput(true, null);
      this.setColour(20);
      this.setInputsInline(false);
      this.setTooltip("Match discriminant against case values");
      Blockly.Extensions.apply(SWITCH_CASE_MUTATOR, this, false);
      this.rebuildCaseInputs_?.();
    },
  };

  Blockly.Blocks["switch_case_clause"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput().appendField("case");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(20);
      this.setTooltip("Add another switch case");
    },
  };

  Blockly.Blocks["mapping_var_get"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("var")
        .appendField(new Blockly.FieldTextInput("v"), "VAR");
      this.setOutput(true, null);
      this.setColour(330);
      this.setTooltip("Read a mapping variable");
    },
  };

  Blockly.Blocks["mapping_var_set"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("set var")
        .appendField(new Blockly.FieldTextInput("v"), "VAR")
        .appendField("=");
      this.appendValueInput("VALUE")
        .setCheck(null);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(330);
      this.setInputsInline(false);
      this.setTooltip("Assign a mapping variable (for multi-step mappings)");
    },
  };

  // --- Loops (statement blocks) ---

  Blockly.Blocks["controls_while"] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("COND")
        .setCheck("Boolean")
        .appendField("while");
      this.appendStatementInput("DO")
        .appendField("do");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(LOGIC_COLOUR);
      this.setTooltip("Repeat while condition is true (tested before each iteration)");
      this.setInputsInline(false);
    },
  };

  Blockly.Blocks["controls_do_while"] = {
    init: function (this: Blockly.Block) {
      this.appendStatementInput("DO")
        .appendField("do");
      this.appendValueInput("COND")
        .setCheck("Boolean")
        .appendField("while");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(LOGIC_COLOUR);
      this.setTooltip("Run body once, then repeat while condition is true (tested after each iteration)");
      this.setInputsInline(false);
    },
  };

  Blockly.Blocks["controls_repeat_n"] = {
    init: function (this: Blockly.Block) {
      this.appendValueInput("TIMES")
        .setCheck("Number")
        .appendField("repeat");
      this.appendDummyInput()
        .appendField("times");
      this.appendStatementInput("DO")
        .appendField("do");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(LOGIC_COLOUR);
      this.setTooltip("Repeat body a fixed number of times");
      this.setInputsInline(true);
    },
  };

  /**
   * Loop over nodes from a source path (repeatable structure).
   * Path is an XPath/XQuery that may return multiple nodes; each iteration
   * binds the current node to the named mapping variable.
   */
  Blockly.Blocks["for_each_source"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("for each")
        .appendField(new Blockly.FieldTextInput("item"), "VAR")
        .appendField("in");
      this.appendDummyInput()
        .appendField("source nodes")
        .appendField(new Blockly.FieldTextInput("/path/to/items"), "PATH");
      this.appendStatementInput("DO")
        .appendField("do");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(LOGIC_COLOUR);
      this.setTooltip(
        "Loop over every node matched by a source path (e.g. multi-valued vitals). " +
          "Current node is stored in the named variable for use in the body.",
      );
      this.setInputsInline(false);
    },
  };
}

let switchCaseMutatorRegistered = false;

function registerSwitchCaseMutator(): void {
  if (switchCaseMutatorRegistered) return;
  switchCaseMutatorRegistered = true;
  Blockly.Extensions.registerMutator(SWITCH_CASE_MUTATOR, {
    mutationToDom: function (this: Blockly.Block) {
      const container = Blockly.utils.xml.createElement("mutation");
      container.setAttribute("cases", String(this.caseCount_ ?? 1));
      return container;
    },
    domToMutation: function (this: Blockly.Block, xmlElement: Element) {
      this.caseCount_ = Math.max(1, parseInt(xmlElement.getAttribute("cases") || "1", 10));
      this.rebuildCaseInputs_?.();
    },
    saveExtraState: function (this: Blockly.Block) {
      return { cases: this.caseCount_ ?? 1 };
    },
    loadExtraState: function (this: Blockly.Block, state: { cases?: number }) {
      this.caseCount_ = Math.max(1, state.cases ?? 1);
      this.rebuildCaseInputs_?.();
    },
    decompose: function (this: Blockly.Block, workspace: Blockly.Workspace) {
      const container = workspace.newBlock("switch_case_clause") as BlockSvg;
      container.initSvg();
      let clause: BlockSvg = container;
      const count = this.caseCount_ ?? 1;
      for (let i = 1; i < count; i++) {
        const next = workspace.newBlock("switch_case_clause") as BlockSvg;
        next.initSvg();
        clause.nextConnection!.connect(next.previousConnection!);
        clause = next;
      }
      return container;
    },
    compose: function (this: Blockly.Block, containerBlock: Blockly.Block) {
      let count = 0;
      let clause: Blockly.Block | null = containerBlock;
      while (clause) {
        count++;
        clause = clause.nextConnection?.targetBlock() ?? null;
      }
      this.caseCount_ = Math.max(1, count);
      this.rebuildCaseInputs_?.();
    },
    rebuildCaseInputs_: function (this: Blockly.Block) {
      for (const input of [...this.inputList]) {
        if (input.name.startsWith("CASE_")) {
          this.removeInput(input.name);
        }
      }
      const defaultInput = this.getInput("DEFAULT");
      const count = this.caseCount_ ?? 1;
      for (let i = 0; i < count; i++) {
        this.appendValueInput(`CASE_${i}_MATCH`)
          .setCheck(["String", "Number"])
          .appendField("case");
        this.appendValueInput(`CASE_${i}_OUT`)
          .appendField("→");
        if (defaultInput) {
          this.moveInputBefore(`CASE_${i}_MATCH`, "DEFAULT");
          this.moveInputBefore(`CASE_${i}_OUT`, "DEFAULT");
        }
      }
    },
  });
}

declare module "blockly/core" {
  interface Block {
    caseCount_?: number;
    rebuildCaseInputs_?: () => void;
  }
}
