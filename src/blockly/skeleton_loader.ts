import * as Blockly from "blockly/core";
import type { BlockSvg, WorkspaceSvg } from "blockly/core";
import type { MappingModel, SkeletonNode } from "../types/mod.ts";
import { AUTO_FIXED_LOCATABLE_ATTRS, isDataValueType } from "../core/rm_mandatory.ts";
import { parseExpression, type ExprAst } from "../core/expression/mod.ts";
import { ensureRmBlockType } from "./blocks/rm_blocks.ts";
import { applySkeletonBlockLabels } from "./block_labels.ts";

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
      const block = buildBlockFromNode(workspace, root, true);
      if (!block) continue;
      block.moveBy(20, y);
      y += block.getHeightWidth().height + 24;
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
      const slotId = block.getFieldValue("SLOT_ID");
      if (!slotId) continue;
      const slot = slotMap.get(slotId);
      if (!slot) continue;
      attachExpressionToBlock(workspace, block, slot.expression, slot.returnType);
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
): BlockSvg | null {
  if (node.blockType === "element" || node.rmType === "ELEMENT") {
    return buildElementBlock(workspace, node, isRoot);
  }
  if (node.kind === "value") {
    return buildElementBlockFromValue(workspace, node, isRoot);
  }
  return buildContainerBlock(workspace, node, isRoot);
}

function buildContainerBlock(
  workspace: WorkspaceSvg,
  node: SkeletonNode,
  isRoot: boolean,
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

  const childBlocks = visibleChildren
    .map((child) => buildBlockFromNode(workspace, child, false))
    .filter((child): child is BlockSvg => child !== null);

  connectStatementChain(block, "BODY", childBlocks);
  if (!isRoot) {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
  }

  if (node.mandatory) {
    block.setWarningText(node.silentMandatory ? "Mandatory (RM)" : "Mandatory");
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
  block.setFieldValue(primary?.rmType ?? "ELEMENT", "RM_TYPE");
  block.setFieldValue(primary?.slotId ?? node.slotId, "SLOT_ID");
  if (node.archetypeNodeId) {
    setFieldIfPresent(block, "ARCHETYPE_NODE_ID", node.archetypeNodeId);
  }
  applySkeletonBlockLabels(block, node);

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

function attachExpressionToBlock(
  workspace: Blockly.Workspace,
  block: Blockly.Block,
  expression: string,
  returnType: string,
): void {
  const valueInput = block.getInput("VALUE");
  if (!valueInput?.connection) return;

  const existing = valueInput.connection.targetBlock();
  if (existing) existing.dispose(false);

  const exprBlock = expressionToBlock(workspace, expression, returnType);
  if (exprBlock.outputConnection) {
    valueInput.connection.connect(exprBlock.outputConnection);
  }
  block.setWarningText(null);
}

function expressionToBlock(
  workspace: Blockly.Workspace,
  expression: string,
  returnType: string,
): BlockSvg {
  try {
    return astToBlock(workspace, parseExpression(expression), returnType);
  } catch {
    return createSourceQueryBlock(workspace, expression, returnType);
  }
}

function astToBlock(
  workspace: Blockly.Workspace,
  ast: ExprAst,
  returnType: string,
): BlockSvg {
  if (ast.kind === "call") {
    if (ast.name.startsWith("xpath")) {
      const xpathArg = ast.args[0];
      const xpath = xpathArg?.kind === "literal" && typeof xpathArg.value === "string"
        ? xpathArg.value
        : "";
      const ret = ast.name === "xpathNumber"
        ? "number"
        : ast.name === "xpathBoolean"
        ? "boolean"
        : "string";
      return createSourceQueryBlock(workspace, xpath, ret);
    }
    if (ast.name === "trim" && ast.args[0]) {
      const block = workspace.newBlock("trim") as BlockSvg;
      const inner = astToBlock(workspace, ast.args[0], "string");
      block.getInput("TEXT")!.connection!.connect(inner.outputConnection!);
      return finalizeBlock(block);
    }
    if (ast.name === "if" && ast.args.length >= 3) {
      const block = workspace.newBlock("if_then_else") as BlockSvg;
      block.getInput("COND")!.connection!.connect(
        astToBlock(workspace, ast.args[0], "boolean").outputConnection!,
      );
      block.getInput("THEN")!.connection!.connect(
        astToBlock(workspace, ast.args[1], returnType).outputConnection!,
      );
      block.getInput("ELSE")!.connection!.connect(
        astToBlock(workspace, ast.args[2], returnType).outputConnection!,
      );
      return finalizeBlock(block);
    }
  }
  if (ast.kind === "literal") {
    return createSourceQueryBlock(workspace, String(ast.value), returnType);
  }
  return createSourceQueryBlock(workspace, "", returnType);
}

function createSourceQueryBlock(
  workspace: Blockly.Workspace,
  xpath: string,
  returnType: string,
): BlockSvg {
  const block = workspace.newBlock("source_query") as BlockSvg;
  block.setFieldValue(xpath, "EXPRESSION");
  block.setFieldValue(returnType, "RETURN_TYPE");
  return finalizeBlock(block);
}

function finalizeBlock(block: BlockSvg): BlockSvg {
  block.initSvg();
  block.render();
  return block;
}

function setFieldIfPresent(block: Blockly.Block, name: string, value: string): void {
  const field = block.getField(name);
  if (field) field.setValue(value);
}

function hasMappedExpression(block: Blockly.Block): boolean {
  return Boolean(block.getInput("VALUE")?.connection?.targetBlock());
}
