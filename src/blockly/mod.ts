import * as Blockly from "blockly/core";
import "blockly/blocks";
import { javascriptGenerator, Order } from "blockly/javascript";
import type { SkeletonNode } from "../types/mod.ts";
import { registerRmBlocks, isDataValueBlock, expressionBlockFromDataValueShell } from "./blocks/rm_blocks.ts";
import { registerTargetBlocks } from "./blocks/target_blocks.ts";
import { registerExpressionBlocks } from "./blocks/expression_blocks.ts";
import { blockToExpression } from "./expression_serialize.ts";
import { attributesFor, dataValueLeafTypes, blockTypeForRm, isPrimitiveRmType } from "../core/rm_meta.ts";

export {
  applyModelExpressions,
  highlightListeningSlot,
  loadSkeletonIntoWorkspace,
  slotIdFromBlock,
} from "./skeleton_loader.ts";
export { blockToExpression } from "./expression_serialize.ts";
export { createModestTheme } from "./theme.ts";
/** @deprecated use createModestTheme */
export { createModestTheme as createCompactTheme } from "./theme.ts";
export { setOptionalRmPickHandler } from "./blocks/rm_blocks.ts";
export { dataValueLeafTypes, blockTypeForRm, getValidAttachments } from "../core/rm_meta.ts";
export { buildDemoToolbox } from "./toolbox_demo.ts";

export function initBlocklyGenerators(): void {
  registerRmBlocks();
  registerTargetBlocks();
  registerExpressionBlocks();
  registerGenerators();
}

function registerGenerators(): void {
  javascriptGenerator.forBlock["source_query"] = (block) => {
    const expr = block.getFieldValue("EXPRESSION");
    const ret = block.getFieldValue("RETURN_TYPE") || "string";
    const fn = ret === "number"
      ? "evaluateXPathToNumber"
      : ret === "boolean"
      ? "evaluateXPathToBoolean"
      : "evaluateXPathToString";
    return [`${fn}(${JSON.stringify(expr)}, sourceCtx.data)`, Order.FUNCTION_CALL];
  };

  for (const rmType of dataValueLeafTypes()) {
    const type = blockTypeForRm(rmType);
    javascriptGenerator.forBlock[type] = (block) => generateDvConstructor(block, rmType);
  }
  javascriptGenerator.forBlock["dv_quantity_value"] = (block) =>
    generateDvConstructor(block, "DV_QUANTITY");

  javascriptGenerator.forBlock["for_each_source"] = (block) => {
    const name = block.getFieldValue("VAR") || "item";
    const path = block.getFieldValue("PATH") || "/";
    const body = javascriptGenerator.statementToCode(block, "DO");
    return (
      `for (const __node of evaluateXPathToNodes(${JSON.stringify(path)}, sourceCtx.data)) {\n` +
      `  __vars[${JSON.stringify(name)}] = __node;\n` +
      `${body}}\n`
    );
  };
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
} {
  const slots: Array<{ slotId: string; rmType: string; expression: string }> = [];
  for (const block of workspace.getAllBlocks(false)) {
    if (block.type !== "element" && block.type !== "target_value") continue;
    const slotId = block.getFieldValue("SLOT_ID");
    const rmType = block.getFieldValue("RM_TYPE") || block.getFieldValue("TARGET_TYPE");
    const valueBlock = block.getInputTargetBlock("VALUE");
    const exprBlock = valueBlock && isDataValueBlock(valueBlock)
      ? expressionBlockFromDataValueShell(valueBlock)
      : valueBlock;
    const expression = blockToExpression(exprBlock);
    if (slotId && expression) {
      slots.push({ slotId, rmType, expression });
    }
  }
  return { slots };
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
