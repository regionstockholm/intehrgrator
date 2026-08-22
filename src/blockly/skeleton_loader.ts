import type { BlockSvg, WorkspaceSvg } from "blockly/core";
import type { MappingLoop, MappingModel, SkeletonNode } from "../types/mod.ts";
import { AUTO_FIXED_LOCATABLE_ATTRS } from "../core/rm_mandatory.ts";
import { blockTypeForRm, isDataValueType } from "../core/rm_meta.ts";
import { parseExpression } from "../core/expression/mod.ts";
import { skeletonNodeForOptionalRm } from "../core/skeleton/generate_skeleton.ts";
import { termSetById, termSetForRmAttribute } from "../core/openehr_term_catalog.ts";
import { astToExpressionBlock } from "./expression_serialize.ts";
import { Blockly } from "./blockly_core.ts";
import {
  applyFixedFieldsToDataValueShell,
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
import { createTermPickBlock, isTermPickBlock } from "./blocks/term_pick.ts";
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
    refreshWorkspaceLayout(workspace);
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
      const slotId = block.getFieldValue("SLOT_ID");
      if (!slotId) continue;
      const slot = slotMap.get(slotId);
      if (!slot) continue;
      if (block.type === "element") {
        attachExpressionToElement(workspace, block, slot.expression, slot.returnType, slot.rmType);
      } else if (isTermPickBlock(block) || isDataValueBlock(block)) {
        attachExpressionToTypedValue(workspace, block, slot.expression, slot.returnType, slot.rmType);
      } else if (isGenericValueBlockType(block.type)) {
        attachExpressionToTarget(workspace, block, slot.expression, slot.returnType);
      }
    }
    applyModelLoops(workspace, model);
  } finally {
    Blockly.Events.enable();
  }
}

/** Wrap each repeating container with `for_each_source` when the model has loops. */
export function applyModelLoops(
  workspace: Blockly.Workspace,
  model: MappingModel,
): void {
  for (const loop of model.loops ?? []) {
    const inner = findAttachBlock(workspace, loop.attachSlotId);
    if (!inner) continue;
    wrapBlockWithForEachSource(workspace, inner, loop);
  }
}

function findAttachBlock(
  workspace: Blockly.Workspace,
  slotId: string,
): Blockly.Block | null {
  let fallback: Blockly.Block | null = null;
  for (const block of workspace.getAllBlocks(false)) {
    if (block.getFieldValue("SLOT_ID") !== slotId) continue;
    if (block.type === "for_each_source") continue;
    if (block.previousConnection) return block;
    fallback = block;
  }
  return fallback;
}

