import { Blockly } from "../blockly_core.ts";
import type { BlockSvg } from "blockly/core";
import "blockly/blocks";
import { mandatoryAttributesFor } from "../../core/rm_mandatory.ts";
import {
  attributesFor,
  baseRmTypeName,
  blocklyCheckForPrimitiveType,
  blockTypeForRm,
  dataValueLeafTypes,
  isDataValueType,
  isPrimitiveRmType,
  isRmValueAttribute,
  isSubtypeOf,
  mandatoryAttributes,
  optionalAttributes,
  primaryMappingAttribute,
  subtypesOf,
  type RmAttributeMeta,
} from "../../core/rm_meta.ts";
import { blocklyCheckForDv } from "../block_checks.ts";
import {
  appendBlockOutputEmoji,
  appendSlotTypeEmoji,
  isRmTypeEmojiField,
  BLOCK_OUT_EMOJI_FIELD,
  slotRmTypeForAttr,
} from "../rm_type_emoji.ts";
import {
  appendSlotCardinality,
  parseSlotCardinality,
  rmAttributeCardinality,
  type SlotCardinality,
} from "../slot_cardinality.ts";
import { registerTermPickBlock } from "./term_pick.ts";

export const EVENT_KIND_OPTIONS: Array<[string, string]> = [
  ["EVENT", "EVENT"],
  ["POINT_EVENT", "POINT_EVENT"],
  ["INTERVAL_EVENT", "INTERVAL_EVENT"],
];

export const OPTIONAL_INPUT_PREFIX = "OPT_";
const OPTIONAL_DV_FIELD_PREFIX = "OPTFLD_";
export const RM_ATTR_INPUT_PREFIX = "ATTR_";
export const DV_FIELD_PREFIX = "FLD_";
/** Puzzle slot on abstract PARTY_PROXY for a concrete subclass. */
export const RM_SPECIALIZATION_INPUT = "KIND";

const STRUCTURE_COLOUR = "#003B49";
const CONTAINER_COLOUR = "#005C53";
const DV_COLOUR = "#4A6FA5";
const ELEMENT_COLOUR = "#3D7A6A";

const RM_CONTAINER_TYPES = new Set<string>();

const EXTRA_RM_CONTAINERS = [
  "HISTORY",
  "EVENT",
  "POINT_EVENT",
  "INTERVAL_EVENT",
  "EVENT_CONTEXT",
  "ITEM_TREE",
  "ITEM_LIST",
  "ITEM_TABLE",
  "ITEM_SINGLE",
  "ACTIVITY",
  "PARTY_IDENTIFIED",
  "PARTY_SELF",
  "PARTY_RELATED",
  "PARTY_PROXY",
  "PARTICIPATION",
  "FEEDER_AUDIT",
  "FEEDER_AUDIT_DETAILS",
  "ISM_TRANSITION",
  "LINK",
  "ARCHETYPED",
  "GENERIC_ENTRY",
];

export function isEventFamilyType(rmType: string): boolean {
  const name = (rmType || "").toUpperCase();
  return name === "EVENT" || isSubtypeOf(name, "EVENT");
}

export function isRmContainerBlockType(type: string): boolean {
  if (RM_CONTAINER_TYPES.has(type) || type === "element") return true;
  return EXTRA_RM_CONTAINERS.some((rmType) => blockTypeForRm(rmType) === type) ||
    [
      "composition",
      "section",
      "observation",
      "evaluation",
      "instruction",
      "action",
      "admin_entry",
      "cluster",
    ].includes(type);
}

export function optionalRmInputName(attr: string): string {
  return `${OPTIONAL_INPUT_PREFIX}${attr}`;
}

export function registerRmBlocks(): void {
  defineContainerBlock("composition", "COMPOSITION", [
    { name: "language" },
    { name: "territory" },
    { name: "category" },
    { name: "composer" },
    { name: "content", check: "CONTENT_ITEM" },
    { name: "context", check: "EVENT_CONTEXT" },
  ], CONTAINER_COLOUR, { expandable: true, rmType: "COMPOSITION" });

  defineContainerBlock("section", "SECTION", [
    { name: "items", check: "CONTENT_ITEM" },
  ], CONTAINER_COLOUR, {
    expandable: true,
    rmType: "SECTION",
    nestCheck: "CONTENT_ITEM",
  });

  defineContainerBlock("observation", "OBSERVATION", [
    { name: "data" },
    { name: "state" },
    { name: "protocol" },
  ], STRUCTURE_COLOUR, {
    expandable: true,
    rmType: "OBSERVATION",
    nestCheck: "CONTENT_ITEM",
  });

  defineContainerBlock("evaluation", "EVALUATION", [
    { name: "data" },
    { name: "protocol" },
  ], STRUCTURE_COLOUR, {
    expandable: true,
    rmType: "EVALUATION",
    nestCheck: "CONTENT_ITEM",
  });

  defineContainerBlock("instruction", "INSTRUCTION", [
    { name: "activities" },
    { name: "protocol" },
  ], STRUCTURE_COLOUR, {
    expandable: true,
    rmType: "INSTRUCTION",
    nestCheck: "CONTENT_ITEM",
  });

  defineContainerBlock("action", "ACTION", [
    { name: "description" },
    { name: "protocol" },
  ], STRUCTURE_COLOUR, {
    expandable: true,
    rmType: "ACTION",
    nestCheck: "CONTENT_ITEM",
  });

  defineContainerBlock("admin_entry", "ADMIN_ENTRY", [
    { name: "data" },
  ], STRUCTURE_COLOUR, {
    expandable: true,
    rmType: "ADMIN_ENTRY",
    nestCheck: "CONTENT_ITEM",
  });

  defineContainerBlock("cluster", "CLUSTER", [
    { name: "items" },
  ], STRUCTURE_COLOUR, {
    expandable: true,
    rmType: "CLUSTER",
    nestCheck: ["ITEM", "CLUSTER", "ELEMENT"],
  });

  defineValueElementBlock();
  definePartyProxyBlock();
  for (const rmType of EXTRA_RM_CONTAINERS) {
    ensureRmContainerBlock(rmType);
  }
  defineDataValueBlocksFromMeta();
  defineCodePhraseBlock();
  registerTermPickBlock();
  registerOptionalRmMutator();
  registerDvFieldsMutator();
}

