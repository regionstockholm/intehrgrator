import * as Blockly from "blockly/core";
import "blockly/blocks";
import { javascriptGenerator, Order } from "blockly/javascript";
import type { MappingLoop, SkeletonNode } from "../types/mod.ts";
import { registerRmBlocks, isDataValueBlock, expressionBlockFromDataValueShell, rmAttributeInputName } from "./blocks/rm_blocks.ts";
import { isGenericValueBlockType, registerTargetBlocks } from "./blocks/target_blocks.ts";
import { registerExpressionBlocks } from "./blocks/expression_blocks.ts";
import { registerMapBlocks } from "./blocks/map_blocks.ts";
import { blockToExpression } from "./expression_serialize.ts";
import { attributesFor, dataValueLeafTypes, blockTypeForRm, isPrimitiveRmType } from "../core/rm_meta.ts";
import { TERM_PICK_NONE, termSetById } from "../core/openehr_term_catalog.ts";
import { TERM_PICK_BLOCK_TYPE } from "./blocks/term_pick.ts";
import {
  SOURCE_QUERY_BLOCK_TYPES,
  fontoxpathFnForReturnType,
  returnTypeFromSourceBlock,
} from "./source_query.ts";

export {
  applyModelExpressions,
  applyModelLoops,
  attachOptionalRmChild,
  highlightListeningSlot,
  loadSkeletonIntoWorkspace,
  lockWorkspaceRootsExpanded,
  setAllBlocksCollapsed,
  slotIdFromBlock,
} from "./skeleton_loader.ts";
export { applySkeletonBlockLabels, relabelWorkspaceFromSkeleton } from "./block_labels.ts";
export { refreshWorkspaceConstraints, ABSTRACT_EVENT_WARNING, warningTextOf } from "./block_constraints.ts";
export { blockToExpression } from "./expression_serialize.ts";
export {
  createSourceQueryBlock,
  isSourceQueryBlockType,
  placeSourceQueryBlock,
  sourceBlockTypeForReturnType,
  sourceQueryFieldLabel,
  sourceReturnTypeFromSchemaType,
  SOURCE_TYPE_EMOJI,
  workspacePositionFromClient,
} from "./source_query.ts";
export { createModestTheme } from "./theme.ts";
/** @deprecated use createModestTheme */
export { createModestTheme as createCompactTheme } from "./theme.ts";
export { registerCompactThrasosRenderer, COMPACT_RENDERER_NAME } from "./compact_renderer.ts";
export {
  openWorkspaceSnapshotWindow,
  workspaceToStandaloneSvg,
} from "./workspace_snapshot.ts";
export { setOptionalRmPickHandler, applyEventRmType, isEventFamilyType } from "./blocks/rm_blocks.ts";
export { dataValueLeafTypes, blockTypeForRm, getValidAttachments } from "../core/rm_meta.ts";
export { isRmContainerBlockType } from "./blocks/rm_blocks.ts";
export { buildDemoToolbox, type ToolboxContext } from "./toolbox_demo.ts";
export {
  attachDefaultPointLookups,
  captureDefaultsBlockState,
  ensureDefaultsBlock,
  findDefaultsBlock,
  hydrateDefaultsMapArgument,
  placeDefaultsBesideSkeleton,
  restoreDefaultsBlockState,
  serializeDefaultsMapArgument,
} from "./defaults_canvas.ts";
export { setDefaultsMapPickHandler, setDefaultsMapInfoHandler } from "./blocks/map_blocks.ts";
export { installBlocklyFloatingOverlays } from "./floating_overlays.ts";

export function initBlocklyGenerators(): void {
  registerRmBlocks();
  registerTargetBlocks();
  registerExpressionBlocks();
  registerMapBlocks();
  registerGenerators();
}

