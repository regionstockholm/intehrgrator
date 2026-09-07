import { Blockly } from "../blockly_core.ts";
import type { Block } from "blockly/core";
import { FieldSkeletonTitle } from "../field_skeleton_title.ts";
import { findSkeletonNode } from "../schema_catalog.ts";
import { appendSlotLabel } from "../slot_label.ts";
import { registerSchemaFieldsMutator, SCHEMA_FIELDS_MUTATOR } from "./schema_mutator.ts";
import type { SchemaInputSpec } from "../../core/target/schema_block_ids.ts";

const TARGET_STRUCTURE_COLOUR = "#4B5563";
const TARGET_VALUE_COLOUR = "#6B7280";
const JSON_COLOUR = "#D97706";
const XML_COLOUR = "#0284C7";
export const TARGET_CHILD_PREFIX = "TARGET_";

export const JSON_BLOCK_TYPES = ["json_object", "json_array", "json_value", "json_boolean", "json_null"] as const;
export const XML_BLOCK_TYPES = ["xml_element", "xml_text", "xml_attribute"] as const;
export const GENERIC_VALUE_BLOCK_TYPES = [
  "target_value",
  "json_value",
  "json_boolean",
  "json_null",
  "xml_text",
  "xml_attribute",
] as const;

export function ensureSchemaStructureType(typeId: string, colour = TARGET_STRUCTURE_COLOUR): void {
  defineStructureBlock(typeId, typeId.replace(/^schema_/, "") || "schema", colour, typeId, {
    withSchemaMutator: true,
  });
}

export function applySchemaConnectionMode(
  block: Block,
  mode: "statement" | "value",
  typeCheck: string,
): void {
  if (mode === "value") {
    if (block.previousConnection?.isConnected()) block.previousConnection.disconnect();
    if (block.nextConnection?.isConnected()) block.nextConnection.disconnect();
    block.setPreviousStatement(false);
    block.setNextStatement(false);
    block.setOutput(true, typeCheck);
  } else {
    if (block.outputConnection?.isConnected()) block.outputConnection.disconnect();
    block.setOutput(false);
    block.setPreviousStatement(true, typeCheck);
    block.setNextStatement(true, typeCheck);
  }
  (block as Block & { schemaConnectionMode_?: string }).schemaConnectionMode_ = mode;
  (block as Block & { schemaTypeCheck_?: string }).schemaTypeCheck_ = typeCheck;
}

export function registerTargetBlocks(): void {
  registerSchemaFieldsMutator();
  defineStructureBlock("target_structure", "target", TARGET_STRUCTURE_COLOUR, "Target structure", {
    withSchemaMutator: true,
  });
  defineValueBlock("target_value", "value", TARGET_VALUE_COLOUR, "Target value slot");

  defineStructureBlock("json_object", "JSON object", JSON_COLOUR, "Generic JSON object");
  defineStructureBlock("json_array", "JSON array", JSON_COLOUR, "Generic JSON array");
  defineValueBlock("json_value", "JSON value", JSON_COLOUR, "Generic JSON value");
  defineValueBlock("json_boolean", "JSON boolean", JSON_COLOUR, "Generic JSON boolean");
  defineValueBlock("json_null", "JSON null", JSON_COLOUR, "Generic JSON null");

  defineStructureBlock("xml_element", "element", XML_COLOUR, "Generic XML element", {
    editableName: true,
    namePrefix: "XML",
    defaultChildGroup: "children",
  });
  defineValueBlock("xml_text", "XML text", XML_COLOUR, "Generic XML text node");
  defineXmlAttribute();
}

export function isSchemaStructureBlock(block: { type: string }): boolean {
  return block.type === "target_structure" || block.type.startsWith("schema_");
}

export function isGenericValueBlockType(type: string): boolean {
  return (GENERIC_VALUE_BLOCK_TYPES as readonly string[]).includes(type);
}

function defineStructureBlock(
  type: string,
  defaultName: string,
  colour: string,
  tooltip: string,
  options?: {
    withSchemaMutator?: boolean;
    editableName?: boolean;
    namePrefix?: string;
    defaultChildGroup?: string;
  },
): void {
  if (Blockly.Blocks[type]) return;
  const defaultChildGroup = options?.defaultChildGroup;
  const blockDef: Record<string, unknown> = {
    init: function (this: Block) {
      const header = this.appendDummyInput("HEADER");
      if (options?.namePrefix) header.appendField(options.namePrefix);
      if (options?.editableName) {
        header.appendField(new Blockly.FieldTextInput(defaultName), "NAME");
      } else {
        header.appendField(new FieldSkeletonTitle("", defaultName), "NAME");
      }
      header.appendField(new Blockly.FieldLabelSerializable(""), "TARGET_TYPE");
      this.getField("TARGET_TYPE")?.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "SLOT_ID");
      this.getField("SLOT_ID")?.setVisible(false);
      if (defaultChildGroup) {
        this.appendStatementInput(targetChildInputName(defaultChildGroup))
          .setAlign(inputAlignRight())
          .appendField(defaultChildGroup);
      }
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(colour);
      this.setTooltip(tooltip);
      if (options?.withSchemaMutator) {
        Blockly.Extensions.apply(SCHEMA_FIELDS_MUTATOR, this, true);
      }
    },
  };
  if (!options?.withSchemaMutator) {
    /**
     * Dynamic TARGET_* statement mouths are not in `init()`, so Blockly
     * JSON serialization needs extraState or a minimap copy / Mapping Spec
     * reload will throw "missing a(n) TARGET_… connection".
     */
    blockDef.saveExtraState = function (this: Block) {
      const childGroups = this.inputList
        .filter((input) => input.name.startsWith(TARGET_CHILD_PREFIX))
        .map((input) => input.name.slice(TARGET_CHILD_PREFIX.length));
      return childGroups.length ? { childGroups } : null;
    };
    blockDef.loadExtraState = function (this: Block, state: unknown) {
      const raw = state && typeof state === "object"
        ? (state as { childGroups?: unknown }).childGroups
        : undefined;
      const childGroups = Array.isArray(raw)
        ? raw.filter((group): group is string => typeof group === "string" && group.length > 0)
        : [];
      const groups = defaultChildGroup && !childGroups.includes(defaultChildGroup)
        ? [defaultChildGroup, ...childGroups]
        : childGroups.length
        ? childGroups
        : defaultChildGroup
        ? [defaultChildGroup]
        : [];
      syncTargetChildInputs(this, groups);
    };
  }
  Blockly.Blocks[type] = blockDef;
}

