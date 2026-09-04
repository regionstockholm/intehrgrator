import type { BlockSvg, WorkspaceSvg } from "blockly/core";
import type { AllowedOrdinal, AllowedValue, MappingLoop, MappingModel, SkeletonNode } from "../types/mod.ts";
import { AUTO_FIXED_LOCATABLE_ATTRS } from "../core/rm_mandatory.ts";
import { blockTypeForRm, isDataValueType } from "../core/rm_meta.ts";
import { parseExpression } from "../core/expression/mod.ts";
import { skeletonNodeForOptionalRm } from "../core/skeleton/generate_skeleton.ts";
import { termSetById, termSetForMandatedCode, termSetForRmAttribute } from "../core/openehr_term_catalog.ts";
import { astToExpressionBlock } from "./expression_serialize.ts";
import { Blockly } from "./blockly_core.ts";
import "blockly/blocks";
import * as enMsg from "blockly/msg/en";
import {
  applyFixedFieldsToDataValueShell,
  applyOrdinalFieldsToDataValueShell,
  configureElementValueSlot,
  connectExpressionToDataValueShell,
  dvFieldInputName,
  ensureElementDataValueShell,
  ensureRmBlockType,
  isDataValueBlock,
  optionalRmInputName,
  rmAttributeInputName,
  syncRmAttributeInputs,
  enforceOpenEhrBlockLayout,
  isRmContainerBlockType,
} from "./blocks/rm_blocks.ts";
import { createTermPickBlock, isTermPickBlock } from "./blocks/term_pick.ts";
import { applySkeletonBlockLabels } from "./block_labels.ts";
import { createSourceQueryBlock } from "./source_query.ts";
import {
  attachDefaultPointLookups,
  captureDefaultsBlockState,
  placeDefaultsBesideSkeleton,
  restoreDefaultsBlockState,
} from "./defaults_canvas.ts";
import { isGenericValueBlockType } from "./blocks/target_blocks.ts";
import {
  syncTargetChildInputs,
  targetChildInputName,
} from "./blocks/target_blocks.ts";
import { schemaOptionalInputName, composeSchemaOptionalFields } from "./blocks/schema_mutator.ts";
import { findSkeletonNode, setSchemaCatalog } from "./schema_catalog.ts";
import type { TargetFormatId } from "../types/mod.ts";
import { refreshWorkspaceConstraints } from "./block_constraints.ts";
import {
  parseSlotCardinality,
  rmAttributeCardinality,
  type SlotCardinality,
} from "./slot_cardinality.ts";
import { runWithoutBlocklyEvents } from "./blockly_events.ts";
import { blocklyCheckForDv } from "./block_checks.ts";

export function loadSkeletonIntoWorkspace(
  workspace: WorkspaceSvg,
  skeleton: SkeletonNode[],
  model: MappingModel,
  listeningSlotId: string | null = null,
  uiLanguage = "en",
  targetFormat?: TargetFormatId,
): void {
  setSchemaCatalog(skeleton);
  const schemaTarget = targetFormat === "json-schema" || targetFormat === "xml-schema";
  runWithoutBlocklyEvents(() => {
    const savedDefaults = schemaTarget ? null : captureDefaultsBlockState(workspace);
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
    restoreDefaultsBlockState(workspace, savedDefaults, uiLanguage, targetFormat);
    placeDefaultsBesideSkeleton(workspace);
    if (!schemaTarget) {
      attachDefaultPointLookups(workspace, skeleton, (parent, insertion) =>
        attachOptionalRmChild(workspace, parent, insertion)
      );
    }
    applyModelOptionalSchemaFields(workspace, model);
    setAllBlocksCollapsed(workspace, false);
    for (const block of workspace.getAllBlocks(false)) {
      if (
        isRmContainerBlockType(block.type) ||
        isDataValueBlock(block) ||
        block.type === "element" ||
        block.type === "party_ref" ||
        block.type === "code_phrase"
      ) {
        enforceOpenEhrBlockLayout(block);
      }
    }
    highlightListeningSlot(workspace, listeningSlotId);
    refreshWorkspaceLayout(workspace);
    refreshWorkspaceConstraints(workspace);
  });
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
  options: { recordUndo?: boolean } = {},
): void {
  const apply = () => {
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
  };
  if (options.recordUndo) apply();
  else runWithoutBlocklyEvents(apply);
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
  listeningSourceBlockId: string | null = null,
): void {
  for (const block of workspace.getAllBlocks(false)) {
    const slotId = block.getFieldValue("SLOT_ID");
    const svg = block as BlockSvg;
    if (typeof svg.setHighlighted !== "function") continue;
    const bySlot = Boolean(listeningSlotId && slotId === listeningSlotId);
    const bySource = Boolean(listeningSourceBlockId && block.id === listeningSourceBlockId);
    svg.setHighlighted(bySlot || bySource);
  }
}