function registerGenerators(): void {
  const sourceGenerator = (block: Blockly.Block) => {
    const expr = block.getFieldValue("EXPRESSION");
    const fn = fontoxpathFnForReturnType(returnTypeFromSourceBlock(block));
    return [`${fn}(${JSON.stringify(expr)}, sourceCtx.data)`, Order.FUNCTION_CALL] as [string, number];
  };
  for (const type of SOURCE_QUERY_BLOCK_TYPES) {
    javascriptGenerator.forBlock[type] = sourceGenerator;
  }

  for (const rmType of dataValueLeafTypes()) {
    const type = blockTypeForRm(rmType);
    javascriptGenerator.forBlock[type] = (block) => generateDvConstructor(block, rmType);
  }
  javascriptGenerator.forBlock["dv_quantity_value"] = (block) =>
    generateDvConstructor(block, "DV_QUANTITY");

  javascriptGenerator.forBlock["code_phrase"] = (block) => {
    const code = javascriptGenerator.valueToCode(block, "FLD_code_string", Order.NONE) ||
      '""';
    const terminology = javascriptGenerator.valueToCode(block, "FLD_terminology_id", Order.NONE) ||
      '""';
    return [
      `new openehr_rm.CODE_PHRASE({ terminology_id: { value: ${terminology} }, code_string: ${code} })`,
      Order.NEW,
    ] as [string, number];
  };

  javascriptGenerator.forBlock[TERM_PICK_BLOCK_TYPE] = (block) => {
    const set = termSetById(block.getFieldValue("SET"));
    const rawCode = block.getFieldValue("CODE");
    const code = rawCode === TERM_PICK_NONE ? "" : rawCode;
    const terminology = JSON.stringify(set?.terminologyId ?? "openehr");
    const codeJson = JSON.stringify(code);
    const rubric = set?.codes.find((item) => item.code === code)?.rubric ?? code;
    const phrase =
      `new openehr_rm.CODE_PHRASE({ terminology_id: { value: ${terminology} }, code_string: ${codeJson} })`;
    if (set?.valueRmType === "DV_CODED_TEXT") {
      return [
        `new openehr_rm.DV_CODED_TEXT({ value: ${JSON.stringify(rubric)}, defining_code: ${phrase} })`,
        Order.NEW,
      ] as [string, number];
    }
    return [phrase, Order.NEW] as [string, number];
  };

  javascriptGenerator.forBlock["for_each_source"] = (block) => {
    const name = block.getFieldValue("VAR") || "item";
    const path = block.getFieldValue("PATH") || "/";
    const ident = /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : "__node";
    const body = javascriptGenerator.statementToCode(block, "DO").trim();
    const returned = body ? stripTrailingComma(body) : "null";
    return (
      `...evaluateXPathToNodes(${JSON.stringify(path)}, sourceCtx.data).map((${ident}) => {\n` +
      `  __vars[${JSON.stringify(name)}] = ${ident};\n` +
      `  return ${returned};\n` +
      `}),\n`
    );
  };

  javascriptGenerator.forBlock["maps_get"] = (block) => {
    const name = JSON.stringify(block.getFieldValue("NAME") || "defaults");
    const key = javascriptGenerator.valueToCode(block, "KEY", Order.NONE) || '""';
    return [
      `(${name} === "defaults" ? defaults : {})[${key}]`,
      Order.MEMBER,
    ] as [string, number];
  };

  javascriptGenerator.forBlock["composition"] = (block) => {
    const parts = [`_type: "COMPOSITION"`];
    for (const input of block.inputList) {
      if (!input.name.startsWith("ATTR_")) continue;
      const attr = input.name.slice("ATTR_".length);
      const generated = generateRmAttributeCode(block, input.name);
      if (generated.value) {
        parts.push(`${attr}: ${generated.value}`);
        continue;
      }
      if (!generated.stmt?.trim()) continue;
      if (attr === "content") parts.push(`content: [\n${generated.stmt}]`);
      else parts.push(`${attr}: ${stripTrailingComma(generated.stmt)}`);
    }
    return `const composition = new openehr_rm.COMPOSITION({ ${parts.join(", ")} });\n`;
  };
  javascriptGenerator.forBlock["section"] = rmObjectStatement("SECTION", ["items"]);
  javascriptGenerator.forBlock["observation"] = rmObjectStatement("OBSERVATION", [
    "data",
    "state",
    "protocol",
  ]);
  javascriptGenerator.forBlock["evaluation"] = rmObjectStatement("EVALUATION", [
    "data",
    "protocol",
  ]);
  javascriptGenerator.forBlock["instruction"] = rmObjectStatement("INSTRUCTION", [
    "activities",
    "protocol",
  ]);
  javascriptGenerator.forBlock["action"] = rmObjectStatement("ACTION", [
    "description",
    "protocol",
  ]);
  javascriptGenerator.forBlock["admin_entry"] = rmObjectStatement("ADMIN_ENTRY", ["data"]);
  javascriptGenerator.forBlock["cluster"] = rmObjectStatement("CLUSTER", ["items"]);
}