export function ensureRmBlockType(blockType: string, rmType: string): void {
  if (Blockly.Blocks[blockType]) return;
  if (rmType.startsWith("DV_") || rmType === "CODE_PHRASE" || isDataValueType(rmType)) {
    defineDataValueBlock(rmType);
    return;
  }
  ensureRmContainerBlock(rmType);
}

function ensureRmContainerBlock(rmType: string): string {
  const type = blockTypeForRm(rmType);
  if (Blockly.Blocks[type]) {
    RM_CONTAINER_TYPES.add(type);
    return type;
  }
  const inputs = attributesFor(rmType)
    .filter((attr) => !isPrimitiveRmType(baseRmTypeName(attr.typeName)))
    .filter((attr) => attr.mandatory)
    .map((attr) => ({ name: attr.name }));
  defineContainerBlock(type, rmType, inputs, STRUCTURE_COLOUR, {
    expandable: true,
    rmType,
    nestCheck: nestCheckFor(rmType),
  });
  return type;
}

function nestCheckFor(rmType: string): string | string[] | null {
  if (rmType === "COMPOSITION") return null;
  if (isSubtypeOf(rmType, "CONTENT_ITEM")) return "CONTENT_ITEM";
  if (isSubtypeOf(rmType, "ITEM")) return ["ITEM", "CLUSTER", "ELEMENT"];
  if (isSubtypeOf(rmType, "EVENT") || rmType === "EVENT") return "EVENT";
  if (rmType === "GENERIC_ENTRY") return "CONTENT_ITEM";
  if (rmType === "HISTORY") return "HISTORY";
  if (isSubtypeOf(rmType, "ITEM_STRUCTURE")) {
    return ["ITEM_STRUCTURE", "ITEM_TREE", "ITEM_LIST", "ITEM_TABLE", "ITEM_SINGLE"];
  }
  if (isSubtypeOf(rmType, "PARTY_PROXY")) return partyProxyNestCheck(rmType);
  if (rmType === "EVENT_CONTEXT") return "EVENT_CONTEXT";
  if (rmType === "ACTIVITY") return "ACTIVITY";
  return rmType;
}

/** Blockly output types: own class plus PARTY_PROXY ancestors so slots match. */
function partyProxyNestCheck(rmType: string): string | string[] {
  const checks = new Set<string>([rmType, "PARTY_PROXY"]);
  if (isSubtypeOf(rmType, "PARTY_IDENTIFIED")) checks.add("PARTY_IDENTIFIED");
  const list = [...checks];
  return list.length === 1 ? list[0]! : list;
}

function partyProxySpecializationCheck(): string[] {
  return subtypesOf("PARTY_PROXY", { concreteOnly: true }).slice().sort();
}

function definePartyProxyBlock(): void {
  defineContainerBlock("party_proxy", "PARTY_PROXY", [], STRUCTURE_COLOUR, {
    expandable: true,
    rmType: "PARTY_PROXY",
    nestCheck: nestCheckFor("PARTY_PROXY"),
    specializationCheck: partyProxySpecializationCheck(),
  });
}

/** Blockly type for a DATA_VALUE leaf, ensuring the def exists. */
export function ensureDataValueBlock(rmType: string): string {
  const type = blockTypeForRm(rmType);
  if (!Blockly.Blocks[type]) {
    defineDataValueBlock(rmType);
  }
  return type;
}

/** Ordered RM attribute names for statement inputs on a container block. */
export function orderedRmAttributes(rmType: string, present: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const meta = attributesFor(rmType);
  const mandatoryNames = meta.filter((a) => a.mandatory).map((a) => a.name);
  const optionalNames = meta.filter((a) => !a.mandatory).map((a) => a.name);
  const preferred = [...mandatoryNames, ...optionalNames];
  const fallback = preferred.length ? preferred : mandatoryAttributesFor(rmType);

  for (const attr of fallback) {
    if (present.includes(attr) && !seen.has(attr)) {
      ordered.push(attr);
      seen.add(attr);
    }
  }
  for (const attr of present) {
    if (!seen.has(attr)) {
      ordered.push(attr);
      seen.add(attr);
    }
  }
  return ordered;
}