export function slotIdFromBlock(block: Blockly.Block | null): string | null {
  if (!block) return null;
  const slotId = block.getFieldValue("SLOT_ID");
  return slotId || null;
}

/** Insert an optional schema field child on a live target_structure block. */
export function attachOptionalSchemaChild(
  workspace: WorkspaceSvg,
  parent: Blockly.Block,
  attributeName: string,
): BlockSvg | null {
  const parentSlotId = parent.getFieldValue("SLOT_ID") || "";
  const parentNode = findSkeletonNode(parentSlotId);
  if (!parentNode) return null;
  const childNode = parentNode.children.find(
    (child) => (child.rmAttribute ?? child.label) === attributeName,
  );
  if (!childNode) return null;
  const child = buildBlockFromNode(workspace, childNode, false, 1);
  if (!child) return null;
  const inputName = parent.getInput(schemaOptionalInputName(attributeName))
    ? schemaOptionalInputName(attributeName)
    : targetChildInputName(attributeName);
  connectAttributeChildren(parent, inputName, [child]);
  refreshBlockLayout(parent as BlockSvg);
  refreshWorkspaceConstraints(workspace);
  return child;
}

function applyModelOptionalSchemaFields(
  workspace: WorkspaceSvg,
  model: MappingModel,
): void {
  const byParent = new Map<string, string[]>();
  for (const extra of model.optionalRm) {
    const parent = findBlockBySlotId(workspace, extra.attachmentSlotId);
    if (!parent || parent.type !== "target_structure") continue;
    const list = byParent.get(extra.attachmentSlotId) ?? [];
    list.push(extra.attributeName);
    byParent.set(extra.attachmentSlotId, list);
  }
  for (const [parentSlotId, names] of byParent) {
    const parent = findBlockBySlotId(workspace, parentSlotId);
    if (!parent) continue;
    composeSchemaOptionalFields(parent, names);
    for (const name of names) {
      const input = parent.getInput(schemaOptionalInputName(name));
      if (input?.connection?.targetBlock()) continue;
      attachOptionalSchemaChild(workspace, parent, name);
    }
  }
}

