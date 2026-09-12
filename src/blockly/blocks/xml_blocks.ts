/**
 * Generic XML Blockly blocks: element, text, attribute, CDATA, and document root.
 */
import type { Block, BlockSvg } from "blockly/core";
import { Blockly } from "../blockly_core.ts";
import { appendHiddenSerializable } from "../hidden_serializable_field.ts";
import { appendMutatorCogwheel, hideDefaultMutatorIcon } from "../dynamic_mutator.ts";
import { applyInstanceRootCap } from "../instance_root.ts";
import {
  TARGET_CHILD_PREFIX,
  targetChildInputName,
} from "./target_blocks.ts";

const XML_COLOUR = "#0284C7";
const XML_ATTR_CHECK = "xml_attribute";
const XML_ELEM_CHECK = "xml_element";

export const XML_BLOCK_TYPES = [
  "xml_document",
  "xml_element",
  "xml_text",
  "xml_attribute",
  "xml_cdata",
] as const;

export const XML_DECL_MUTATOR = "xml_decl_mutator";
const XML_DECL_MUTATOR_CONTAINER = "xml_decl_mutator_container";
const XML_DECL_MUTATOR_ITEM = "xml_decl_mutator_item";

interface XmlElementExtraState {
  childGroups?: string[];
  instanceRoot?: boolean;
}

export function registerXmlBlocks(): void {
  registerXmlDeclMutatorBlocks();
  defineXmlDocument();
  defineXmlElement();
  defineXmlText();
  defineXmlAttribute();
  defineXmlCdata();
}

function inputAlignRight(): number {
  return (Blockly.inputs?.Align?.RIGHT ?? 1) as number;
}

function defineXmlDocument(): void {
  if (Blockly.Blocks.xml_document) return;
  Blockly.Blocks.xml_document = {
    init: function (this: Block) {
      const header = this.appendDummyInput("HEADER").setAlign(
        (Blockly.inputs?.Align?.LEFT ?? -1) as number,
      );
      header.appendField("XML document");
      header.appendField("version")
        .appendField(new Blockly.FieldTextInput("1.0"), "XML_VERSION")
        .appendField("encoding")
        .appendField(new Blockly.FieldTextInput("UTF-8"), "XML_ENCODING");
      appendMutatorCogwheel(header);
      this.appendDummyInput("DECL")
        .appendField("standalone")
        .appendField(
          new Blockly.FieldDropdown([["", ""], ["yes", "yes"], ["no", "no"]]),
          "XML_STANDALONE",
        );
      appendHiddenSerializable(this, "TARGET_TYPE", "");
      appendHiddenSerializable(this, "SLOT_ID", "");
      this.appendStatementInput(targetChildInputName("root"))
        .setAlign(inputAlignRight())
        .appendField("root");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(XML_COLOUR);
      this.setTooltip(
        "XML document prolog (version, encoding, namespaces) and a single root element",
      );
      Blockly.Extensions.apply(XML_DECL_MUTATOR, this, true);
    },
    saveExtraState: function (this: Block) {
      const namespaces = xmlNamespacesOf(this);
      const instanceRoot = Boolean((this as Block & { isInstanceRoot_?: boolean }).isInstanceRoot_);
      const payload: Record<string, unknown> = {};
      if (namespaces.length) payload.namespaces = namespaces;
      if (instanceRoot) payload.instanceRoot = true;
      return Object.keys(payload).length ? payload : null;
    },
    loadExtraState: function (this: Block, state: unknown) {
      const raw = state && typeof state === "object"
        ? state as { namespaces?: Array<{ prefix: string; uri: string }>; instanceRoot?: boolean }
        : undefined;
      setXmlNamespaces(this, Array.isArray(raw?.namespaces) ? raw!.namespaces! : []);
      if (raw?.instanceRoot) applyInstanceRootCap(this);
    },
  };
}

function defineXmlElement(): void {
  if (Blockly.Blocks.xml_element) return;
  Blockly.Blocks.xml_element = {
    init: function (this: Block) {
      const header = this.appendDummyInput("HEADER");
      header.appendField("XML");
      header.appendField(new Blockly.FieldTextInput("element"), "NAME");
      appendHiddenSerializable(this, "TARGET_TYPE", "");
      appendHiddenSerializable(this, "SLOT_ID", "");
      this.appendValueInput(targetChildInputName("text"))
        .setAlign(inputAlignRight())
        .setCheck(null)
        .appendField("text");
      this.appendStatementInput(targetChildInputName("attributes"))
        .setAlign(inputAlignRight())
        .appendField("attributes");
      this.appendStatementInput(targetChildInputName("children"))
        .setAlign(inputAlignRight())
        .appendField("children");
      this.setPreviousStatement(true, XML_ELEM_CHECK);
      this.setNextStatement(true, XML_ELEM_CHECK);
      this.setColour(XML_COLOUR);
      this.setTooltip("Generic XML element — one text slot, many attributes, nested elements");
    },
    saveExtraState: function (this: Block) {
      const childGroups = this.inputList
        .filter((input) => input.name.startsWith(TARGET_CHILD_PREFIX))
        .map((input) => input.name.slice(TARGET_CHILD_PREFIX.length));
      const instanceRoot = Boolean((this as Block & { isInstanceRoot_?: boolean }).isInstanceRoot_);
      const payload: XmlElementExtraState = {};
      if (childGroups.length) payload.childGroups = childGroups;
      if (instanceRoot) payload.instanceRoot = true;
      return Object.keys(payload).length ? payload : null;
    },
    loadExtraState: function (this: Block, state: unknown) {
      const raw = state && typeof state === "object"
        ? state as XmlElementExtraState
        : undefined;
      if (raw?.instanceRoot) applyInstanceRootCap(this);
      syncXmlElementInputs(this, normalizeXmlElementGroups(raw?.childGroups));
      migrateXmlElementInputs(this);
    },
  };
}

