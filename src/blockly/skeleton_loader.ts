import type { BlockSvg, WorkspaceSvg } from "blockly/core";
import type { MappingModel, SkeletonNode } from "../types/mod.ts";
import { AUTO_FIXED_LOCATABLE_ATTRS } from "../core/rm_mandatory.ts";
import { isDataValueType } from "../core/rm_meta.ts";
import { parseExpression } from "../core/expression/mod.ts";
import { astToExpressionBlock } from "./expression_serialize.ts";
import { Blockly } from "./blockly_core.ts";
import {
  configureElementValueSlot,
  connectExpressionToDataValueShell,
  ensureElementDataValueShell,
  ensureRmBlockType,
  expressionBlockFromDataValueShell,
  isDataValueBlock,
  rmAttributeInputName,
  syncRmAttributeInputs,
} from "./blocks/rm_blocks.ts";
import { applySkeletonBlockLabels } from "./block_labels.ts";
import { blocklyCheckForReturnType } from "./block_checks.ts";

export function loadSkeletonIntoWorkspace(
  workspace: WorkspaceSvg,
  skeleton: SkeletonNode[],
  model: MappingModel,
  listeningSlotId: string | null = null,
): void {
  Blockly.Events.disable();
  try {
    workspace.clear();
    let y = 20;
    for (const root of skeleton) {
      const block = buildBlockFromNode(workspace, root, true, 0);
      if (!block) continue;
      block.moveBy(20, y);
      const height = typeof block.getHeightWidth === "function"
        ? block.getHeightWidth().height
        : 80;
      y += height + 24;
    }
    applyModelExpressions(workspace, model);
    highlightListeningSlot(workspace, listeningSlotId);
  } finally {
    Blockly.Events.enable();
  }
}

export function applyModelExpressions(
  workspace: Blockly.Workspace,
  model: MappingModel,
): void {
  Blockly.Events.disable();
  try {
    const slotMap = new Map(model.slots.filter((s) => s.expression).map((s) => [s.slotId, s]));
    for (const block of workspace.getAllBlocks(false)) {
      if (block.type !== "element") continue;
      const slotId = block.getFieldValue("SLOT_ID");
      if (!slotId) continue;
      const slot = slotMap.get(slotId);
      if (!slot) continue;
      attachExpressionToElement(workspace, block, slot.expression, slot.returnType, slot.rmType);
    }
  } finally {
    Blockly.Events.enable();
  }
}

export function highlightListeningSlot(
  workspace: Blockly.Workspace,
  listeningSlotId: string | null,
): void {
  for (const block of workspace.getAllBlocks(false)) {
    const slotId = block.getFieldValue("SLOT_ID");
    const svg = block as BlockSvg;
    if (typeof svg.setHighlighted === "function") {
      svg.setHighlighted(Boolean(listeningSlotId && slotId === listeningSlotId));
    }
  }
}

export function slotIdFromBlock(block: Blockly.Block | null): string | null {
  if (!block) return null;
  const slotId = block.getFieldValue("SLOT_ID");
  return slotId || null;
}

function buildBlockFromNode(
  workspace: WorkspaceSvg,
  node: SkeletonNode,
  isRoot: boolean,
  depth: number,
): BlockSvg | null {
  if (node.blockType === "element" || node.rmType === "ELEMENT") {
    return buildElementBlock(workspace, node, isRoot);
  }
  if (node.kind === "value") {
    return buildElementBlockFromValue(workspace, node, isRoot);
  }
  return buildContainerBlock(workspace, node, isRoot, depth);
}

function buildContainerBlock(
  workspace: WorkspaceSvg,
  node: SkeletonNode,
  isRoot: boolean,
  depth: number,
): BlockSvg {
  ensureRmBlockType("rm_structure", node.rmType);
  const block = workspace.newBlock("rm_structure") as BlockSvg;
  block.setFieldValue(node.rmType, "RM_TYPE");
  setFieldIfPresent(block, "SLOT_ID", node.slotId);
  setFieldIfPresent(block, "ARCHETYPE_NODE_ID", node.archetypeNodeId ?? "");
  applySkeletonBlockLabels(block, node);

  const visibleChildren = node.children.filter(
    (child) => !(child.kind === "value" && AUTO_FIXED_LOCATABLE_ATTRS.has(child.label)),
  );

  const attributes = [
    ...new Set(
      visibleChildren
        .map((child) => child.rmAttribute)
        .filter((attr): attr is string => Boolean(attr)),
    ),
  ];
  syncRmAttributeInputs(block, node.rmType, attributes);

  for (const attr of attributes) {
    const attrChildren = visibleChildren.filter((child) => child.rmAttribute === attr);
    const childBlocks = attrChildren
      .map((child) => buildBlockFromNode(workspace, child, false, depth + 1))
      .filter((child): child is BlockSvg => child !== null);
    connectStatementChain(block, rmAttributeInputName(attr), childBlocks);
  }
  if (!isRoot) {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
  }

  if (node.mandatory) {
    block.setWarningText(node.silentMandatory ? "Mandatory (RM)" : "Mandatory");
  }

  // Hybrid density: collapse nested structure by default
  if (!isRoot && depth > 0 && typeof block.setCollapsed === "function") {
    block.setCollapsed(true);
  }

  return finalizeBlock(block);
}

