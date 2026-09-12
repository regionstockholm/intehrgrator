/**
 * Ad-hoc XML Blockly blocks: element (split mouths), attribute, text, CDATA,
 * and XML document instance root with declaration/namespace mutator.
 */
import type { Block, BlockSvg } from "blockly/core";
import { Blockly } from "../blockly_core.ts";
import { FieldSkeletonTitle } from "../field_skeleton_title.ts";
import { appendHiddenSerializable, createHiddenSerializableField } from "../hidden_serializable_field.ts";
import {
  appendMutatorCogwheel,
  namesFromMutatorStack,
  registerDynamicFlyoutMutator,
  type MutatorFlyoutBlock,
} from "../dynamic_mutator.ts";
import {
  XML_ATTRIBUTE_CHECK,
  XML_ATTRIBUTE_TYPE,
  XML_ATTRIBUTES_INPUT,
  XML_CDATA_TYPE,
  XML_CHILDREN_INPUT,
  XML_DOCUMENT_TYPE,
  XML_ELEMENT_TYPE,
  XML_NEST_CHECK,
  XML_ROOT_INPUT,
  XML_TEXT_INPUT,
  XML_TEXT_TYPE,
  type XmlDocumentExtraState,
  type XmlNamespaceDecl,
} from "../../core/xml_shape.ts";

export const XML_COLOUR = "#0284C7";

const INSTANCE_ROOT_CONNECTION = "INSTANCE_ROOT";

function applyXmlInstanceRootCap(block: Block): void {
  if (block.outputConnection?.isConnected()) block.outputConnection.disconnect();
  if (block.nextConnection?.isConnected()) block.nextConnection.disconnect();
  block.setOutput(false);
  block.setNextStatement(false);
  block.setPreviousStatement(true, INSTANCE_ROOT_CONNECTION);
  (block as Block & { isInstanceRoot_?: boolean }).isInstanceRoot_ = true;
}

function applyMutatorItemLabel(item: Block, attr: string, label: string): void {
  item.setFieldValue(label, "LABEL");
  item.setFieldValue(attr, "ATTR");
}
export const XML_DOCUMENT_MUTATOR = "xml_document_mutator";
export const XML_DOCUMENT_MUTATOR_CONTAINER = "xml_document_mutator_container";
export const XML_DOCUMENT_MUTATOR_ITEM = "xml_document_mutator_item";

const DECL_ATTR = "declaration";
const STANDALONE_ATTR = "standalone";
const NS_PREFIX = "ns";

export const XML_BLOCK_TYPES = [
  XML_ELEMENT_TYPE,
  XML_TEXT_TYPE,
  XML_ATTRIBUTE_TYPE,
  XML_CDATA_TYPE,
  XML_DOCUMENT_TYPE,
] as const;

/** Blockly Align.RIGHT — attribute captions sit just left of their mouth. */
function inputAlignRight(): number {
  return (Blockly.inputs?.Align?.RIGHT ?? 1) as number;
}

export function registerXmlBlocks(): void {
  registerXmlDocumentMutator();
  defineXmlElement();
  defineXmlText();
  defineXmlAttribute();
  defineXmlCdata();
  defineXmlDocument();
}

