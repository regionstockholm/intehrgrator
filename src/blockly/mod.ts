import * as Blockly from "blockly/core";
import { javascriptGenerator, Order } from "blockly/javascript";
import type { SkeletonNode } from "../types/mod.ts";
import { registerRmBlocks, isDataValueBlock, expressionBlockFromDataValueShell } from "./blocks/rm_blocks.ts";
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
export { createCompactTheme } from "./theme.ts";
export { setOptionalRmPickHandler } from "./blocks/rm_blocks.ts";
export { dataValueLeafTypes, blockTypeForRm, getValidAttachments } from "../core/rm_meta.ts";

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

  javascriptGenerator.forBlock["text_literal"] = (block) => {
    return [JSON.stringify(block.getFieldValue("TEXT") ?? ""), Order.ATOMIC];
  };

  javascriptGenerator.forBlock["number_literal"] = (block) => {
    return [String(block.getFieldValue("NUM") ?? 0), Order.ATOMIC];
  };

  javascriptGenerator.forBlock["boolean_literal"] = (block) => {
    const value = block.getFieldValue("BOOL") === "TRUE";
    return [value ? "true" : "false", Order.ATOMIC];
  };

  for (const rmType of dataValueLeafTypes()) {
    const type = blockTypeForRm(rmType);
    javascriptGenerator.forBlock[type] = (block) => generateDvConstructor(block, rmType);
  }
  // Legacy stub name (fixtures / older workspaces)
  javascriptGenerator.forBlock["dv_quantity_value"] = (block) =>
    generateDvConstructor(block, "DV_QUANTITY");

  javascriptGenerator.forBlock["trim"] = (block) => {
    const v = javascriptGenerator.valueToCode(block, "TEXT", Order.NONE) || '""';
    return [`String(${v}).trim()`, Order.FUNCTION_CALL];
  };

  javascriptGenerator.forBlock["concat"] = (block) => {
    const a = javascriptGenerator.valueToCode(block, "A", Order.NONE) || '""';
    const b = javascriptGenerator.valueToCode(block, "B", Order.NONE) || '""';
    return [`[${a}, ${b}].join('')`, Order.FUNCTION_CALL];
  };

  javascriptGenerator.forBlock["if_then_else"] = (block) => {
    const cond = javascriptGenerator.valueToCode(block, "COND", Order.NONE) || "false";
    const thenV = javascriptGenerator.valueToCode(block, "THEN", Order.NONE) || "null";
    const elseV = javascriptGenerator.valueToCode(block, "ELSE", Order.NONE) || "null";
    return [`(${cond} ? ${thenV} : ${elseV})`, Order.CONDITIONAL];
  };

  javascriptGenerator.forBlock["math_arithmetic"] = (block) => {
    const a = javascriptGenerator.valueToCode(block, "A", Order.ADDITION) || "0";
    const b = javascriptGenerator.valueToCode(block, "B", Order.ADDITION) || "0";
    const opMap: Record<string, string> = {
      ADD: "+",
      MINUS: "-",
      MULTIPLY: "*",
      DIVIDE: "/",
    };
    const op = opMap[block.getFieldValue("OP")] ?? "+";
    return [`(${a} ${op} ${b})`, Order.ADDITION];
  };

  javascriptGenerator.forBlock["switch_case"] = (block) => {
    const discriminant = javascriptGenerator.valueToCode(block, "DISCRIMINANT", Order.NONE) || '""';
    const defaultV = javascriptGenerator.valueToCode(block, "DEFAULT", Order.NONE) || "null";
    const count = block.caseCount_ ?? 1;
    const cases: string[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const match = javascriptGenerator.valueToCode(block, `CASE_${i}_MATCH`, Order.NONE) || '""';
      const out = javascriptGenerator.valueToCode(block, `CASE_${i}_OUT`, Order.NONE) || "null";
      cases.push(`(${discriminant} === ${match} ? ${out} : `);
    }
    return [cases.join("") + defaultV + ")".repeat(count), Order.CONDITIONAL];
  };

  javascriptGenerator.forBlock["mapping_var_get"] = (block) => {
    const name = block.getFieldValue("VAR") || "v";
    return [`__vars[${JSON.stringify(name)}]`, Order.MEMBER];
  };

  javascriptGenerator.forBlock["mapping_var_set"] = (block) => {
    const name = block.getFieldValue("VAR") || "v";
    const value = javascriptGenerator.valueToCode(block, "VALUE", Order.NONE) || "null";
    return `__vars[${JSON.stringify(name)}] = ${value};\n`;
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
    if (block.type !== "element") continue;
    const slotId = block.getFieldValue("SLOT_ID");
    const rmType = block.getFieldValue("RM_TYPE");
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
  // Legacy magnitude/units field names on dv_quantity_value
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