/** Replace dynamic RM-attribute statement inputs (labels = lowercase RM names). */
export function syncRmAttributeInputs(
  block: Blockly.Block,
  rmType: string,
  attributes: string[],
  cardinalities?: Record<string, SlotCardinality>,
): void {
  const saved = snapshotAttributeConnections(block);
  for (const input of [...block.inputList]) {
    if (input.name.startsWith(RM_ATTR_INPUT_PREFIX)) {
      block.removeInput(input.name);
    }
  }
  for (const attr of orderedRmAttributes(rmType, attributes)) {
    appendRmAttributeInput(
      block,
      rmType,
      attr,
      undefined,
      cardinalities?.[attr] ?? slotCardinalityFor(block, rmType, attr),
    );
  }
  restoreAttributeConnections(block, saved);
  ensurePlusButton(block);
}

/**
 * Switch an EVENT-family block between EVENT / POINT_EVENT / INTERVAL_EVENT
 * without dropping already-attached children. Extra INTERVAL_EVENT fields
 * appear when needed; filled extras are kept if the user switches away.
 */
export function applyEventRmType(block: Blockly.Block, newType: string): void {
  const next = (newType || "").toUpperCase();
  if (!isEventFamilyType(next)) return;

  const current = String(block.getFieldValue("RM_TYPE") || "").toUpperCase();
  if (current !== next && block.getField("RM_TYPE")) {
    block.setFieldValue(next, "RM_TYPE");
  }

  const emoji = block.getField(BLOCK_OUT_EMOJI_FIELD);
  if (isRmTypeEmojiField(emoji)) emoji.setRmType(next);

  const connected = presentAttributeNames(block).filter((name) =>
    Boolean(
      block.getInput(rmAttributeInputName(name))?.connection?.targetBlock() ||
        block.getInput(optionalRmInputName(name))?.connection?.targetBlock(),
    )
  );
  const show = eventAttributesToShow(next, connected);
  const cards = { ...(block.slotCardinalities_ ?? {}) };
  syncRmAttributeInputs(block, next, show, cards);
  if (typeof block.render === "function" && typeof document !== "undefined") {
    block.render();
  }
}

function eventAttributesToShow(rmType: string, connected: string[]): string[] {
  const names = new Set<string>(connected);
  for (const attr of ["time", "data"]) names.add(attr);
  if (rmType === "INTERVAL_EVENT") {
    names.add("width");
    names.add("math_function");
    names.add("sample_count");
  }
  return [...names];
}

function slotCardinalityFor(
  block: Blockly.Block,
  rmType: string,
  attr: string,
): SlotCardinality | undefined {
  return block.slotCardinalities_?.[attr] ??
    rmAttributeCardinality(rmType, attr) ??
    parseSlotCardinality("0..1");
}

function snapshotAttributeConnections(
  block: Blockly.Block,
): Record<string, Blockly.Block[]> {
  const saved: Record<string, Blockly.Block[]> = {};
  for (const input of [...block.inputList]) {
    if (!input.name.startsWith(RM_ATTR_INPUT_PREFIX)) continue;
    const attr = input.name.slice(RM_ATTR_INPUT_PREFIX.length);
    const first = input.connection?.targetBlock();
    if (!first) continue;
    const chain: Blockly.Block[] = [];
    if (first.outputConnection && !first.previousConnection) {
      first.outputConnection.disconnect();
      chain.push(first);
    } else {
      let current: Blockly.Block | null = first;
      while (current) {
        const next = current.getNextBlock();
        if (current.nextConnection?.isConnected()) current.nextConnection.disconnect();
        if (current.previousConnection?.isConnected()) {
          current.previousConnection.disconnect();
        }
        chain.push(current);
        current = next;
      }
    }
    saved[attr] = chain;
  }
  return saved;
}

function restoreAttributeConnections(
  block: Blockly.Block,
  saved: Record<string, Blockly.Block[]>,
): void {
  for (const [attr, blocks] of Object.entries(saved)) {
    const input = block.getInput(rmAttributeInputName(attr)) ??
      block.getInput(optionalRmInputName(attr));
    if (!input?.connection || !blocks.length) continue;
    const head = blocks[0]!;
    const headConn = head.outputConnection && !head.previousConnection
      ? head.outputConnection
      : head.previousConnection;
    if (headConn) tryConnect(input, headConn);
    let previous = head;
    for (const child of blocks.slice(1)) {
      if (previous.nextConnection && child.previousConnection) {
        try {
          previous.nextConnection.connect(child.previousConnection);
        } catch {
          /* type mismatch */
        }
      }
      previous = child;
    }
  }
}

function tryConnect(
  input: Blockly.Input,
  childConn: Blockly.Connection,
): void {
  const parentConn = input.connection;
  if (!parentConn) return;
  const attempt = (): void => {
    if (parentConn.isConnected()) parentConn.disconnect();
    parentConn.connect(childConn);
  };
  try {
    attempt();
  } catch {
    /* type check rejected */
  }
  if (parentConn.targetConnection === childConn) return;
  const prevCheck = parentConn.getCheck();
  input.setCheck(null);
  try {
    attempt();
  } catch {
    /* still incompatible */
  } finally {
    if (prevCheck) input.setCheck(prevCheck);
  }
}

