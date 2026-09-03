import { Blockly } from "../blockly_core.ts";
import type { Block } from "blockly/core";

const GO_XML_COLOUR = "#0284C7";

export const GO_XML_BLOCK_TYPES = ["go_xml_element", "go_xml_comment"] as const;

export interface GoXmlAttribute {
  name: string;
  value: string;
}

type GoXmlElementBlock = Block & { attributes_?: GoXmlAttribute[] };

function readAttributes(state: unknown): GoXmlAttribute[] {
  if (!state || typeof state !== "object") return [];
  const raw = (state as { attributes?: unknown }).attributes;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const name = String((item as GoXmlAttribute).name ?? "").trim();
    if (!name) return [];
    return [{ name, value: String((item as GoXmlAttribute).value ?? "") }];
  });
}

export function registerGoTemplateBlocks(): void {
  if (Blockly.Blocks.go_xml_element) return;

  Blockly.Blocks.go_xml_element = {
    init: function (this: GoXmlElementBlock) {
      this.attributes_ = [];
      this.appendDummyInput("HEADER")
        .appendField("XML")
        .appendField(new Blockly.FieldTextInput("element"), "TAG");
      this.appendValueInput("TEXT").setCheck(null).appendField("text");
      this.appendStatementInput("CHILDREN").appendField("children");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(GO_XML_COLOUR);
      this.setTooltip("XML element for Go text/template output");
    },
    saveExtraState: function (this: GoXmlElementBlock) {
      const attributes = this.attributes_ ?? [];
      return attributes.length ? { attributes } : null;
    },
    loadExtraState: function (this: GoXmlElementBlock, state: unknown) {
      this.attributes_ = readAttributes(state);
    },
  };

  Blockly.Blocks.go_xml_comment = {
    init: function (this: Block) {
      this.appendDummyInput()
        .appendField("XML comment")
        .appendField(new Blockly.FieldTextInput(""), "TEXT");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(GO_XML_COLOUR);
      this.setTooltip("XML comment for Go text/template output");
    },
  };
}

/** Static attributes saved on go_xml_element via extraState (not separate blocks). */
export function goXmlAttributesOf(block: Block): GoXmlAttribute[] {
  return (block as GoXmlElementBlock).attributes_ ?? [];
}