function wrapBlockWithForEachSource(
  workspace: Blockly.Workspace,
  inner: Blockly.Block,
  loop: MappingLoop,
): void {
  const parent = inner.getParent();
  if (parent?.type === "for_each_source") {
    parent.setFieldValue(loop.varName, "VAR");
    parent.setFieldValue(loop.path, "PATH");
    return;
  }

  const wrap = workspace.newBlock("for_each_source");
  wrap.setFieldValue(loop.varName, "VAR");
  wrap.setFieldValue(loop.path, "PATH");
  const svg = wrap as BlockSvg;
  if (typeof document !== "undefined" && typeof svg.initSvg === "function") {
    svg.initSvg();
  }

  const wasTop = !parent;
  const xy = typeof inner.getRelativeToSurfaceXY === "function"
    ? inner.getRelativeToSurfaceXY()
    : { x: 0, y: 0 };
  const prevTarget = inner.previousConnection?.targetConnection ?? null;
  const nextBlock = inner.getNextBlock();
  if (inner.previousConnection?.isConnected()) inner.previousConnection.disconnect();
  if (inner.nextConnection?.isConnected()) inner.nextConnection.disconnect();

  const doConn = wrap.getInput("DO")?.connection;
  if (doConn && inner.previousConnection) {
    doConn.connect(inner.previousConnection);
  }
  if (prevTarget && wrap.previousConnection) {
    prevTarget.connect(wrap.previousConnection);
  }
  if (nextBlock?.previousConnection && wrap.nextConnection) {
    wrap.nextConnection.connect(nextBlock.previousConnection);
  }
  if (wasTop && typeof wrap.moveBy === "function") {
    wrap.moveBy(xy.x, xy.y);
  }
  if (typeof document !== "undefined" && typeof svg.render === "function") {
    svg.render();
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
  const child = buildBlockFromNode(workspace, childNode, false, 1, parentRmType);
  if (!child) return null;
  const inputName = parent.getInput(rmAttributeInputName(insertion.attributeName))
    ? rmAttributeInputName(insertion.attributeName)
    : optionalRmInputName(insertion.attributeName);
  connectAttributeChildren(parent, inputName, [child]);
  refreshBlockLayout(parent as BlockSvg);
  return child;
}

function buildBlockFromNode(
  workspace: WorkspaceSvg,
  node: SkeletonNode,
  isRoot: boolean,
  depth: number,
  parentRmType?: string,
): BlockSvg | null {
  let block: BlockSvg | null = null;
  if (node.blockType === "target_structure") {
    block = buildTargetStructureBlock(workspace, node, isRoot, depth);
  } else if (node.blockType === "target_value") {
    block = buildTargetValueBlock(workspace, node, isRoot);
  } else if (node.blockType === "element" || node.rmType === "ELEMENT") {
    block = buildElementBlock(workspace, node, isRoot);
  } else if (node.kind === "value") {
    block = buildTypedValueBlock(workspace, node, isRoot, parentRmType);
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
  if (!isRoot) {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
  }
  finalizeBlock(block);
  for (const group of groups) {
    const children = node.children
      .filter((child) => (child.rmAttribute ?? child.label) === group)
      .map((child) => buildBlockFromNode(workspace, child, false, depth + 1))
      .filter((child): child is BlockSvg => child !== null);
    connectStatementChain(block, targetChildInputName(group), children);
  }
  refreshBlockLayout(block);
  return block;
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
  if (!isRoot && !block.outputConnection) {
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

  if (!isRoot && !block.outputConnection) {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
  }

  if (node.mandatory) {
    block.setWarningText(node.silentMandatory ? "Mandatory (RM)" : "Mandatory");
  }

  // Initialise SVG before nesting children so puzzle-tab sockets measure correctly.
  finalizeBlock(block);

  for (const attr of attributes) {
    const attrChildren = visibleChildren.filter((child) => child.rmAttribute === attr);
    const childBlocks = attrChildren
      .map((child) => buildBlockFromNode(workspace, child, false, depth + 1, node.rmType))
      .filter((child): child is BlockSvg => child !== null);
    connectAttributeChildren(block, rmAttributeInputName(attr), childBlocks);
  }

  refreshBlockLayout(block);
  return block;
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

  if (!isRoot && !block.outputConnection) {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
  }

  if (node.mandatory && primary && !hasMappedExpression(block)) {
    block.setWarningText("Unmapped mandatory value");
  }

  // Render the ELEMENT shell before attaching the typed DATA_VALUE child.
  finalizeBlock(block);

  const valueMandatory = Boolean(
    (primary?.mandatory ?? false) || (node.mandatory && primary),
  );
  if (valueMandatory && primary && isDataValueType(dvType)) {
    const shell = ensureElementDataValueShell(workspace, block, dvType);
    if (shell) applyFixedFieldsToDataValueShell(workspace, shell, primary.fixedFields ?? node.fixedFields);
  }

  refreshBlockLayout(block);
  return block;
}

function buildTypedValueBlock(
  workspace: WorkspaceSvg,
  node: SkeletonNode,
  _isRoot: boolean,
  parentRmType?: string,
): BlockSvg {
  const termSet = parentRmType && node.rmAttribute
    ? termSetForRmAttribute(parentRmType, node.rmAttribute)
    : undefined;
  if (termSet) {
    const code = node.fixedFields?.code_string ?? node.fixedFields?.defining_code;
    const block = createTermPickBlock(workspace, termSet, code, node.slotId);
    if (node.mandatory && !code) {
      block.setWarningText(node.silentMandatory ? "Mandatory (RM)" : "Mandatory");
    }
    return finalizeBlock(block);
  }

  const blockType = node.blockType && node.blockType !== "rm_structure" && node.blockType !== "element"
    ? node.blockType
    : blockTypeForRm(node.rmType);
  ensureRmBlockType(blockType, node.rmType);
  const block = workspace.newBlock(blockType) as BlockSvg;
  setFieldIfPresent(block, "RM_TYPE", node.rmType);
  setFieldIfPresent(block, "SLOT_ID", node.slotId);
  applySkeletonBlockLabels(block, node);
  if (node.mandatory) {
    block.setWarningText(node.silentMandatory ? "Mandatory (RM)" : "Mandatory");
  }
  finalizeBlock(block);
  applyFixedFieldsToDataValueShell(workspace, block, node.fixedFields);
  refreshBlockLayout(block);
  return block;
}

function primaryValueChild(node: SkeletonNode): SkeletonNode | undefined {
  return node.children.find(
    (child) =>
      child.kind === "value" &&
      isDataValueType(child.rmType) &&
      !AUTO_FIXED_LOCATABLE_ATTRS.has(child.label),
  );
}

function connectAttributeChildren(
  parent: Blockly.Block,
  inputName: string,
  blocks: Blockly.Block[],
): void {
  if (!blocks.length) return;
  const input = parent.getInput(inputName);
  if (!input?.connection) return;
  if (blocks[0]?.outputConnection && !blocks[0].previousConnection) {
    input.connection.connect(blocks[0].outputConnection);
    return;
  }
  connectStatementChain(parent, inputName, blocks);
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

function attachExpressionToTypedValue(
  workspace: Blockly.Workspace,
  valueBlock: Blockly.Block,
  expression: string,
  returnType: string,
  rmTypeHint?: string,
): void {
  const exprBlock = expressionToBlock(workspace, expression, returnType);
  if (isTermPickBlock(valueBlock)) {
    const parentConnection = valueBlock.outputConnection?.targetConnection;
    const set = termSetById(valueBlock.getFieldValue("SET"));
    const slotId = valueBlock.getFieldValue("SLOT_ID");
    const rmType = rmTypeHint || set?.valueRmType || "CODE_PHRASE";
    valueBlock.dispose(false);
    const shellType = rmType === "DV_CODED_TEXT" ? "DV_CODED_TEXT" : "CODE_PHRASE";
    ensureRmBlockType(blockTypeForRm(shellType), shellType);
    const shell = workspace.newBlock(blockTypeForRm(shellType));
    if (shell.getField("RM_TYPE")) shell.setFieldValue(shellType, "RM_TYPE");
    if (slotId && shell.getField("SLOT_ID")) shell.setFieldValue(slotId, "SLOT_ID");
    if (shell.outputConnection && parentConnection) {
      parentConnection.connect(shell.outputConnection);
    }
    applyFixedFieldsToDataValueShell(workspace, shell, {
      terminology_id: set?.terminologyId ?? "",
    });
    connectExpressionToDataValueShell(shell, exprBlock);
    finalizeBlock(shell as BlockSvg);
    return;
  }
  connectExpressionToDataValueShell(valueBlock, exprBlock);
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

function refreshBlockLayout(block: BlockSvg): void {
  if (typeof document !== "undefined" && typeof block.render === "function") {
    block.render();
  }
}

/** Re-measure all blocks after programmatic skeleton assembly. */
function refreshWorkspaceLayout(workspace: WorkspaceSvg): void {
  if (typeof document === "undefined") return;
  for (const block of workspace.getAllBlocks(false)) {
    refreshBlockLayout(block as BlockSvg);
  }
  if (typeof Blockly.svgResize === "function") {
    Blockly.svgResize(workspace);
  }
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