function appendRmAttributeInput(
  block: Blockly.Block,
  rmType: string,
  attr: string,
  checkOverride?: string | string[] | null,
  cardinality?: SlotCardinality,
): void {
  const slotType = slotRmTypeForAttr(rmType, attr);
  const card = cardinality ?? slotCardinalityFor(block, rmType, attr);
  if (isRmValueAttribute(rmType, attr) || isPartyProxyType(slotType)) {
    const input = block.appendValueInput(rmAttributeInputName(attr))
      .appendField(attr);
    const check = checkOverride ?? puzzleCheckForAttr(rmType, attr, slotType);
    if (check) input.setCheck(check);
    appendSlotCardinality(input, card);
    appendSlotTypeEmoji(input, slotType);
    return;
  }
  const stmt = block.appendStatementInput(rmAttributeInputName(attr))
    .appendField(attr);
  const check = checkOverride ?? statementCheckForAttr(rmType, attr);
  if (check) stmt.setCheck(check);
  appendSlotCardinality(stmt, card);
  appendSlotTypeEmoji(stmt, slotType);
}

function puzzleCheckForAttr(
  _rmType: string,
  _attr: string,
  slotType: string | undefined,
): string | string[] | null {
  if (isPartyProxyType(slotType)) return slotType ?? "PARTY_PROXY";
  return slotType ? blocklyCheckForDv(slotType) : null;
}

function isPartyProxyType(rmType: string | undefined): boolean {
  return Boolean(rmType && isSubtypeOf(rmType, "PARTY_PROXY"));
}

function statementCheckForAttr(
  rmType: string,
  attr: string,
): string | string[] | null {
  const slotType = slotRmTypeForAttr(rmType, attr);
  if (!slotType || isPrimitiveRmType(slotType) || isDataValueType(slotType)) return null;
  return nestCheckFor(slotType) ?? slotType;
}

export function rmTypeOfBlock(block: Blockly.Block): string {
  return (block.getFieldValue("RM_TYPE") || block.type || "").toUpperCase();
}

export function presentAttributeNames(block: Blockly.Block): string[] {
  const names = new Set<string>(block.extraInputs_ ?? []);
  for (const input of block.inputList) {
    if (input.name.startsWith(RM_ATTR_INPUT_PREFIX)) {
      names.add(input.name.slice(RM_ATTR_INPUT_PREFIX.length));
    }
    if (input.name.startsWith(OPTIONAL_INPUT_PREFIX)) {
      names.add(input.name.slice(OPTIONAL_INPUT_PREFIX.length));
    }
  }
  return [...names];
}

export function rmAttributeInputName(attr: string): string {
  return `${RM_ATTR_INPUT_PREFIX}${attr}`;
}

export function dvFieldInputName(attr: string): string {
  return `${DV_FIELD_PREFIX}${attr}`;
}

/** ELEMENT.value accepts a typed DATA_VALUE shell (not raw expressions). */
export function configureElementValueSlot(block: Blockly.Block, rmType: string): void {
  const input = block.getInput("VALUE");
  if (!input) return;
  const check = blocklyCheckForDv(rmType);
  input.setCheck(check);
  appendSlotCardinality(input, { min: 1, max: 1 });
  appendSlotTypeEmoji(input, rmType);
}

/** Create (or return) the DATA_VALUE shell on an ELEMENT value input. */
export function ensureElementDataValueShell(
  workspace: Blockly.Workspace,
  elementBlock: Blockly.Block,
  rmType: string,
): Blockly.Block | null {
  const valueInput = elementBlock.getInput("VALUE");
  if (!valueInput?.connection) return null;

  const existing = valueInput.connection.targetBlock();
  if (existing && isDataValueBlock(existing)) {
    return existing;
  }
  if (existing) existing.dispose(false);

  const blockType = ensureDataValueBlock(rmType);
  const shell = workspace.newBlock(blockType);
  if (shell.getField("RM_TYPE")) {
    shell.setFieldValue(rmType, "RM_TYPE");
  }
  const slotId = elementBlock.getFieldValue("SLOT_ID");
  if (slotId && shell.getField("SLOT_ID")) {
    shell.setFieldValue(slotId, "SLOT_ID");
  }
  if (shell.outputConnection) {
    valueInput.connection.connect(shell.outputConnection);
  }
  if (typeof document !== "undefined") {
    const shellSvg = shell as BlockSvg;
    shellSvg.initSvg?.();
    shellSvg.render?.();
    const parentSvg = elementBlock as BlockSvg;
    if (typeof parentSvg.render === "function") parentSvg.render();
  }
  return shell;
}

/**
 * Pre-fill RM/template-constrained fields (e.g. terminology_id = ISO_639-1)
 * as Blockly shadow text so they are present from the first canvas.
 */