export function skeletonToBlocklyXml(skeleton: SkeletonNode[]): string {
  const workspace = new Blockly.Workspace();
  let y = 20;
  for (const node of skeleton) {
    const block = createBlockFromSkeleton(workspace, node);
    if (block) {
      block.moveBy(20, y);
      y += block.getHeightWidth().height + 20;
    }
  }
  const xml = Blockly.serialization.workspaces.save(workspace);
  workspace.dispose();
  return JSON.stringify(xml);
}

function createBlockFromSkeleton(
  workspace: Blockly.Workspace,
  node: SkeletonNode,
): Blockly.Block | null {
  const block = workspace.newBlock(node.blockType);
  block.initSvg();
  block.render();

  if (node.archetypeNodeId) {
    const field = block.getField("ARCHETYPE_NODE_ID");
    if (field) field.setValue(node.archetypeNodeId);
  }
  if (node.label && block.getField("NAME")) {
    block.getField("NAME")!.setValue(node.label);
  }

  if (node.kind === "value") {
    block.setFieldValue(node.rmType, "RM_TYPE");
    block.setFieldValue(node.slotId, "SLOT_ID");
  }

  let inputIndex = 0;
  for (const child of node.children) {
    const childBlock = createBlockFromSkeleton(workspace, child);
    if (!childBlock) continue;
    const input = block.inputList[inputIndex++];
    if (input?.connection) {
      input.connection.connect(childBlock.previousConnection ?? childBlock.outputConnection);
    }
  }

  return block;
}

export function workspaceToModelJson(workspace: Blockly.Workspace): {
  slots: Array<{ slotId: string; rmType: string; expression: string }>;
  loops: MappingLoop[];
} {
  const slots: Array<{ slotId: string; rmType: string; expression: string }> = [];
  const seen = new Set<string>();
  for (const block of workspace.getAllBlocks(false)) {
    if (block.type === "party_identified") {
      const slotId = block.getFieldValue("SLOT_ID");
      const exprBlock = block.getInputTargetBlock(rmAttributeInputName("name"));
      const expression = blockToExpression(exprBlock);
      if (slotId && expression && !seen.has(slotId)) {
        seen.add(slotId);
        slots.push({ slotId, rmType: "PARTY_IDENTIFIED", expression });
      }
      continue;
    }
    if (block.type !== "element" && !isGenericValueBlockType(block.type) && !isDataValueBlock(block)) {
      continue;
    }
    const slotId = block.getFieldValue("SLOT_ID");
    const rmType = block.getFieldValue("RM_TYPE") || block.getFieldValue("TARGET_TYPE");
    const valueBlock = block.getInputTargetBlock("VALUE");
    const exprBlock = valueBlock && isDataValueBlock(valueBlock)
      ? expressionBlockFromDataValueShell(valueBlock)
      : isDataValueBlock(block)
      ? expressionBlockFromDataValueShell(block)
      : valueBlock;
    const expression = blockToExpression(exprBlock);
    if (slotId && expression && !seen.has(slotId)) {
      seen.add(slotId);
      slots.push({ slotId, rmType, expression });
    }
  }
  return { slots, loops: loopsFromWorkspace(workspace) };
}