function defineXmlElement(): void {
  if (Blockly.Blocks[XML_ELEMENT_TYPE]) return;
  Blockly.Blocks[XML_ELEMENT_TYPE] = {
    init: function (this: Block) {
      const header = this.appendDummyInput("HEADER");
      header.appendField("XML").appendField(new Blockly.FieldTextInput("element"), "NAME");
      appendHiddenSerializable(this, "TARGET_TYPE", "");
      appendHiddenSerializable(this, "SLOT_ID", "");
      this.appendStatementInput(XML_ATTRIBUTES_INPUT)
        .setAlign(inputAlignRight())
        .setCheck(XML_ATTRIBUTE_CHECK)
        .appendField("attributes");
      this.appendValueInput(XML_TEXT_INPUT)
        .setAlign(inputAlignRight())
        .setCheck("String")
        .appendField("text");
      this.appendStatementInput(XML_CHILDREN_INPUT)
        .setAlign(inputAlignRight())
        .setCheck([...XML_NEST_CHECK])
        .appendField("children");
      this.setPreviousStatement(true, [...XML_NEST_CHECK]);
      this.setNextStatement(true, [...XML_NEST_CHECK]);
      this.setColour(XML_COLOUR);
      this.setTooltip(
        "XML element: one text slot, stacked attributes, and nested child elements.",
      );
    },
    saveExtraState: function (this: Block) {
      const instanceRoot = Boolean((this as Block & { isInstanceRoot_?: boolean }).isInstanceRoot_);
      return instanceRoot ? { instanceRoot: true } : null;
    },
    loadExtraState: function (this: Block, state: unknown) {
      const raw = state && typeof state === "object"
        ? state as { instanceRoot?: unknown }
        : undefined;
      if (raw?.instanceRoot) applyXmlInstanceRootCap(this);
    },
  };
}

function defineXmlText(): void {
  if (Blockly.Blocks[XML_TEXT_TYPE]) return;
  Blockly.Blocks[XML_TEXT_TYPE] = {
    init: function (this: Block) {
      this.appendDummyInput("HEADER").appendField(new FieldSkeletonTitle("", "XML text"), "NAME");
      appendHiddenSerializable(this, "TARGET_TYPE", "");
      this.appendValueInput(XML_TEXT_INPUT).setCheck("String").appendField("value");
      appendHiddenSerializable(this, "SLOT_ID", "");
      appendHiddenSerializable(this, "MANDATORY", "");
      this.setOutput(true, "String");
      this.setColour(XML_COLOUR);
      this.setTooltip("XML text node (character data)");
      this.setInputsInline(true);
    },
  };
}

function defineXmlAttribute(): void {
  if (Blockly.Blocks[XML_ATTRIBUTE_TYPE]) return;
  Blockly.Blocks[XML_ATTRIBUTE_TYPE] = {
    init: function (this: Block) {
      this.appendDummyInput("HEADER")
        .appendField("XML attr")
        .appendField(new Blockly.FieldTextInput("attr"), "NAME");
      appendHiddenSerializable(this, "TARGET_TYPE", "");
      this.appendValueInput(XML_TEXT_INPUT).setCheck(null).appendField("value");
      appendHiddenSerializable(this, "SLOT_ID", "");
      appendHiddenSerializable(this, "MANDATORY", "");
      this.setPreviousStatement(true, XML_ATTRIBUTE_CHECK);
      this.setNextStatement(true, XML_ATTRIBUTE_CHECK);
      this.setColour(XML_COLOUR);
      this.setTooltip("XML attribute on the parent element");
      this.setInputsInline(true);
    },
  };
}

function defineXmlCdata(): void {
  if (Blockly.Blocks[XML_CDATA_TYPE]) return;
  Blockly.Blocks[XML_CDATA_TYPE] = {
    init: function (this: Block) {
      this.appendDummyInput("HEADER").appendField("CDATA");
      this.appendValueInput(XML_TEXT_INPUT).setCheck("String").appendField("value");
      this.setOutput(true, "String");
      this.setColour(XML_COLOUR);
      this.setTooltip("XML CDATA section — emitted as <![CDATA[ … ]]> without character escaping");
      this.setInputsInline(true);
    },
  };
}

type XmlDocumentBlock = Block & {
  xmlDocExtras_?: string[];
  xmlNamespaces_?: XmlNamespaceDecl[];
  updateXmlDocumentShape_?: () => void;
};

