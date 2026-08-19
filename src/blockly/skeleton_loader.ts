import type { BlockSvg, WorkspaceSvg } from "blockly/core";
import type { MappingModel, SkeletonNode } from "../types/mod.ts";
import { AUTO_FIXED_LOCATABLE_ATTRS } from "../core/rm_mandatory.ts";
import { blockTypeForRm, isDataValueType } from "../core/rm_meta.ts";
import { parseExpression } from "../core/expression/mod.ts";
import { skeletonNodeForOptionalRm } from "../core/skeleton/generate_skeleton.ts";
import { astToExpressionBlock } from "./expression_serialize.ts";
import { Blockly } from "./blockly_core.ts";
import {
  configureElementValueSlot,
  connectExpressionToDataValueShell,
  ensureElementDataValueShell,
  ensureRmBlockType,
  expressionBlockFromDataValueShell,
  isDataValueBlock,
  optionalRmInputName,
  rmAttributeInputName,
  syncRmAttributeInputs,
} from "./blocks/rm_blocks.ts";
import { applySkeletonBlockLabels } from "./block_labels.ts";
import { createSourceQueryBlock } from "./source_query.ts";
import { isGenericValueBlockType } from "./blocks/target_blocks.ts";
import {
  syncTargetChildInputs,
  targetChildInputName,
} from "./blocks/target_blocks.ts";

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
    setAllBlocksCollapsed(workspace, false);
    highlightListeningSlot(workspace, listeningSlotId);
  } finally {
    Blockly.Events.enable();
  }
}

const lockedRoots = new WeakSet<Blockly.Block>();

/** Top-level stacks (typically COMPOSITION) stay expanded and cannot be collapsed. */
export function lockWorkspaceRootsExpanded(workspace: Blockly.Workspace): void {
  for (const block of workspace.getTopBlocks(false)) {
    lockRootExpanded(block);
  }
}

/**
 * Collapse or expand every nested block. Workspace roots are always left expanded.
 */