function loopsFromWorkspace(workspace: Blockly.Workspace): MappingLoop[] {
  const loops: MappingLoop[] = [];
  for (const block of workspace.getAllBlocks(false)) {
    if (block.type !== "for_each_source") continue;
    const inner = block.getInputTargetBlock("DO");
    const attachSlotId = firstSlotIdInStack(inner);
    const varName = String(block.getFieldValue("VAR") || "");
    const path = String(block.getFieldValue("PATH") || "");
    if (attachSlotId && varName && path) {
      loops.push({ attachSlotId, varName, path });
    }
  }
  return loops;
}

function firstSlotIdInStack(block: Blockly.Block | null): string | null {
  let current = block;
  while (current) {
    const slotId = current.getFieldValue("SLOT_ID");
    if (slotId) return slotId;
    current = current.getNextBlock();
  }
  return null;
}

function rmObjectStatement(rmType: string, attrs: string[]) {
  return (block: Blockly.Block) => {
    const parts = [`_type: ${JSON.stringify(rmType)}`];
    const seen = new Set<string>();
    const names = [
      ...attrs,
      ...block.inputList
        .filter((input) => input.name.startsWith("ATTR_"))
        .map((input) => input.name.slice("ATTR_".length)),
    ];
    for (const attr of names) {
      if (seen.has(attr)) continue;
      seen.add(attr);
      const inputName = rmAttributeInputName(attr);
      const generated = generateRmAttributeCode(block, inputName);
      if (generated.value) {
        parts.push(`${attr}: ${generated.value}`);
        continue;
      }
      const stmt = generated.stmt ?? "";
      if (!stmt.trim()) continue;
      const asList = ["content", "items", "events", "activities"].includes(attr);
      parts.push(asList ? `${attr}: [\n${stmt}]` : `${attr}: ${stripTrailingComma(stmt)}`);
    }
    return `{ ${parts.join(", ")} },\n`;
  };
}

function stripTrailingComma(code: string): string {
  return code.trim().replace(/,\s*$/, "");
}

/** Blockly `inputTypes.STATEMENT` / `ConnectionType.NEXT_STATEMENT`. */
const STATEMENT_INPUT_TYPE = 3;

function generateRmAttributeCode(
  block: Blockly.Block,
  inputName: string,
): { value?: string; stmt?: string } {
  const input = block.getInput(inputName);
  if (!input) return {};
  if (input.type === STATEMENT_INPUT_TYPE) {
    return { stmt: javascriptGenerator.statementToCode(block, inputName) };
  }
  const value = javascriptGenerator.valueToCode(block, inputName, Order.NONE);
  return value ? { value } : {};
}

function generateDvConstructor(block: Blockly.Block, rmType: string): [string, number] {
  const parts: string[] = [];
  for (const attr of attributesFor(rmType)) {
    if (!isPrimitiveRmType(attr.typeName) && attr.typeName !== "CODE_PHRASE") {
      continue;
    }
    const inputName = block.getInput(`FLD_${attr.name}`)
      ? `FLD_${attr.name}`
      : block.getInput(`OPTFLD_${attr.name}`)
      ? `OPTFLD_${attr.name}`
      : null;
    if (!inputName) continue;
    const code = javascriptGenerator.valueToCode(block, inputName, Order.NONE);
    if (!code) continue;
    parts.push(`${attr.name}: ${code}`);
  }
  if (rmType === "DV_QUANTITY" && !parts.some((p) => p.startsWith("magnitude"))) {
    const mag = javascriptGenerator.valueToCode(block, "MAGNITUDE", Order.NONE);
    if (mag) parts.push(`magnitude: ${mag}`);
    const unitsField = block.getFieldValue("UNITS");
    if (unitsField) parts.push(`units: ${JSON.stringify(unitsField)}`);
  }
  return [
    `new openehr_rm.${rmType}({ ${parts.join(", ")} })`,
    Order.NEW,
  ];
}

/** Toolbox entries for concrete DATA_VALUE leaves. */
export function dataValueToolboxContents(): Array<{ kind: string; type: string }> {
  return dataValueLeafTypes().map((rmType) => ({
    kind: "block",
    type: blockTypeForRm(rmType),
  }));
}