function defineXmlDocument(): void {
  if (Blockly.Blocks[XML_DOCUMENT_TYPE]) return;
  Blockly.Blocks[XML_DOCUMENT_TYPE] = {
    init: function (this: XmlDocumentBlock) {
      this.xmlDocExtras_ = [DECL_ATTR];
      this.xmlNamespaces_ = [];
      const header = this.appendDummyInput("HEADER");
      header.appendField("XML document");
      appendHiddenSerializable(this, "TARGET_TYPE", "xml-document");
      this.appendStatementInput(XML_ROOT_INPUT)
        .setAlign(inputAlignRight())
        .setCheck(XML_ELEMENT_TYPE)
        .appendField("element");
      applyXmlInstanceRootCap(this);
      this.setColour(XML_COLOUR);
      this.setTooltip(
        "XML document instance root. Cogwheel adds the XML declaration, standalone, and namespaces.",
      );
      Blockly.Extensions.apply(XML_DOCUMENT_MUTATOR, this, true);
      this.updateXmlDocumentShape_?.();
    },
  };
}

function nsAttr(index: number): string {
  return `${NS_PREFIX}${index}`;
}

function isNsAttr(name: string): boolean {
  return name.startsWith(NS_PREFIX) && /^ns\d+$/.test(name);
}

function nextNsAttr(stackNames: string[]): string {
  let i = 0;
  while (stackNames.includes(nsAttr(i))) i++;
  return nsAttr(i);
}

function nsIndex(name: string): number {
  return Number(name.slice(NS_PREFIX.length));
}

function defineXmlDocumentMutatorQuarks(): void {
  if (!Blockly.Blocks[XML_DOCUMENT_MUTATOR_CONTAINER]) {
    Blockly.Blocks[XML_DOCUMENT_MUTATOR_CONTAINER] = {
      init: function (this: Block) {
        this.appendDummyInput().appendField("XML document");
        this.appendStatementInput("STACK");
        this.setColour(XML_COLOUR);
        this.contextMenu = false;
      },
    };
  }
  if (!Blockly.Blocks[XML_DOCUMENT_MUTATOR_ITEM]) {
    Blockly.Blocks[XML_DOCUMENT_MUTATOR_ITEM] = {
      init: function (this: Block) {
        this.appendDummyInput()
          .appendField(new Blockly.FieldLabelSerializable(""), "LABEL")
          .appendField(createHiddenSerializableField(""), "ATTR");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(XML_COLOUR);
        this.contextMenu = false;
        this.setInputsInline(true);
      },
      loadExtraState: function (this: Block, state: { attr?: string; label?: string }) {
        if (state?.attr) applyMutatorItemLabel(this, state.attr, state.label ?? state.attr);
      },
    };
  }
}

function stackXmlDocMutatorItems(
  workspace: Blockly.Workspace,
  names: string[],
): Block {
  const container = workspace.newBlock(XML_DOCUMENT_MUTATOR_CONTAINER);
  container.initSvg?.();
  let connection = container.getInput("STACK")?.connection ?? null;
  for (const name of names) {
    const item = workspace.newBlock(XML_DOCUMENT_MUTATOR_ITEM);
    item.initSvg?.();
    applyMutatorItemLabel(item, name, labelForXmlDocAttr(name));
    if (connection && item.previousConnection) {
      connection.connect(item.previousConnection);
      connection = item.nextConnection;
    }
  }
  return container;
}

function labelForXmlDocAttr(name: string): string {
  if (name === DECL_ATTR) return "XML declaration";
  if (name === STANDALONE_ATTR) return "standalone";
  if (isNsAttr(name)) return "namespace";
  return name;
}

function xmlDocFlyoutContents(_block: BlockSvg, stackNames: string[]): MutatorFlyoutBlock[] {
  const contents: MutatorFlyoutBlock[] = [];
  if (!stackNames.includes(DECL_ATTR)) {
    contents.push({
      kind: "block",
      type: XML_DOCUMENT_MUTATOR_ITEM,
      extraState: { attr: DECL_ATTR, label: "XML declaration" },
    });
  }
  if (!stackNames.includes(STANDALONE_ATTR)) {
    contents.push({
      kind: "block",
      type: XML_DOCUMENT_MUTATOR_ITEM,
      extraState: { attr: STANDALONE_ATTR, label: "standalone" },
    });
  }
  const ns = nextNsAttr(stackNames);
  contents.push({
    kind: "block",
    type: XML_DOCUMENT_MUTATOR_ITEM,
    extraState: { attr: ns, label: "namespace" },
  });
  return contents;
}

