import * as Blockly from "blockly/core";
import { javascriptGenerator, Order } from "blockly/javascript";
import type { SkeletonNode } from "../types/mod.ts";
import { registerRmBlocks } from "./blocks/rm_blocks.ts";
import { registerExpressionBlocks } from "./blocks/expression_blocks.ts";

export {
  applyModelExpressions,
  highlightListeningSlot,
  loadSkeletonIntoWorkspace,
  slotIdFromBlock,
} from "./skeleton_loader.ts";

export function initBlocklyGenerators(): void {
  registerRmBlocks();
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

  javascriptGenerator.forBlock["dv_quantity_value"] = (block) => {
    const child = javascriptGenerator.valueToCode(block, "MAGNITUDE", Order.NONE) || "0";
    const units = block.getFieldValue("UNITS") || "1";
    return [`new openehr_rm.DV_QUANTITY({ magnitude: ${child}, units: ${JSON.stringify(units)} })`, Order.NEW];
  };

  javascriptGenerator.forBlock["trim"] = (block) => {
    const v = javascriptGenerator.valueToCode(block, "TEXT", Order.NONE) || '""';
    return [`String(${v}).trim()`, Order.FUNCTION_CALL];
  };

  javascriptGenerator.forBlock["if_then_else"] = (block) => {
    const cond = javascriptGenerator.valueToCode(block, "COND", Order.NONE) || "false";
    const thenV = javascriptGenerator.valueToCode(block, "THEN", Order.NONE) || "null";
    const elseV = javascriptGenerator.valueToCode(block, "ELSE", Order.NONE) || "null";
    return [`(${cond} ? ${thenV} : ${elseV})`, Order.CONDITIONAL];
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
    if (block.type.endsWith("_value") || block.type === "element") {
      const slotId = block.getFieldValue("SLOT_ID");
      const rmType = block.getFieldValue("RM_TYPE");
      const exprBlock = block.getInputTargetBlock("VALUE");
      if (slotId && exprBlock?.type === "source_query") {
        slots.push({
          slotId,
          rmType,
          expression: `xpath${capitalize(exprBlock.getFieldValue("RETURN_TYPE") || "String")}(${JSON.stringify(exprBlock.getFieldValue("EXPRESSION"))})`,
        });
      }
    }
  }
  return { slots };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