function buildElementBlock(
  workspace: WorkspaceSvg,
  node: SkeletonNode,
  isRoot: boolean,
): BlockSvg {
  ensureRmBlockType("element", "ELEMENT");
  const primary = primaryValueChild(node);
  const block = workspace.newBlock("element") as BlockSvg;
  const dvType = primary?.rmType ?? "DATA_VALUE";
  block.setFieldValue(dvType, "RM_TYPE");
  block.setFieldValue(primary?.slotId ?? node.slotId, "SLOT_ID");
  if (node.archetypeNodeId) {
    setFieldIfPresent(block, "ARCHETYPE_NODE_ID", node.archetypeNodeId);
  }
  applySkeletonBlockLabels(block, node);
  configureElementValueSlot(block, dvType);

  const valueMandatory = Boolean(
    (primary?.mandatory ?? false) || (node.mandatory && primary),
  );
  if (valueMandatory && primary && isDataValueType(dvType)) {
    ensureElementDataValueShell(workspace, block, dvType);
  }

  if (!isRoot) {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
  }

  if (node.mandatory && primary && !hasMappedExpression(block)) {
    block.setWarningText("Unmapped mandatory value");
  }
  return finalizeBlock(block);
}

function buildElementBlockFromValue(
  workspace: WorkspaceSvg,
  node: SkeletonNode,
  isRoot: boolean,
): BlockSvg {
  ensureRmBlockType("element", "ELEMENT");
  const block = workspace.newBlock("element") as BlockSvg;
  block.setFieldValue(node.rmType, "RM_TYPE");
  block.setFieldValue(node.slotId, "SLOT_ID");
  if (node.archetypeNodeId) {
    setFieldIfPresent(block, "ARCHETYPE_NODE_ID", node.archetypeNodeId);
  }
  applySkeletonBlockLabels(block, node);
  configureElementValueSlot(block, node.rmType);

  if (node.mandatory && isDataValueType(node.rmType)) {
    ensureElementDataValueShell(workspace, block, node.rmType);
  }

  if (!isRoot) {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
  }
  if (node.mandatory) {
    block.setWarningText(node.silentMandatory ? "Mandatory (RM)" : "Mandatory");
  }
  return finalizeBlock(block);
}

function primaryValueChild(node: SkeletonNode): SkeletonNode | undefined {
  return node.children.find(
    (child) =>
      child.kind === "value" &&
      isDataValueType(child.rmType) &&
      !AUTO_FIXED_LOCATABLE_ATTRS.has(child.label),
  );
}

function connectStatementChain(
  parent: Blockly.Block,
  inputName: string,
  blocks: Blockly.Block[],
): void {
  if (!blocks.length) return;
  const input = parent.getInput(inputName);
  if (!input?.connection) return;

  let previous: Blockly.Block | null = null;
  for (const block of blocks) {
    if (!previous) {
      if (block.previousConnection) {
        input.connection.connect(block.previousConnection);
      }
    } else if (previous.nextConnection && block.previousConnection) {
      previous.nextConnection.connect(block.previousConnection);
    }
    previous = block;
  }
}

function attachExpressionToElement(
  workspace: Blockly.Workspace,
  elementBlock: Blockly.Block,
  expression: string,
  returnType: string,
  rmTypeHint?: string,
): void {
  const rmType = rmTypeHint || elementBlock.getFieldValue("RM_TYPE") || "DV_TEXT";
  const shell = ensureElementDataValueShell(workspace, elementBlock, rmType);
  if (!shell) return;

  const exprBlock = expressionToBlock(workspace, expression, returnType);
  connectExpressionToDataValueShell(shell, exprBlock);
  elementBlock.setWarningText(null);

  // Expand collapsed ancestors so the mapped leaf is visible
  let parent = elementBlock.getParent();
  while (parent) {
    if (typeof parent.setCollapsed === "function" && parent.isCollapsed?.()) {
      parent.setCollapsed(false);
    }
    parent = parent.getParent();
  }
}

function expressionToBlock(
  workspace: Blockly.Workspace,
  expression: string,
  returnType: string,
): BlockSvg {
  try {
    return astToExpressionBlock(workspace, parseExpression(expression), returnType, finalizeBlock);
  } catch {
    return createSourceQueryBlock(workspace, expression, returnType);
  }
}

function createSourceQueryBlock(
  workspace: Blockly.Workspace,
  xpath: string,
  returnType: string,
): BlockSvg {
  const block = workspace.newBlock("source_query") as BlockSvg;
  block.setFieldValue(xpath, "EXPRESSION");
  block.setFieldValue(returnType, "RETURN_TYPE");
  block.setOutput(true, blocklyCheckForReturnType(returnType) ?? null);
  return finalizeBlock(block);
}

function finalizeBlock(block: BlockSvg): BlockSvg {
  if (typeof document !== "undefined") {
    block.initSvg();
    block.render();
  }
  return block;
}

function setFieldIfPresent(block: Blockly.Block, name: string, value: string): void {
  const field = block.getField(name);
  if (field) field.setValue(value);
}

function hasMappedExpression(block: Blockly.Block): boolean {
  const valueBlock = block.getInput("VALUE")?.connection?.targetBlock();
  if (!valueBlock) return false;
  if (isDataValueBlock(valueBlock)) {
    return Boolean(expressionBlockFromDataValueShell(valueBlock));
  }
  return true;
}