function defineXmlText(): void {
  if (Blockly.Blocks.xml_text) return;
  Blockly.Blocks.xml_text = {
    init: function (this: Block) {
      this.appendDummyInput("HEADER").appendField("XML text");
      appendHiddenSerializable(this, "TARGET_TYPE", "");
      this.appendValueInput("VALUE").setCheck(null).appendField("value");
      appendHiddenSerializable(this, "SLOT_ID", "");
      appendHiddenSerializable(this, "MANDATORY", "");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(XML_COLOUR);
      this.setTooltip("XML text node (legacy statement wrapper — prefer the parent text slot)");
      this.setInputsInline(true);
    },
  };
}

function defineXmlAttribute(): void {
  if (Blockly.Blocks.xml_attribute) return;
  Blockly.Blocks.xml_attribute = {
    init: function (this: Block) {
      this.appendDummyInput("HEADER")
        .appendField("XML attr")
        .appendField(new Blockly.FieldTextInput("attr"), "NAME");
      appendHiddenSerializable(this, "TARGET_TYPE", "");
      this.appendValueInput("VALUE").setCheck(null).appendField("value");
      appendHiddenSerializable(this, "SLOT_ID", "");
      appendHiddenSerializable(this, "MANDATORY", "");
      this.setPreviousStatement(true, XML_ATTR_CHECK);
      this.setNextStatement(true, XML_ATTR_CHECK);
      this.setColour(XML_COLOUR);
      this.setTooltip("XML attribute on the parent element");
      this.setInputsInline(true);
    },
  };
}

function defineXmlCdata(): void {
  if (Blockly.Blocks.xml_cdata) return;
  Blockly.Blocks.xml_cdata = {
    init: function (this: Block) {
      this.appendDummyInput("HEADER").appendField("XML CDATA");
      this.appendValueInput("VALUE").setCheck(null).appendField("content");
      this.setOutput(true, "String");
      this.setColour(XML_COLOUR);
      this.setTooltip("Literal XML CDATA section: <![CDATA[ ... ]]>");
      this.setInputsInline(true);
    },
  };
}

function normalizeXmlElementGroups(groups?: string[]): string[] {
  if (!groups?.length || (groups.length === 1 && groups[0] === "children")) {
    return ["text", "attributes", "children"];
  }
  const out = ["text", "attributes", "children"];
  for (const group of groups) {
    if (!out.includes(group)) out.push(group);
  }
  return out;
}

function syncXmlElementInputs(block: Block, groups: string[]): void {
  const wanted = new Set(groups);
  for (const input of [...block.inputList]) {
    if (!input.name.startsWith(TARGET_CHILD_PREFIX)) continue;
    const group = input.name.slice(TARGET_CHILD_PREFIX.length);
    if (!wanted.has(group)) block.removeInput(input.name);
  }
  const labels: Record<string, string> = {
    text: "text",
    attributes: "attributes",
    children: "children",
    root: "root",
  };
  for (const group of groups) {
    const name = targetChildInputName(group);
    if (block.getInput(name)) continue;
    if (group === "text") {
      block.appendValueInput(name).setAlign(inputAlignRight()).appendField(labels[group] ?? group);
    } else {
      block.appendStatementInput(name).setAlign(inputAlignRight()).appendField(labels[group] ?? group);
    }
  }
}

/** Move legacy mixed `children` chains into text / attributes / children mouths. */
export function migrateXmlElementInputs(block: Block): void {
  if (block.type !== "xml_element") return;
  const childrenInput = block.getInput(targetChildInputName("children"));
  if (!childrenInput?.connection) return;

  const attrs: Block[] = [];
  const elements: Block[] = [];
  let textExpr: Block | null = null;

  let current: Block | null = childrenInput.connection.targetBlock();
  while (current) {
    const next = current.getNextBlock();
    if (current.type === "xml_attribute") {
      attrs.push(current);
    } else if (current.type === "xml_text") {
      textExpr = current.getInputTargetBlock("VALUE");
      if (textExpr) textExpr.unplug(false);
      current.unplug(true);
      current.dispose(false);
    } else {
      elements.push(current);
    }
    current = next;
  }

  for (const attr of attrs) attr.unplug(true);
  for (const elem of elements) elem.unplug(true);

  const textInput = block.getInput(targetChildInputName("text"));
  if (textExpr && textInput?.connection && !textInput.connection.targetBlock()) {
    try {
      textInput.connection.connect(textExpr.outputConnection!);
    } catch {
      // type mismatch — leave unconnected
    }
  }

  connectStatementChain(block.getInput(targetChildInputName("attributes")), attrs);
  connectStatementChain(childrenInput, elements);
}

