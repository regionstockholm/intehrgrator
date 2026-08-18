import { Blockly } from "../blockly_core.ts";
import { mandatoryAttributesFor } from "../../core/rm_mandatory.ts";
import {
  attributesFor,
  blocklyCheckForPrimitiveType,
  blockTypeForRm,
  dataValueLeafTypes,
  isPrimitiveRmType,
  mandatoryAttributes,
  optionalAttributes,
  primaryMappingAttribute,
  type RmAttributeMeta,
} from "../../core/rm_meta.ts";
import { blocklyCheckForDv } from "../block_checks.ts";

const OPTIONAL_INPUT_PREFIX = "OPT_";
const OPTIONAL_DV_FIELD_PREFIX = "OPTFLD_";
export const RM_ATTR_INPUT_PREFIX = "ATTR_";
export const DV_FIELD_PREFIX = "FLD_";

const STRUCTURE_COLOUR = "#003B49";
const CONTAINER_COLOUR = "#005C53";
const DV_COLOUR = "#4A6FA5";
const ELEMENT_COLOUR = "#3D7A6A";

export function registerRmBlocks(): void {
  defineGenericStructureBlock("rm_structure", STRUCTURE_COLOUR);

  defineContainerBlock("composition", "COMPOSITION", [
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
  defineDataValueBlocksFromMeta();
  defineCodePhraseBlock();
  registerOptionalRmMutator();
  registerDvFieldsMutator();
}

export function ensureRmBlockType(blockType: string, rmType: string): void {
  if (Blockly.Blocks[blockType]) return;
  if (rmType.startsWith("DV_") || rmType === "CODE_PHRASE") {
    defineDataValueBlock(rmType);
    return;
  }
  defineGenericStructureBlock(blockType, STRUCTURE_COLOUR);
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
): void {
  for (const input of [...block.inputList]) {
    if (input.name.startsWith(RM_ATTR_INPUT_PREFIX)) {
      block.removeInput(input.name);
    }
  }
  for (const attr of orderedRmAttributes(rmType, attributes)) {
    block.appendStatementInput(`${RM_ATTR_INPUT_PREFIX}${attr}`)
      .appendField(attr);
  }
  ensurePlusButton(block);
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
    (shell as Blockly.BlockSvg).initSvg?.();
    (shell as Blockly.BlockSvg).render?.();
  }
  return shell;
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
  },
): void {
  Blockly.Blocks[type] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput().appendField(label);
      if (options.expandable) {
        appendPlusField(this);
      }
      for (const input of inputs) {
        const stmt = this.appendStatementInput(rmAttributeInputName(input.name))
          .appendField(input.name);
        if (input.check) stmt.setCheck(input.check);
      }
      this.appendDummyInput()
        .appendField(new Blockly.FieldLabelSerializable(""), "SLOT_ID");
      this.getField("SLOT_ID")!.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldLabelSerializable(options.rmType), "RM_TYPE");
      this.getField("RM_TYPE")!.setVisible(false);
      this.setColour(colour);
      this.setTooltip(`openEHR RM ${options.rmType}`);
      this.setInputsInline(true);
      if (options.nestCheck) {
        this.setPreviousStatement(true, options.nestCheck);
        this.setNextStatement(true, options.nestCheck);
      }
      if (options.expandable) {
        Blockly.Extensions.apply("optional_rm_mutator", this, true);
      }
    },
  };
}

function defineGenericStructureBlock(type: string, colour: string): void {
  if (Blockly.Blocks[type]) return;
  Blockly.Blocks[type] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput("HEADER")
        .appendField(new Blockly.FieldLabel("label"), "NAME")
        .appendField(new Blockly.FieldLabel("", undefined, { class: "blockly-at-code" }), "AT_CODE");
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
      this.setInputsInline(true);
    },
  };
}

function defineValueElementBlock(): void {
  Blockly.Blocks["element"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput("HEADER")
        .appendField("ELEMENT")
        .appendField(new Blockly.FieldLabel(""), "NAME")
        .appendField(new Blockly.FieldLabel("", undefined, { class: "blockly-at-code" }), "AT_CODE");
      appendPlusField(this);
      this.appendValueInput("VALUE")
        .setCheck(null)
        .appendField("value");
      this.appendDummyInput()
        .appendField(new Blockly.FieldLabelSerializable("ELEMENT"), "RM_TYPE");
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
      this.appendDummyInput("HEADER")
        .appendField(rmType.replace(/^DV_/, ""));
      this.appendDummyInput()
        .appendField(new Blockly.FieldLabelSerializable(""), "SLOT_ID");
      this.getField("SLOT_ID")!.setVisible(false);
      this.appendDummyInput()
        .appendField(new Blockly.FieldLabelSerializable(rmType), "RM_TYPE");
      this.getField("RM_TYPE")!.setVisible(false);

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
      this.appendDummyInput().appendField("CODE_PHRASE");
      this.appendValueInput(dvFieldInputName("code_string"))
        .setCheck("String")
        .appendField("code");
      this.appendValueInput(dvFieldInputName("terminology_id"))
        .setCheck("String")
        .appendField("terminology");
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
  block.appendValueInput(name)
    .setCheck(check)
    .appendField(attr.name);
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

let optionalRmMutatorRegistered = false;

function registerOptionalRmMutator(): void {
  if (optionalRmMutatorRegistered) return;
  optionalRmMutatorRegistered = true;
  Blockly.Extensions.registerMutator("optional_rm_mutator", {
    mutationToDom: function (this: Blockly.Block) {
      const container = Blockly.utils.xml.createElement("mutation");
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
    firePlusClick?: () => void;
    firePlusFieldsClick?: () => void;
    addInput_?: (name: string) => void;
    updateShape_?: () => void;
    updateDvFields_?: () => void;
  }
}

function plusSvg(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#E87722"/><path fill="#fff" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
}

function plusFieldsSvg(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#8FA8C8" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/><circle cx="18" cy="6" r="3" fill="#4A6FA5"/></svg>';
}