export function applyFixedFieldsToDataValueShell(
  workspace: Blockly.Workspace,
  shell: Blockly.Block,
  fields: Record<string, string> | undefined,
): void {
  if (!fields) return;
  const rmType = (shell.getFieldValue("RM_TYPE") || shell.type || "").toUpperCase();
  const isPhrase = shell.type === "code_phrase" || rmType === "CODE_PHRASE";

  if (isPhrase) {
    if (fields.terminology_id) {
      connectLiteralText(workspace, shell, dvFieldInputName("terminology_id"), fields.terminology_id);
    }
    const code = fields.code_string ?? fields.defining_code ?? fields.value;
    if (code) {
      connectLiteralText(workspace, shell, dvFieldInputName("code_string"), code);
    }
    return;
  }

  if (fields.value) {
    ensureDvFieldVisible(shell, "value");
    connectLiteralText(workspace, shell, dvFieldInputName("value"), fields.value);
  }

  if (fields.terminology_id || fields.defining_code || fields.code_string) {
    ensureDvFieldVisible(shell, "defining_code");
    const phrase = ensureNestedCodePhrase(workspace, shell, dvFieldInputName("defining_code"));
    if (phrase) {
      applyFixedFieldsToDataValueShell(workspace, phrase, {
        terminology_id: fields.terminology_id ?? "",
        code_string: fields.defining_code ?? fields.code_string ?? "",
      });
    }
  }
}

function ensureNestedCodePhrase(
  workspace: Blockly.Workspace,
  shell: Blockly.Block,
  inputName: string,
): Blockly.Block | null {
  const input = shell.getInput(inputName);
  if (!input?.connection) return null;
  const existing = input.connection.targetBlock();
  if (existing && (existing.type === "code_phrase" || existing.getFieldValue("RM_TYPE") === "CODE_PHRASE")) {
    return existing;
  }
  if (existing) return null;
  ensureRmBlockType("code_phrase", "CODE_PHRASE");
  const phrase = workspace.newBlock("code_phrase");
  if (phrase.outputConnection) {
    input.connection.connect(phrase.outputConnection);
  }
  if (typeof document !== "undefined") {
    const svg = phrase as BlockSvg;
    svg.initSvg?.();
    svg.render?.();
  }
  return phrase;
}

function connectLiteralText(
  _workspace: Blockly.Workspace,
  parent: Blockly.Block,
  inputName: string,
  value: string,
): void {
  if (!value) return;
  const input = parent.getInput(inputName);
  if (!input?.connection) return;
  if (input.connection.targetBlock()) return;
  if (typeof input.connection.setShadowState === "function") {
    input.connection.setShadowState({
      type: "text",
      fields: { TEXT: value },
    });
    return;
  }
  const text = _workspace.newBlock("text");
  text.setFieldValue(value, "TEXT");
  if (text.outputConnection) input.connection.connect(text.outputConnection);
}

export function isDataValueBlock(block: Blockly.Block): boolean {
  const rm = block.getFieldValue("RM_TYPE") || "";
  return block.type.startsWith("dv_") || rm.startsWith("DV_") || block.type === "code_phrase";
}

/** Attach an expression block into the primary mapping field of a DV shell. */
export function connectExpressionToDataValueShell(
  shell: Blockly.Block,
  exprBlock: Blockly.Block,
): boolean {
  const rmType = shell.getFieldValue("RM_TYPE") || shell.type.toUpperCase();
  const primary = primaryMappingAttribute(rmType);
  if (!primary) return false;
  ensureDvFieldVisible(shell, primary.name);
  const input = shell.getInput(dvFieldInputName(primary.name));
  if (!input?.connection) return false;
  const existing = input.connection.targetBlock();
  if (existing) existing.dispose(false);
  if (exprBlock.outputConnection) {
    input.connection.connect(exprBlock.outputConnection);
  }
  return true;
}

export function expressionBlockFromDataValueShell(
  shell: Blockly.Block | null,
): Blockly.Block | null {
  if (!shell) return null;
  const rmType = shell.getFieldValue("RM_TYPE") || "";
  const primary = primaryMappingAttribute(rmType);
  if (!primary) return null;
  return shell.getInputTargetBlock(dvFieldInputName(primary.name));
}

type StatementInputDef = {
  name: string;
  check?: string | string[] | null;
};