export function setAllBlocksCollapsed(
  workspace: Blockly.Workspace,
  collapsed: boolean,
): void {
  const roots = new Set(workspace.getTopBlocks(false));
  const grouped = typeof Blockly.Events.setGroup === "function";
  if (grouped) Blockly.Events.setGroup(true);
  try {
    for (const block of workspace.getAllBlocks(false)) {
      if (typeof block.isShadow === "function" && block.isShadow()) continue;
      if (typeof block.setCollapsed !== "function") continue;
      if (roots.has(block)) {
        block.setCollapsed(false);
        continue;
      }
      block.setCollapsed(collapsed);
    }
  } finally {
    if (grouped) Blockly.Events.setGroup(false);
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
      if (block.type !== "element" && !isGenericValueBlockType(block.type)) continue;
      const slotId = block.getFieldValue("SLOT_ID");
      if (!slotId) continue;
      const slot = slotMap.get(slotId);
      if (!slot) continue;
      if (block.type === "element") {
        attachExpressionToElement(workspace, block, slot.expression, slot.returnType, slot.rmType);
      } else {
        attachExpressionToTarget(workspace, block, slot.expression, slot.returnType);
      }
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

/** Insert an Optional RM child on a live container without rebuilding the canvas. */
export function attachOptionalRmChild(
  workspace: WorkspaceSvg,
  parent: Blockly.Block,
  insertion: { rmType: string; attributeName: string; label?: string },
): BlockSvg | null {
  if (typeof parent.addInput_ === "function") {
    parent.addInput_(insertion.attributeName);
  }
  const parentSlotId = parent.getFieldValue("SLOT_ID") || "";
  const parentRmType = parent.getFieldValue("RM_TYPE") || parent.type.toUpperCase();
  const slash = parentSlotId.indexOf("/");
  const parentNode: SkeletonNode = {
    slotId: parentSlotId,
    blockType: parent.type,
    rmType: parentRmType,
    label: parent.getFieldValue("NAME") || parentRmType,
    kind: "container",
    mandatory: false,
    children: [],
    archetypeId: slash > 0 ? parentSlotId.slice(0, slash) : parentSlotId,
    attachmentPoint: slash >= 0 ? parentSlotId.slice(slash) : "",
  };
  const childNode = skeletonNodeForOptionalRm(
    parentNode,
    insertion.rmType,
    insertion.attributeName,
  );
  if (insertion.label) childNode.label = insertion.label;
  const child = buildBlockFromNode(workspace, childNode, false, 1);
  if (!child) return null;
  const inputName = parent.getInput(rmAttributeInputName(insertion.attributeName))
    ? rmAttributeInputName(insertion.attributeName)
    : optionalRmInputName(insertion.attributeName);
  connectStatementChain(parent, inputName, [child]);
  return child;
}

function buildBlockFromNode(
  workspace: WorkspaceSvg,
  node: SkeletonNode,
  isRoot: boolean,
  depth: number,
): BlockSvg | null {
  let block: BlockSvg | null = null;
  if (node.blockType === "target_structure") {
    block = buildTargetStructureBlock(workspace, node, isRoot, depth);
  } else if (node.blockType === "target_value") {
    block = buildTargetValueBlock(workspace, node, isRoot);
  } else if (node.blockType === "element" || node.rmType === "ELEMENT") {
    block = buildElementBlock(workspace, node, isRoot);
  } else if (node.kind === "value") {
    block = buildElementBlockFromValue(workspace, node, isRoot);
  } else {
    block = buildContainerBlock(workspace, node, isRoot, depth);
  }
  if (block && isRoot) lockRootExpanded(block);
  return block;
}

function lockRootExpanded(block: Blockly.Block): void {
  const mutable = block as Blockly.Block & {
    setCollapsed: (collapsed: boolean) => void;
  };
  if (typeof mutable.setCollapsed !== "function") return;
  if (mutable.isCollapsed?.()) mutable.setCollapsed(false);
  if (lockedRoots.has(block)) return;
  lockedRoots.add(block);
  const original = mutable.setCollapsed.bind(block);
  mutable.setCollapsed = (_collapsed: boolean) => {
    original(false);
  };
}

function buildTargetStructureBlock(
  workspace: WorkspaceSvg,
  node: SkeletonNode,
  isRoot: boolean,
  depth: number,
): BlockSvg {
  const block = workspace.newBlock("target_structure") as BlockSvg;
  block.setFieldValue(node.label, "NAME");
  block.setFieldValue(node.rmType, "TARGET_TYPE");
  block.setFieldValue(node.slotId, "SLOT_ID");
  const groups = [...new Set(node.children.map((child) => child.rmAttribute ?? child.label))];
  syncTargetChildInputs(block, groups);
  for (const group of groups) {
    const children = node.children
      .filter((child) => (child.rmAttribute ?? child.label) === group)
      .map((child) => buildBlockFromNode(workspace, child, false, depth + 1))
      .filter((child): child is BlockSvg => child !== null);
    connectStatementChain(block, targetChildInputName(group), children);
  }
  if (!isRoot) {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
  }
  return finalizeBlock(block);
}

function buildTargetValueBlock(
  workspace: WorkspaceSvg,
  node: SkeletonNode,
  isRoot: boolean,
): BlockSvg {
  const block = workspace.newBlock("target_value") as BlockSvg;
  block.setFieldValue(node.label, "NAME");
  block.setFieldValue(node.rmType, "TARGET_TYPE");
  block.setFieldValue(node.slotId, "SLOT_ID");
  if (!isRoot) {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
  }
  if (node.mandatory) block.setWarningText("Unmapped mandatory value");
  return finalizeBlock(block);
}

function buildContainerBlock(
  workspace: WorkspaceSvg,
  node: SkeletonNode,
  isRoot: boolean,
  depth: number,
): BlockSvg {
  function hasMandatoryDataValueDescendant(n: SkeletonNode): boolean {
    for (const c of n.children) {
      if (
        c.kind === "value" &&
        isDataValueType(c.rmType) &&
        c.mandatory === true &&
        !(c.kind === "value" && AUTO_FIXED_LOCATABLE_ATTRS.has(c.label))
      ) return true;
      if (c.kind === "container" && hasMandatoryDataValueDescendant(c)) return true;
    }
    return false;
  }

  const blockType = node.blockType && node.blockType !== "rm_structure"
    ? node.blockType
    : blockTypeForRm(node.rmType);
  ensureRmBlockType(blockType, node.rmType);
  const block = workspace.newBlock(blockType) as BlockSvg;
  setFieldIfPresent(block, "RM_TYPE", node.rmType);
  setFieldIfPresent(block, "SLOT_ID", node.slotId);
  setFieldIfPresent(block, "ARCHETYPE_NODE_ID", node.archetypeNodeId ?? "");
  applySkeletonBlockLabels(block, node);

  const visibleChildren = node.children.filter(
    (child) => {
      if (child.kind === "value" && AUTO_FIXED_LOCATABLE_ATTRS.has(child.label)) return false;

      // SECTION is a user-visible openEHR structure; even when its occurrence is
      // optional in OPT, we still want it present in the initial canvas
      // (and rely on nesting logic to attach it properly).
      if (child.blockType === "section" || child.rmType === "SECTION") return true;

      // Default visibility policy:
      // - show openEHR structures that are mandatory in the OPT walk
      // - keep optional RM structures hidden until the user clicks the `+` picker
      if (child.mandatory === true) return true;

      // ELEMENT wrappers can have `mandatory=false` even when their primary typed DATA_VALUE
      // is mandatory (so mapping slots must remain reachable).
      if (child.rmType === "ELEMENT" || child.blockType === "element") {
        return child.children.some((gc) =>
          gc.kind === "value" &&
          isDataValueType(gc.rmType) &&
          gc.mandatory === true &&
          !(gc.kind === "value" && AUTO_FIXED_LOCATABLE_ATTRS.has(gc.label))
        );
      }

      // Keep intermediate structural wrappers visible when they contain
      // mandatory value slots underneath. This avoids “disappearing”
      // subtrees while still hiding optional RM insertions that have no
      // mandatory descendants in the OPT walk.
      return hasMandatoryDataValueDescendant(child);
    },
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

function attachExpressionToTarget(
  workspace: Blockly.Workspace,
  targetBlock: Blockly.Block,
  expression: string,
  returnType: string,
): void {
  const input = targetBlock.getInput("VALUE");
  if (!input?.connection) return;
  const existing = input.connection.targetBlock();
  if (existing) existing.dispose(false);
  const exprBlock = expressionToBlock(workspace, expression, returnType);
  if (exprBlock.outputConnection) input.connection.connect(exprBlock.outputConnection);
  targetBlock.setWarningText(null);
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