function bindXmlDocumentMutator(this: Block): void {
  const header = this.getInput("HEADER");
  if (header && !this.getField("MUTATOR_COG")) appendMutatorCogwheel(header);
}

let xmlDocMutatorRegistered = false;

export function registerXmlDocumentMutator(): void {
  if (xmlDocMutatorRegistered) return;
  xmlDocMutatorRegistered = true;
  defineXmlDocumentMutatorQuarks();
  registerDynamicFlyoutMutator(
    XML_DOCUMENT_MUTATOR,
    {
      saveExtraState: function (this: XmlDocumentBlock): XmlDocumentExtraState {
        this.syncNamespacesFromFields_?.();
        const extras = this.xmlDocExtras_ ?? [DECL_ATTR];
        const payload: XmlDocumentExtraState = {
          extras,
          declaration: extras.includes(DECL_ATTR),
          version: String(this.getFieldValue("VERSION") || "1.0"),
          encoding: String(this.getFieldValue("ENCODING") || "UTF-8"),
          namespaces: this.xmlNamespaces_ ?? [],
        };
        if (extras.includes(STANDALONE_ATTR)) {
          payload.standalone = String(this.getFieldValue("STANDALONE") || "");
        }
        if ((this as Block & { isInstanceRoot_?: boolean }).isInstanceRoot_) {
          payload.instanceRoot = true;
        }
        return payload;
      },
      loadExtraState: function (this: XmlDocumentBlock, state: XmlDocumentExtraState | null) {
        const extras = Array.isArray(state?.extras) && state!.extras!.length
          ? state!.extras!
          : [
            ...(state?.declaration === false ? [] : [DECL_ATTR]),
            ...(state?.standalone ? [STANDALONE_ATTR] : []),
            ...(state?.namespaces ?? []).map((_, i) => nsAttr(i)),
          ];
        this.xmlDocExtras_ = extras;
        this.xmlNamespaces_ = [...(state?.namespaces ?? [])];
        if (state?.version) this.xmlDocVersion_ = state.version;
        if (state?.encoding) this.xmlDocEncoding_ = state.encoding;
        if (state?.standalone) this.xmlDocStandalone_ = state.standalone;
        this.updateXmlDocumentShape_?.();
        if (state?.instanceRoot) applyXmlInstanceRootCap(this);
      },
      decompose: function (this: XmlDocumentBlock, workspace: Blockly.Workspace) {
        return stackXmlDocMutatorItems(workspace, this.xmlDocExtras_ ?? [DECL_ATTR]);
      },
      compose: function (this: XmlDocumentBlock, container: Block) {
        this.syncNamespacesFromFields_?.();
        this.xmlDocExtras_ = namesFromMutatorStack(container);
        this.updateXmlDocumentShape_?.();
      },
      saveConnections: function (this: Block, _container: Block) {
        // Declaration/namespace rows are fields, not block mouths.
      },
      updateXmlDocumentShape_: function (this: XmlDocumentBlock) {
        const extras = this.xmlDocExtras_ ?? [DECL_ATTR];
        const showDecl = extras.includes(DECL_ATTR);
        const showStandalone = extras.includes(STANDALONE_ATTR);
        const nsNames = extras.filter(isNsAttr);

        const version = this.xmlDocVersion_ ?? String(this.getFieldValue("VERSION") || "1.0");
        const encoding = this.xmlDocEncoding_ ?? String(this.getFieldValue("ENCODING") || "UTF-8");
        const standalone = this.xmlDocStandalone_ ?? String(this.getFieldValue("STANDALONE") || "");
        this.syncNamespacesFromFields_?.();

        if (this.getInput("DECL")) this.removeInput("DECL", true);
        if (this.getInput("STANDALONE_ROW")) this.removeInput("STANDALONE_ROW", true);
        for (const input of [...this.inputList]) {
          if (input.name.startsWith("NS_")) this.removeInput(input.name, true);
        }

        const before = XML_ROOT_INPUT;
        if (showDecl) {
          this.appendDummyInput("DECL")
            .appendField("version")
            .appendField(
              new Blockly.FieldDropdown([["1.0", "1.0"], ["1.1", "1.1"]]),
              "VERSION",
            )
            .appendField("encoding")
            .appendField(new Blockly.FieldTextInput(encoding), "ENCODING");
          this.setFieldValue(version === "1.1" ? "1.1" : "1.0", "VERSION");
          this.moveInputBefore("DECL", before);
        }
        if (showStandalone) {
          this.appendDummyInput("STANDALONE_ROW")
            .appendField("standalone")
            .appendField(
              new Blockly.FieldDropdown([["—", ""], ["yes", "yes"], ["no", "no"]]),
              "STANDALONE",
            );
          this.setFieldValue(
            standalone === "yes" || standalone === "no" ? standalone : "",
            "STANDALONE",
          );
          this.moveInputBefore("STANDALONE_ROW", before);
        }
        for (const name of nsNames) {
          const i = nsIndex(name);
          const stored = this.xmlNamespaces_?.[i] ?? { prefix: "", uri: "" };
          const inputName = `NS_${name}`;
          this.appendDummyInput(inputName)
            .appendField("xmlns")
            .appendField(new Blockly.FieldTextInput(stored.prefix), `PREFIX_${name}`)
            .appendField("=")
            .appendField(new Blockly.FieldTextInput(stored.uri), `URI_${name}`);
          this.moveInputBefore(inputName, before);
        }
      },
      syncNamespacesFromFields_: function (this: XmlDocumentBlock) {
        const extras = this.xmlDocExtras_ ?? [];
        const namespaces: XmlNamespaceDecl[] = [];
        for (const name of extras.filter(isNsAttr)) {
          namespaces[nsIndex(name)] = {
            prefix: String(this.getFieldValue(`PREFIX_${name}`) ?? ""),
            uri: String(this.getFieldValue(`URI_${name}`) ?? ""),
          };
        }
        this.xmlNamespaces_ = namespaces.filter(Boolean);
        this.xmlDocVersion_ = String(this.getFieldValue("VERSION") || this.xmlDocVersion_ || "1.0");
        this.xmlDocEncoding_ = String(this.getFieldValue("ENCODING") || this.xmlDocEncoding_ || "UTF-8");
        this.xmlDocStandalone_ = String(
          this.getFieldValue("STANDALONE") || this.xmlDocStandalone_ || "",
        );
      },
    },
    bindXmlDocumentMutator,
    xmlDocFlyoutContents,
    (block: BlockSvg) => (block as XmlDocumentBlock).xmlDocExtras_ ?? [DECL_ATTR],
  );
}