function defineContainerBlock(
  type: string,
  label: string,
  inputs: StatementInputDef[],
  colour: string,
  options: {
    expandable?: boolean;
    rmType: string;
    nestCheck?: string | string[] | null;
    specializationCheck?: string | string[] | null;
  },
): void {
  RM_CONTAINER_TYPES.add(type);
  Blockly.Blocks[type] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER");
      appendBlockOutputEmoji(header, options.rmType);
      if (isEventFamilyType(options.rmType)) {
        header.appendField(new Blockly.FieldDropdown(EVENT_KIND_OPTIONS), "RM_TYPE");
        this.setFieldValue(options.rmType, "RM_TYPE");
      } else {
        header.appendField(label, "RM_CLASS");
      }
      header
        .appendField(new Blockly.FieldLabel(""), "NAME")
        .appendField(new Blockly.FieldLabel("", undefined, { class: "blockly-at-code" }), "AT_CODE");
      if (options.expandable) {
        appendPlusField(this);
      }
      if (options.specializationCheck) {
        const kind = this.appendValueInput(RM_SPECIALIZATION_INPUT);
        kind.setCheck(options.specializationCheck);
        appendSlotTypeEmoji(kind, options.rmType);
      }
      for (const input of inputs) {
        appendRmAttributeInput(this, options.rmType, input.name, input.check);
      }
      this.appendDummyInput()
        .appendField(new Blockly.FieldLabelSerializable(""), "SLOT_ID");
      this.getField("SLOT_ID")!.setVisible(false);
      if (!isEventFamilyType(options.rmType)) {
        this.appendDummyInput()
          .appendField(new Blockly.FieldLabelSerializable(options.rmType), "RM_TYPE");
        this.getField("RM_TYPE")!.setVisible(false);
      }
      appendHiddenLabel(this, "MANDATORY", "");
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "ARCHETYPE_NODE_ID");
      this.getField("ARCHETYPE_NODE_ID")!.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "ARCHETYPE_CTX");
      this.getField("ARCHETYPE_CTX")!.setVisible(false);
      this.setColour(colour);
      this.setTooltip(`openEHR RM ${options.rmType}`);
      this.setInputsInline(true);
      if (isPartyProxyType(options.rmType)) {
        this.setOutput(true, options.nestCheck ?? options.rmType);
      } else if (options.nestCheck) {
        this.setPreviousStatement(true, options.nestCheck);
        this.setNextStatement(true, options.nestCheck);
      }
      if (options.expandable) {
        Blockly.Extensions.apply("optional_rm_mutator", this, true);
      }
    },
  };
}

function defineValueElementBlock(): void {
  RM_CONTAINER_TYPES.add("element");
  Blockly.Blocks["element"] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER");
      appendBlockOutputEmoji(header, "ELEMENT");
      header
        .appendField("ELEMENT")
        .appendField(new Blockly.FieldLabel(""), "NAME")
        .appendField(new Blockly.FieldLabel("", undefined, { class: "blockly-at-code" }), "AT_CODE");
      appendPlusField(this);
      const value = this.appendValueInput("VALUE")
        .setCheck(null)
        .appendField("value");
      appendSlotCardinality(value, { min: 1, max: 1 });
      appendSlotTypeEmoji(value, slotRmTypeForAttr("ELEMENT", "value"));
      this.appendDummyInput()
        .appendField(new Blockly.FieldLabelSerializable("ELEMENT"), "RM_TYPE");
      this.getField("RM_TYPE")!.setVisible(false);
      appendHiddenLabel(this, "MANDATORY", "");
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "SLOT_ID");
      this.getField("SLOT_ID")!.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "ARCHETYPE_NODE_ID");
      this.getField("ARCHETYPE_NODE_ID")!.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput(""), "ARCHETYPE_CTX");
      this.getField("ARCHETYPE_CTX")!.setVisible(false);
      this.setPreviousStatement(true, ["ITEM", "ELEMENT", "CLUSTER"]);
      this.setNextStatement(true, ["ITEM", "ELEMENT", "CLUSTER"]);
      this.setColour(ELEMENT_COLOUR);
      this.setTooltip("openEHR RM ELEMENT — named data item with a DATA_VALUE");
      this.setInputsInline(true);
      Blockly.Extensions.apply("optional_rm_mutator", this, true);
    },
  };
}

function defineDataValueBlocksFromMeta(): void {
  for (const rmType of dataValueLeafTypes()) {
    defineDataValueBlock(rmType);
  }
}

function defineDataValueBlock(rmType: string): void {
  const type = blockTypeForRm(rmType);
  if (Blockly.Blocks[type]) return;

  Blockly.Blocks[type] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER");
      appendBlockOutputEmoji(header, rmType);
      header.appendField(rmType.replace(/^DV_/, ""));
      this.appendDummyInput()
        .appendField(new Blockly.FieldLabelSerializable(""), "SLOT_ID");
      this.getField("SLOT_ID")!.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldLabelSerializable(rmType), "RM_TYPE");
      this.getField("RM_TYPE")!.setVisible(false);
      appendHiddenLabel(this, "MANDATORY", "");

      const mandatory = mandatoryAttributes(rmType).filter((a) =>
        isMappableField(a)
      );
      for (const attr of mandatory) {
        appendDvFieldInput(this, attr, false);
      }

      if (optionalAttributes(rmType).some((a) => isMappableField(a))) {
        appendPlusFieldsButton(this);
        Blockly.Extensions.apply("dv_fields_mutator", this, true);
        this.firePlusFieldsClick = () => revealNextOptionalDvField(this);
      }

      this.setOutput(true, blocklyCheckForDv(rmType));
      this.setColour(DV_COLOUR);
      this.setTooltip(rmType);
      this.setInputsInline(true);
    },
  };
}

function revealNextOptionalDvField(block: Blockly.Block): void {
  const rmType = block.getFieldValue("RM_TYPE");
  const visible = new Set([
    ...block.inputList
      .filter((i) => i.name.startsWith(DV_FIELD_PREFIX) || i.name.startsWith(OPTIONAL_DV_FIELD_PREFIX))
      .map((i) => i.name.replace(DV_FIELD_PREFIX, "").replace(OPTIONAL_DV_FIELD_PREFIX, "")),
  ]);
  const next = optionalAttributes(rmType).find((a) =>
    isMappableField(a) && !visible.has(a.name)
  );
  if (!next) return;
  block.extraDvFields_ = block.extraDvFields_ ?? [];
  if (!block.extraDvFields_.includes(next.name)) {
    block.extraDvFields_.push(next.name);
    block.updateDvFields_?.();
  }
}