function connectStatementChain(
  input: { connection?: { connect: (c: unknown) => void; targetBlock?: () => Block | null } | null } | null,
  blocks: Block[],
): void {
  if (!input?.connection || !blocks.length) return;
  let previous: Block | null = null;
  for (const block of blocks) {
    if (!previous) {
      if (block.previousConnection) input.connection.connect(block.previousConnection);
    } else if (block.previousConnection && previous.nextConnection) {
      previous.nextConnection.connect(block.previousConnection);
    }
    previous = block;
  }
}

function registerXmlDeclMutatorBlocks(): void {
  if (Blockly.Blocks[XML_DECL_MUTATOR_CONTAINER]) return;

  Blockly.Blocks[XML_DECL_MUTATOR_CONTAINER] = {
    init: function (this: Block) {
      this.appendDummyInput().appendField("XML namespaces");
      this.appendStatementInput("STACK");
      this.setColour(XML_COLOUR);
      this.setTooltip("Namespace bindings on the root element");
    },
  };

  Blockly.Blocks[XML_DECL_MUTATOR_ITEM] = {
    init: function (this: Block) {
      this.appendDummyInput()
        .appendField("xmlns:")
        .appendField(new Blockly.FieldTextInput("prefix"), "PREFIX")
        .appendField("=")
        .appendField(new Blockly.FieldTextInput("uri"), "URI");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(XML_COLOUR);
      this.setTooltip("Namespace prefix bound on the root element");
    },
  };

  if (Blockly.Extensions.isRegistered(XML_DECL_MUTATOR)) return;

  Blockly.Extensions.registerMutator(XML_DECL_MUTATOR, {
    decompose: function (this: Block, workspace: Blockly.Workspace) {
      const container = workspace.newBlock(XML_DECL_MUTATOR_CONTAINER) as BlockSvg;
      container.initSvg();
      let previous: Block | null = null;
      for (const ns of xmlNamespacesOf(this)) {
        const item = workspace.newBlock(XML_DECL_MUTATOR_ITEM) as BlockSvg;
        item.setFieldValue(ns.prefix, "PREFIX");
        item.setFieldValue(ns.uri, "URI");
        item.initSvg();
        if (!previous) {
          container.getInput("STACK")?.connection?.connect(item.previousConnection!);
        } else {
          previous.nextConnection?.connect(item.previousConnection!);
        }
        previous = item;
      }
      return container;
    },
    compose: function (this: Block, container: Block) {
      const namespaces: Array<{ prefix: string; uri: string }> = [];
      let item: Block | null = container.getInputTargetBlock("STACK");
      while (item) {
        const prefix = String(item.getFieldValue("PREFIX") ?? "").trim();
        const uri = String(item.getFieldValue("URI") ?? "").trim();
        if (prefix && uri) namespaces.push({ prefix, uri });
        item = item.getNextBlock();
      }
      setXmlNamespaces(this, namespaces);
    },
    saveExtraState: function (this: Block) {
      const namespaces = xmlNamespacesOf(this);
      return namespaces.length ? { namespaces } : null;
    },
    loadExtraState: function (this: Block, state: unknown) {
      const raw = state && typeof state === "object"
        ? state as { namespaces?: Array<{ prefix: string; uri: string }> }
        : undefined;
      setXmlNamespaces(this, Array.isArray(raw?.namespaces) ? raw!.namespaces! : []);
    },
  }, function (this: Block) {
    this.setMutator(new Blockly.MutatorIcon([XML_DECL_MUTATOR_ITEM], this as BlockSvg));
    hideDefaultMutatorIcon(this);
  });
}

export function xmlNamespacesOf(block: Block): Array<{ prefix: string; uri: string }> {
  return (block as Block & { xmlNamespaces_?: Array<{ prefix: string; uri: string }> }).xmlNamespaces_ ?? [];
}

function setXmlNamespaces(
  block: Block,
  namespaces: Array<{ prefix: string; uri: string }>,
): void {
  (block as Block & { xmlNamespaces_?: Array<{ prefix: string; uri: string }> }).xmlNamespaces_ = namespaces;
}

export function xmlDeclarationOf(block: Block): { version: string; encoding: string; standalone: string } {
  return {
    version: String(block.getFieldValue("XML_VERSION") ?? "1.0"),
    encoding: String(block.getFieldValue("XML_ENCODING") ?? "UTF-8"),
    standalone: String(block.getFieldValue("XML_STANDALONE") ?? ""),
  };
}