declare module "blockly/core" {
  interface Block {
    xmlDocExtras_?: string[];
    xmlNamespaces_?: XmlNamespaceDecl[];
    xmlDocVersion_?: string;
    xmlDocEncoding_?: string;
    xmlDocStandalone_?: string;
    updateXmlDocumentShape_?: () => void;
    syncNamespacesFromFields_?: () => void;
  }
}

/** Apply a mutator stack (tests). */
export function composeXmlDocumentOptions(block: Block, names: string[]): void {
  if (!block.decompose || !block.compose) return;
  const bubble = new Blockly.Workspace();
  try {
    const container = block.decompose(bubble);
    let item: Block | null = container.getInputTargetBlock("STACK");
    while (item) {
      const next = item.getNextBlock();
      item.dispose(false);
      item = next;
    }
    let connection = container.getInput("STACK")?.connection ?? null;
    for (const name of names) {
      const quark = bubble.newBlock(XML_DOCUMENT_MUTATOR_ITEM);
      quark.initSvg?.();
      applyMutatorItemLabel(quark, name, labelForXmlDocAttr(name));
      if (connection && quark.previousConnection) {
        connection.connect(quark.previousConnection);
        connection = quark.nextConnection;
      }
    }
    block.compose(container);
  } finally {
    bubble.dispose();
  }
}