let optionalRmPickHandler: ((block: Blockly.Block) => void) | null = null;

/** Host UI registers a picker for Optional RM Insertion (`+` on containers). */
export function setOptionalRmPickHandler(
  handler: ((block: Blockly.Block) => void) | null,
): void {
  optionalRmPickHandler = handler;
}

function wirePlusClick(block: Blockly.Block): void {
  block.firePlusClick = () => optionalRmPickHandler?.(block);
}

function appendClickableImage(
  _block: Blockly.Block,
  src: string,
  alt: string,
  onClick: () => void,
) {
  const field = new Blockly.FieldImage(src, 18, 18, alt, () => onClick());
  field.setOnClickHandler(() => onClick());
  return field;
}

function defineCodePhraseBlock(): void {
  if (Blockly.Blocks["code_phrase"]) return;
  Blockly.Blocks["code_phrase"] = {
    init: function (this: Blockly.Block) {
      const header = this.appendDummyInput("HEADER");
      appendBlockOutputEmoji(header, "CODE_PHRASE");
      header.appendField("CODE_PHRASE");
      const code = this.appendValueInput(dvFieldInputName("code_string"))
        .setCheck("String")
        .appendField("code");
      appendSlotTypeEmoji(code, "String");
      const terminology = this.appendValueInput(dvFieldInputName("terminology_id"))
        .setCheck("String")
        .appendField("terminology");
      appendSlotTypeEmoji(terminology, "String");
      this.setOutput(true, "CODE_PHRASE");
      this.setColour(DV_COLOUR);
      this.setInputsInline(true);
    },
  };
}

function isMappableField(attr: RmAttributeMeta): boolean {
  if (isPrimitiveRmType(attr.typeName)) return true;
  const base = attr.typeName.split("<")[0]!;
  return base === "CODE_PHRASE" || base === "Terminology_code";
}

function appendDvFieldInput(
  block: Blockly.Block,
  attr: RmAttributeMeta,
  optional: boolean,
): void {
  const name = optional
    ? `${OPTIONAL_DV_FIELD_PREFIX}${attr.name}`
    : dvFieldInputName(attr.name);
  if (block.getInput(name)) return;
  const check = blocklyCheckForPrimitiveType(attr.typeName) ??
    (attr.typeName.startsWith("CODE_PHRASE") || attr.typeName === "CODE_PHRASE"
      ? ["String", "CODE_PHRASE"]
      : "String");
  const input = block.appendValueInput(name)
    .setCheck(check)
    .appendField(attr.name);
  appendSlotTypeEmoji(input, baseRmTypeName(attr.typeName));
}

function ensureDvFieldVisible(block: Blockly.Block, attrName: string): void {
  if (block.getInput(dvFieldInputName(attrName))) return;
  if (block.getInput(`${OPTIONAL_DV_FIELD_PREFIX}${attrName}`)) return;
  const rmType = block.getFieldValue("RM_TYPE");
  const attr = attributesFor(rmType).find((a) => a.name === attrName);
  if (!attr) return;
  if (!attr.mandatory) {
    block.extraDvFields_ = block.extraDvFields_ ?? [];
    if (!block.extraDvFields_.includes(attrName)) {
      block.extraDvFields_.push(attrName);
      block.updateDvFields_?.();
    }
  }
}

function appendPlusField(block: Blockly.Block): void {
  if (block.getInput("PLUS")) return;
  wirePlusClick(block);
  block.appendDummyInput("PLUS")
    .appendField(appendClickableImage(
      block,
      "data:image/svg+xml," + encodeURIComponent(plusSvg()),
      "Add optional RM",
      () => block.firePlusClick?.(),
    ));
}

function ensurePlusButton(block: Blockly.Block): void {
  appendPlusField(block);
  try {
    Blockly.Extensions.apply("optional_rm_mutator", block, true);
  } catch {
    // already applied
  }
}

function appendPlusFieldsButton(block: Blockly.Block): void {
  if (block.getInput("PLUS_FIELDS")) return;
  block.appendDummyInput("PLUS_FIELDS")
    .appendField(appendClickableImage(
      block,
      "data:image/svg+xml," + encodeURIComponent(plusFieldsSvg()),
      "Add optional field",
      () => block.firePlusFieldsClick?.(),
    ));
}

function parseMutatorExtraState(
  state: { extras?: string[]; attrs?: string[] } | string | null,
): { extras: string[]; attrs: string[] } {
  if (state == null || state === "") return { extras: [], attrs: [] };
  const obj = typeof state === "string"
    ? JSON.parse(state) as { extras?: string[]; attrs?: string[] }
    : state;
  return {
    extras: Array.isArray(obj.extras) ? obj.extras : [],
    attrs: Array.isArray(obj.attrs) ? obj.attrs : [],
  };
}

function restoreMutatorAttributes(
  block: Blockly.Block,
  extras: string[],
  attrs: string[],
): void {
  block.extraInputs_ = extras;
  const rm = rmTypeOfBlock(block);
  if (isEventFamilyType(rm) && (attrs.length || extras.length)) {
    syncRmAttributeInputs(
      block,
      rm,
      eventAttributesToShow(rm, attrs),
      block.slotCardinalities_,
    );
  }
  block.updateShape_?.();
}