function defineValueBlock(
  type: string,
  defaultName: string,
  colour: string,
  tooltip: string,
): void {
  if (Blockly.Blocks[type]) return;
  Blockly.Blocks[type] = {
    init: function (this: Block) {
      this.appendDummyInput("HEADER")
        .appendField(new FieldSkeletonTitle("", defaultName), "NAME")
        .appendField(new Blockly.FieldLabelSerializable(""), "TARGET_TYPE");
      this.getField("TARGET_TYPE")?.setVisible(false);
      this.appendValueInput("VALUE").setCheck(null).appendField("value");
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "SLOT_ID");
      this.getField("SLOT_ID")?.setVisible(false);
      appendHiddenTargetMandatory(this);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(colour);
      this.setTooltip(tooltip);
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
        .appendField(new Blockly.FieldTextInput("attr"), "NAME")
        .appendField(new Blockly.FieldLabelSerializable(""), "TARGET_TYPE");
      this.getField("TARGET_TYPE")?.setVisible(false);
      this.appendValueInput("VALUE").setCheck(null).appendField("value");
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "SLOT_ID");
      this.getField("SLOT_ID")?.setVisible(false);
      appendHiddenTargetMandatory(this);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(XML_COLOUR);
      this.setTooltip("XML attribute on the parent element");
      this.setInputsInline(true);
    },
  };
}

function appendHiddenTargetMandatory(block: Block): void {
  if (block.getField("MANDATORY")) return;
  block.appendDummyInput()
    .appendField(new Blockly.FieldLabelSerializable(""), "MANDATORY");
  block.getField("MANDATORY")?.setVisible(false);
}

/** Blockly Align.RIGHT — attribute captions sit just left of their mouth. */
function inputAlignRight(): number {
  return (Blockly.inputs?.Align?.RIGHT ?? 1) as number;
}

export function appendSchemaFieldInput(
  block: Block,
  field: SchemaInputSpec,
  inputName: string,
): void {
  const input = field.kind === "value"
    ? block.appendValueInput(inputName)
    : block.appendStatementInput(inputName);
  input.setAlign(inputAlignRight());
  if (field.check) input.setCheck(field.check);
  appendSlotLabel(input, field.name, {
    card: field.card,
    documentation: field.documentation,
    rmType: field.childBlockType,
  });
}

export function syncSchemaFieldInputs(block: Block, fields: SchemaInputSpec[]): void {
  for (const input of [...block.inputList]) {
    if (input.name.startsWith(TARGET_CHILD_PREFIX)) block.removeInput(input.name);
  }
  for (const field of fields) {
    appendSchemaFieldInput(block, field, targetChildInputName(field.name));
  }
}

export function syncTargetChildInputs(
  block: Block,
  childGroups: string[],
): void {
  for (const input of [...block.inputList]) {
    if (input.name.startsWith(TARGET_CHILD_PREFIX)) block.removeInput(input.name);
  }
  const docs = schemaChildDocumentation(block);
  for (const group of childGroups) {
    const input = block.appendStatementInput(targetChildInputName(group))
      .setAlign(inputAlignRight());
    appendSlotLabel(input, group, { documentation: docs.get(group) });
  }
}

/** Property/element docs from the scaffold catalog (JSON Schema / XSD). */
function schemaChildDocumentation(block: Block): Map<string, string> {
  const out = new Map<string, string>();
  const slotId = String(block.getFieldValue("SLOT_ID") ?? "");
  const parent = slotId ? findSkeletonNode(slotId) : undefined;
  if (!parent) return out;
  for (const child of parent.children) {
    const name = child.rmAttribute ?? child.label;
    const text = child.documentation?.trim();
    if (name && text) out.set(name, text);
  }
  return out;
}

export function targetChildInputName(group: string): string {
  return `${TARGET_CHILD_PREFIX}${group}`;
}

/** Mandatory TARGET_* and optional SCHEMA_OPT_* field names on a target_structure block. */
export function presentTargetFieldNames(block: Block): string[] {
  const names: string[] = [];
  for (const input of block.inputList) {
    if (input.name.startsWith(TARGET_CHILD_PREFIX)) {
      names.push(input.name.slice(TARGET_CHILD_PREFIX.length));
    } else if (input.name.startsWith("SCHEMA_OPT_")) {
      names.push(input.name.slice("SCHEMA_OPT_".length));
    }
  }
  return names;
}