function findBlockBySlotId(
  workspace: Blockly.Workspace,
  slotId: string,
): Blockly.Block | null {
  for (const block of workspace.getAllBlocks(false)) {
    if (block.getFieldValue("SLOT_ID") === slotId) return block;
  }
  return null;
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
  refreshWorkspaceConstraints(workspace);
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
  const visibleChildren = node.children.filter((child) => child.mandatory === true);
  const groups = [...new Set(visibleChildren.map((child) => child.rmAttribute ?? child.label))];
  syncTargetChildInputs(block, groups);
  if (!isRoot) {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
  }
  finalizeBlock(block);
  for (const group of groups) {
    const children = visibleChildren
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
  setMandatoryFlag(block, node.mandatory);
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

      // Content items are user-visible openEHR structure. Optional observations
      // (e.g. Blood pressure 0..1) must still scaffold so they can be mapped.
      if (
        child.blockType === "section" ||
        child.rmType === "SECTION" ||
        child.rmType === "OBSERVATION" ||
        child.rmType === "EVALUATION" ||
        child.rmType === "INSTRUCTION" ||
        child.rmType === "ACTION" ||
        child.rmType === "ADMIN_ENTRY"
      ) return true;

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
  const cards: Record<string, SlotCardinality> = {};
  for (const attr of attributes) {
    const kids = visibleChildren.filter((child) => child.rmAttribute === attr);
    const raw = kids[0]?.slotCardinality ?? kids[0]?.multiplicity;
    const parsed = parseSlotCardinality(raw) ??
      rmAttributeCardinality(node.rmType, attr);
    if (parsed) cards[attr] = parsed;
  }
  block.slotCardinalities_ = cards;
  syncRmAttributeInputs(block, node.rmType, attributes, cards);

  if (!isRoot && !block.outputConnection) {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
  }

  setMandatoryFlag(block, node.mandatory);

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

  const valueMandatory = Boolean(
    (primary?.mandatory ?? false) || Boolean(node.mandatory && primary),
  );
  const allowedValues = primary?.allowedValues ?? node.allowedValues ?? [];
  const allowedOrdinals = primary?.allowedOrdinals ?? node.allowedOrdinals ?? [];
  setMandatoryFlag(block, valueMandatory);

  // Render the ELEMENT shell before attaching the typed DATA_VALUE child.
  finalizeBlock(block);

  const mandated = allowedValues.length === 1 ? allowedValues[0] : undefined;
  const mandatedSet = mandated
    ? termSetForMandatedCode(mandated.terminologyId, mandated.code)
    : undefined;
  const allowedUnits = primary?.allowedUnits ?? node.allowedUnits ?? [];
  if (
    mandatedSet &&
    mandated &&
    (dvType === "DV_CODED_TEXT" || dvType === "CODE_PHRASE")
  ) {
    const pick = createTermPickBlock(
      workspace,
      mandatedSet,
      mandated.code,
      primary?.slotId ?? node.slotId,
    );
    connectBlockToInput(block.getInput("VALUE"), pick);
    finalizeBlock(pick);
  } else if (allowedValues.length > 1 && isCodedChoiceRmType(dvType)) {
    const selector = createCodedValueSetSelector(workspace, dvType, allowedValues);
    connectBlockToInput(block.getInput("VALUE"), selector);
  } else if (allowedOrdinals.length > 1 && isOrdinalChoiceRmType(dvType)) {
    const selector = createOrdinalValueSetSelector(workspace, dvType, allowedOrdinals);
    connectBlockToInput(block.getInput("VALUE"), selector);
  } else if (
    (valueMandatory || allowedValues.length > 1 || allowedOrdinals.length > 1 ||
      allowedUnits.length > 1 ||
      Boolean(primary?.fixedFields?.units ?? node.fixedFields?.units)) &&
    primary &&
    isDataValueType(dvType)
  ) {
    const shell = ensureElementDataValueShell(workspace, block, dvType);
    if (shell) {
      applyFixedFieldsToDataValueShell(
        workspace,
        shell,
        primary.fixedFields ?? node.fixedFields,
      );
      attachValueSetSelector(workspace, shell, allowedValues);
      attachOrdinalSelector(workspace, shell, allowedOrdinals);
      attachUnitSelector(workspace, shell, allowedUnits);
    }
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
  const mandatedCode = node.fixedFields?.code_string ?? node.fixedFields?.defining_code;
  const termSet = (parentRmType && node.rmAttribute
    ? termSetForRmAttribute(parentRmType, node.rmAttribute)
    : undefined) ??
    termSetForMandatedCode(node.fixedFields?.terminology_id, mandatedCode);
  if (termSet) {
    const block = createTermPickBlock(workspace, termSet, mandatedCode, node.slotId);
    setMandatoryFlag(block, node.mandatory);
    return finalizeBlock(block);
  }

  if (
    node.allowedOrdinals &&
    node.allowedOrdinals.length > 1 &&
    isOrdinalChoiceRmType(node.rmType)
  ) {
    const selector = createOrdinalValueSetSelector(
      workspace,
      node.rmType,
      node.allowedOrdinals,
    );
    setMandatoryFlag(selector, node.mandatory);
    refreshBlockLayout(selector);
    return selector;
  }

  if (
    node.allowedValues &&
    node.allowedValues.length > 1 &&
    isCodedChoiceRmType(node.rmType)
  ) {
    const selector = createCodedValueSetSelector(workspace, node.rmType, node.allowedValues);
    setMandatoryFlag(selector, node.mandatory);
    refreshBlockLayout(selector);
    return selector;
  }

  const blockType = node.blockType && node.blockType !== "rm_structure" && node.blockType !== "element"
    ? node.blockType
    : blockTypeForRm(node.rmType);
  ensureRmBlockType(blockType, node.rmType);
  const block = workspace.newBlock(blockType) as BlockSvg;
  setFieldIfPresent(block, "RM_TYPE", node.rmType);
  setFieldIfPresent(block, "SLOT_ID", node.slotId);
  applySkeletonBlockLabels(block, node);
  setMandatoryFlag(block, node.mandatory);
  finalizeBlock(block);
  applyFixedFieldsToDataValueShell(workspace, block, node.fixedFields);
  attachValueSetSelector(workspace, block, node.allowedValues);
  attachOrdinalSelector(workspace, block, node.allowedOrdinals);
  attachUnitSelector(workspace, block, node.allowedUnits);
  refreshBlockLayout(block);
  return block;
}

/**
 * Stock Blockly `lists_getIndex` wrapping `lists_create_with` of template
 * choices. Coded leaves use complete DV objects (rubric + defining_code);
 * string/unit lists stay as text items.
 *
 * @see openehr://spec/type/RM/DV_CODED_TEXT
 */
function attachOrdinalSelector(
  workspace: Blockly.Workspace,
  shell: Blockly.Block,
  values: AllowedOrdinal[] | undefined,
): void {
  if (!values || values.length < 2) return;
  const rmType = (shell.getFieldValue("RM_TYPE") || "").toUpperCase();
  if (!isOrdinalChoiceRmType(rmType)) return;
  const selector = createOrdinalValueSetSelector(workspace, rmType, values);
  connectExpressionToDataValueShell(shell, selector);
}

function attachValueSetSelector(
  workspace: Blockly.Workspace,
  shell: Blockly.Block,
  values: AllowedValue[] | undefined,
): void {
  if (!values || values.length < 2) return;
  const rmType = (shell.getFieldValue("RM_TYPE") || "").toUpperCase();
  if (isCodedChoiceRmType(rmType)) return;
  const selector = createStringListSelector(workspace, values.map((v) => v.label || v.code));
  connectExpressionToDataValueShell(shell, selector);
}

function attachUnitSelector(
  workspace: Blockly.Workspace,
  shell: Blockly.Block,
  units: string[] | undefined,
): void {
  if (!units || units.length < 2) return;
  const input = shell.getInput(dvFieldInputName("units"));
  if (!input?.connection) return;
  const selector = createStringListSelector(workspace, units);
  const existing = input.connection.targetBlock();
  if (existing) existing.dispose(false);
  connectBlockToInput(input, selector);
}

function isCodedChoiceRmType(rmType: string): boolean {
  return rmType === "DV_CODED_TEXT" || rmType === "CODE_PHRASE";
}

function isOrdinalChoiceRmType(rmType: string): boolean {
  return rmType === "DV_ORDINAL" || rmType === "DV_SCALE";
}

type ListCreateBlock = BlockSvg & {
  itemCount_: number;
  updateShape_: () => void;
};

type ListGetIndexBlock = BlockSvg & {
  updateAt_?: (hasAt: boolean) => void;
};

/** lists_getIndex dropdown labels come from Blockly.Msg; tests may not have set a locale. */
function ensureStockListMessages(): void {
  const Msg = (Blockly as unknown as { Msg?: Record<string, string> }).Msg;
  if (Msg?.LISTS_GET_INDEX_FIRST) return;
  const anyMod = enMsg as { default?: Record<string, string> } & Record<string, string>;
  const table = anyMod.default && typeof anyMod.default === "object" ? anyMod.default : anyMod;
  Blockly.setLocale(table);
}

function createCodedValueSetSelector(
  workspace: Blockly.Workspace,
  rmType: string,
  values: AllowedValue[],
): BlockSvg {
  ensureStockListMessages();
  const blockType = rmType === "CODE_PHRASE" ? "code_phrase" : blockTypeForRm(rmType);
  ensureRmBlockType(blockType, rmType);
  const list = workspace.newBlock("lists_create_with") as ListCreateBlock;
  list.itemCount_ = values.length;
  list.updateShape_();
  for (let i = 0; i < values.length; i++) {
    const choice = workspace.newBlock(blockType) as BlockSvg;
    if (choice.getField("RM_TYPE")) choice.setFieldValue(rmType, "RM_TYPE");
    applyFixedFieldsToDataValueShell(workspace, choice, fieldsForAllowedValue(values[i]!, rmType));
    list.getInput(`ADD${i}`)?.connection?.connect(choice.outputConnection!);
    finalizeBlock(choice);
  }
  finalizeBlock(list);
  const assumedIdx = values.findIndex((value) => value.assumed);
  return createListGetIndex(
    workspace,
    list,
    assumedIdx >= 0 ? assumedIdx : 0,
    blocklyCheckForDv(rmType),
  );
}

function fieldsForAllowedValue(
  value: AllowedValue,
  rmType: string,
): Record<string, string> {
  const terminology = value.terminologyId ?? "local";
  if (rmType === "CODE_PHRASE") {
    return { terminology_id: terminology, code_string: value.code };
  }
  return {
    value: value.label || value.code,
    terminology_id: terminology,
    defining_code: value.code,
    code_string: value.code,
  };
}

function fieldsForAllowedOrdinal(value: AllowedOrdinal): Record<string, string> {
  return {
    value: String(value.value),
    symbol_value: value.label,
    terminology_id: value.terminologyId ?? "local",
    defining_code: value.code,
    code_string: value.code,
  };
}

function createOrdinalValueSetSelector(
  workspace: Blockly.Workspace,
  rmType: string,
  values: AllowedOrdinal[],
): BlockSvg {
  ensureStockListMessages();
  const blockType = blockTypeForRm(rmType);
  ensureRmBlockType(blockType, rmType);
  const list = workspace.newBlock("lists_create_with") as ListCreateBlock;
  list.itemCount_ = values.length;
  list.updateShape_();
  for (let i = 0; i < values.length; i++) {
    const choice = workspace.newBlock(blockType) as BlockSvg;
    if (choice.getField("RM_TYPE")) choice.setFieldValue(rmType, "RM_TYPE");
    applyOrdinalFieldsToDataValueShell(
      workspace,
      choice,
      fieldsForAllowedOrdinal(values[i]!),
    );
    list.getInput(`ADD${i}`)?.connection?.connect(choice.outputConnection!);
    finalizeBlock(choice);
  }
  finalizeBlock(list);
  const assumedIdx = values.findIndex((value) => value.assumed);
  return createListGetIndex(
    workspace,
    list,
    assumedIdx >= 0 ? assumedIdx : 0,
    blocklyCheckForDv(rmType),
  );
}

function createStringListSelector(
  workspace: Blockly.Workspace,
  items: string[],
): BlockSvg {
  ensureStockListMessages();
  const list = workspace.newBlock("lists_create_with") as ListCreateBlock;
  list.itemCount_ = items.length;
  list.updateShape_();
  for (let i = 0; i < items.length; i++) {
    const text = workspace.newBlock("text") as BlockSvg;
    text.setFieldValue(items[i]!, "TEXT");
    list.getInput(`ADD${i}`)?.connection?.connect(text.outputConnection!);
    finalizeBlock(text);
  }
  finalizeBlock(list);
  return createListGetIndex(workspace, list, 0, "String");
}

/** 0-based index; Blockly `FROM_START` AT is 1-based (`emitListsGetIndex` subtracts 1). */
function createListGetIndex(
  workspace: Blockly.Workspace,
  list: BlockSvg,
  indexFromStart: number,
  outputCheck?: string | string[] | null,
): BlockSvg {
  ensureStockListMessages();
  const get = workspace.newBlock("lists_getIndex") as ListGetIndexBlock;
  get.setFieldValue("GET", "MODE");
  get.setFieldValue("FROM_START", "WHERE");
  get.updateAt_?.(true);
  const num = workspace.newBlock("math_number") as BlockSvg;
  num.setFieldValue(String(indexFromStart + 1), "NUM");
  get.getInput("AT")?.connection?.connect(num.outputConnection!);
  finalizeBlock(num);
  get.getInput("VALUE")?.connection?.connect(list.outputConnection!);
  if (outputCheck) get.setOutput(true, outputCheck);
  return finalizeBlock(get);
}

function connectBlockToInput(
  input: Blockly.Input | null | undefined,
  child: Blockly.Block,
): void {
  if (!input?.connection || !child.outputConnection) return;
  const parentConn = input.connection;
  const childConn = child.outputConnection;
  const attempt = (): void => {
    if (parentConn.isConnected() && parentConn.targetConnection !== childConn) {
      parentConn.disconnect();
    }
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

function setMandatoryFlag(block: Blockly.Block, mandatory: boolean): void {
  setFieldIfPresent(block, "MANDATORY", mandatory ? "1" : "");
}