let optionalRmMutatorRegistered = false;

function registerOptionalRmMutator(): void {
  if (optionalRmMutatorRegistered) return;
  optionalRmMutatorRegistered = true;
  Blockly.Extensions.registerMutator("optional_rm_mutator", {
    mutationToDom: function (this: Blockly.Block) {
      const container = Blockly.utils.xml.createElement("mutation");
      const extras = this.extraInputs_ ?? [];
      container.setAttribute("extras", JSON.stringify(extras));
      container.setAttribute("attrs", JSON.stringify(presentAttributeNames(this)));
      return container;
    },
    domToMutation: function (this: Blockly.Block, xmlElement: Element) {
      const extras = JSON.parse(xmlElement.getAttribute("extras") || "[]") as string[];
      this.extraInputs_ = extras;
      const attrs = JSON.parse(xmlElement.getAttribute("attrs") || "[]") as string[];
      restoreMutatorAttributes(this, extras, attrs);
    },
    saveExtraState: function (this: Blockly.Block) {
      return {
        extras: this.extraInputs_ ?? [],
        attrs: presentAttributeNames(this),
      };
    },
    loadExtraState: function (
      this: Blockly.Block,
      state: { extras?: string[]; attrs?: string[] } | string | null,
    ) {
      const parsed = parseMutatorExtraState(state);
      this.extraInputs_ = parsed.extras;
      restoreMutatorAttributes(this, parsed.extras, parsed.attrs);
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
        const parentRm = rmTypeOfBlock(this);
        const slotType = slotRmTypeForAttr(parentRm, name);
        if (isRmValueAttribute(parentRm, name) || isPartyProxyType(slotType)) {
          const input = this.appendValueInput(`${OPTIONAL_INPUT_PREFIX}${name}`)
            .appendField(name);
          const check = isPartyProxyType(slotType)
            ? slotType
            : (slotType ? blocklyCheckForDv(slotType) : null);
          if (check) input.setCheck(check);
          appendSlotCardinality(
            input,
            this.slotCardinalities_?.[name] ?? rmAttributeCardinality(parentRm, name),
          );
          appendSlotTypeEmoji(input, slotType);
          continue;
        }
        const stmt = this.appendStatementInput(`${OPTIONAL_INPUT_PREFIX}${name}`)
          .appendField(name);
        appendSlotCardinality(
          stmt,
          this.slotCardinalities_?.[name] ?? rmAttributeCardinality(parentRm, name),
        );
        appendSlotTypeEmoji(stmt, slotType);
      }
    },
  } as Blockly.Mutator & {
    addInput_?: (name: string) => void;
    updateShape_?: () => void;
    saveExtraState?: () => { extras: string[]; attrs: string[] };
    loadExtraState?: (state: { extras?: string[]; attrs?: string[] } | string | null) => void;
  });
}

let dvFieldsMutatorRegistered = false;

function registerDvFieldsMutator(): void {
  if (dvFieldsMutatorRegistered) return;
  dvFieldsMutatorRegistered = true;
  Blockly.Extensions.registerMutator("dv_fields_mutator", {
    mutationToDom: function (this: Blockly.Block) {
      const container = Blockly.utils.xml.createElement("mutation");
      container.setAttribute("fields", JSON.stringify(this.extraDvFields_ ?? []));
      return container;
    },
    domToMutation: function (this: Blockly.Block, xmlElement: Element) {
      this.extraDvFields_ = JSON.parse(xmlElement.getAttribute("fields") || "[]") as string[];
      this.updateDvFields_?.();
    },
    updateDvFields_: function (this: Blockly.Block) {
      for (const input of [...this.inputList]) {
        if (input.name.startsWith(OPTIONAL_DV_FIELD_PREFIX)) {
          this.removeInput(input.name);
        }
      }
      const rmType = this.getFieldValue("RM_TYPE");
      for (const name of this.extraDvFields_ ?? []) {
        const attr = attributesFor(rmType).find((a) => a.name === name);
        if (attr) appendDvFieldInput(this, attr, true);
      }
    },
  } as Blockly.Mutator & {
    updateDvFields_?: () => void;
  });
}

declare module "blockly/core" {
  interface Block {
    extraInputs_?: string[];
    extraDvFields_?: string[];
    slotCardinalities_?: Record<string, SlotCardinality>;
    firePlusClick?: () => void;
    firePlusFieldsClick?: () => void;
    addInput_?: (name: string) => void;
    updateShape_?: () => void;
    updateDvFields_?: () => void;
  }
}

function appendHiddenLabel(block: Blockly.Block, name: string, value: string): void {
  if (block.getField(name)) return;
  block.appendDummyInput()
    .appendField(new Blockly.FieldLabelSerializable(value), name);
  block.getField(name)?.setVisible(false);
}

function plusSvg(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#E87722"/><path fill="#fff" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
}

function plusFieldsSvg(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#8FA8C8" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/><circle cx="18" cy="6" r="3" fill="#4A6FA5"/></svg>';
}
