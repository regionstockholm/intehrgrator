import * as Blockly from "blockly/core";
import { Extensions } from "blockly/core";

const OPTIONAL_INPUT_PREFIX = "OPT_";

export function registerRmBlocks(): void {
  defineGenericStructureBlock("rm_structure", "#003B49");

  defineContainerBlock("composition", "Composition", [
    { name: "CONTENT", type: "statement" },
    { name: "CONTEXT", type: "statement" },
    { name: "BODY", type: "statement" },
  ], "#005C53");

  defineContainerBlock("section", "Section", [
    { name: "ITEMS", type: "statement" },
    { name: "BODY", type: "statement" },
  ], "#005C53");

  defineContainerBlock("observation", "Observation", [
    { name: "DATA", type: "statement" },
    { name: "STATE", type: "statement" },
    { name: "PROTOCOL", type: "statement" },
    { name: "BODY", type: "statement" },
  ], "#003B49", true);

  defineContainerBlock("cluster", "Cluster", [
    { name: "ITEMS", type: "statement" },
    { name: "BODY", type: "statement" },
  ], "#003B49");

  defineValueElementBlock();
  defineDvBlocks();
  registerOptionalRmMutator();
}

export function ensureRmBlockType(blockType: string, rmType: string): void {
  if (Blockly.Blocks[blockType]) return;
  defineGenericStructureBlock(blockType, rmType.startsWith("DV_") ? "#5C6BC0" : "#003B49");
}

type InputDef = { name: string; type: "statement" | "value" };

function defineGenericStructureBlock(type: string, colour: string): void {
  if (Blockly.Blocks[type]) return;
  Blockly.Blocks[type] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput("HEADER")
        .appendField(new Blockly.FieldLabel("label"), "NAME")
        .appendField(new Blockly.FieldLabel("", undefined, { class: "blockly-at-code" }), "AT_CODE");
      this.appendStatementInput("BODY").appendField("children");
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "RM_TYPE");
      this.getField("RM_TYPE")!.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "SLOT_ID");
      this.getField("SLOT_ID")!.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "ARCHETYPE_NODE_ID");
      this.getField("ARCHETYPE_NODE_ID")!.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "ARCHETYPE_CTX");
      this.getField("ARCHETYPE_CTX")!.setVisible(false);
      this.setColour(colour);
      this.setTooltip("openEHR RM structure");
    },
  };
}

function defineContainerBlock(
  type: string,
  label: string,
  inputs: InputDef[],
  colour: string,
  expandable = false,
): void {
  Blockly.Blocks[type] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput().appendField(label);
      if (expandable) {
        this.appendDummyInput("PLUS")
          .appendField(new Blockly.FieldImage(
            "data:image/svg+xml," + encodeURIComponent(plusSvg()),
            18,
            18,
            "+",
            () => this.firePlusClick?.(),
          ));
      }
      for (const input of inputs) {
        if (input.type === "statement") {
          this.appendStatementInput(input.name).appendField(input.name.toLowerCase());
        }
      }
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "SLOT_ID");
      this.getField("SLOT_ID")!.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "RM_TYPE");
      this.getField("RM_TYPE")!.setVisible(false);
      this.setColour(colour);
      this.setTooltip(label);
      if (expandable) {
        Blockly.Extensions.apply("optional_rm_mutator", this, false);
      }
    },
  };
}

function defineValueElementBlock(): void {
  Blockly.Blocks["element"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput("HEADER")
        .appendField(new Blockly.FieldLabel("name"), "NAME")
        .appendField(new Blockly.FieldLabel("", undefined, { class: "blockly-at-code" }), "AT_CODE");
      this.appendValueInput("VALUE")
        .setCheck(null)
        .appendField("map");
      this.appendDummyInput()
        .appendField(new Blockly.FieldLabelSerializable(""), "RM_TYPE");
      this.getField("RM_TYPE")!.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "SLOT_ID");
      this.getField("SLOT_ID")!.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "ARCHETYPE_NODE_ID");
      this.getField("ARCHETYPE_NODE_ID")!.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "ARCHETYPE_CTX");
      this.getField("ARCHETYPE_CTX")!.setVisible(false);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
    },
  };
}

function defineDvBlocks(): void {
  Blockly.Blocks["dv_quantity_value"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("DV_QUANTITY")
        .appendField(new Blockly.FieldTextInput(""), "SLOT_ID")
        .appendField(new Blockly.FieldTextInput("DV_QUANTITY"), "RM_TYPE");
      this.getField("SLOT_ID")!.setVisible(false);
      this.getField("RM_TYPE")!.setVisible(false);
      this.appendValueInput("MAGNITUDE").setCheck("Number").appendField("magnitude");
      this.appendDummyInput().appendField("units").appendField(
        new Blockly.FieldTextInput("mm[Hg]"),
        "UNITS",
      );
      this.setOutput(true, null);
      this.setColour(230);
    },
  };

  Blockly.Blocks["dv_text_value"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("DV_TEXT")
        .appendField(new Blockly.FieldTextInput(""), "SLOT_ID");
      this.getField("SLOT_ID")!.setVisible(false);
      this.appendValueInput("VALUE").setCheck("String").appendField("value");
      this.setOutput(true, "String");
      this.setColour(230);
    },
  };
}

function registerOptionalRmMutator(): void {
  Extensions.registerMutator("optional_rm_mutator", {
    mutationToDom: function (this: Blockly.Block) {
      const container = document.createElement("mutation");
      const extras = this.extraInputs_ ?? [];
      container.setAttribute("extras", JSON.stringify(extras));
      return container;
    },
    domToMutation: function (this: Blockly.Block, xmlElement: Element) {
      const extras = JSON.parse(xmlElement.getAttribute("extras") || "[]") as string[];
      this.extraInputs_ = extras;
      this.updateShape_?.();
    },
    addInput_: function (this: Blockly.Block, name: string) {
      this.extraInputs_ = this.extraInputs_ ?? [];
      if (!this.extraInputs_.includes(name)) {
        this.extraInputs_.push(name);
        this.updateShape_?.();
      }
    },
    updateShape_: function (this: Blockly.Block) {
      for (const input of [...this.inputList]) {
        if (input.name.startsWith(OPTIONAL_INPUT_PREFIX)) {
          this.removeInput(input.name);
        }
      }
      for (const name of this.extraInputs_ ?? []) {
        this.appendStatementInput(`${OPTIONAL_INPUT_PREFIX}${name}`)
          .appendField(name);
      }
    },
  } as Blockly.Mutator & {
    addInput_?: (name: string) => void;
    updateShape_?: () => void;
  });
}

declare module "blockly/core" {
  interface Block {
    extraInputs_?: string[];
    firePlusClick?: () => void;
    addInput_?: (name: string) => void;
    updateShape_?: () => void;
  }
}

function plusSvg(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#E87722" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
}
