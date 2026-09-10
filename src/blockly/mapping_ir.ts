/**
 * Blockly workspace → Mapping Model extract (#37).
 * Public seam: `workspaceToModelJson` in `mod.ts`.
 */

import type { Workspace } from "blockly/core";
import type { Block } from "blockly/core";
import type {
  MappingLoop,
  MappingSlotHatch,
  MappingUnsupportedBlock,
  OptionalRmInsertion,
  TargetSignatureNode,
} from "../types/mod.ts";
import {
  expressionBlockFromDataValueShell,
  isDataValueBlock,
  optionalRmExtrasOf,
  optionalRmInputName,
  OPTIONAL_INPUT_PREFIX,
  rmAttributeInputName,
} from "./blocks/rm_blocks.ts";
import { isGenericValueBlockType, isSchemaStructureBlock } from "./blocks/target_blocks.ts";
import { schemaSlotIdForInput } from "./schema_blocks.ts";
import { isSchemaOptionalInput, schemaOptionalExtrasOf, schemaOptionalInputName } from "./blocks/schema_mutator.ts";
import { blockToExpression } from "./expression_serialize.ts";
import { SHEET_ACCESSOR_TYPES, SHEET_BLOCK_TYPE } from "./blocks/sheet_blocks.ts";
import { DECISION_TABLE_BLOCK, DECISION_TABLE_DECL } from "./blocks/decision_table_blocks.ts";
import { MAPS_GET } from "../core/defaults/extract.ts";
import { isVmsEscapeBlockType, isVmsRemovedBlockType } from "./vms.ts";
import { isTemplateEscapeHatch } from "./vms_linter.ts";

export interface MappingModelExtract {
  slots: Array<{
    slotId: string;
    rmType: string;
    expression: string;
    hatch?: MappingSlotHatch;
  }>;
  loops: MappingLoop[];
  optionalRm: OptionalRmInsertion[];
  targetSignature: TargetSignatureNode[];
  unsupported: MappingUnsupportedBlock[];
  sheetNames: string[];
}

const LOOP_TYPES = new Set(["for_each_source", "for_each_list"]);

export function extractMappingIr(workspace: Workspace): MappingModelExtract {
  const slots = slotsFromWorkspace(workspace);
  return {
    slots,
    loops: loopsFromWorkspace(workspace),
    optionalRm: optionalRmFromWorkspace(workspace),
    targetSignature: targetSignatureFromWorkspace(workspace),
    unsupported: unsupportedFromWorkspace(workspace, slots),
    sheetNames: sheetNamesFromWorkspace(workspace),
  };
}

function slotsFromWorkspace(workspace: Workspace): MappingModelExtract["slots"] {
  const slots: MappingModelExtract["slots"] = [];
  const seen = new Set<string>();
  for (const block of workspace.getAllBlocks(false)) {
    if (block.type === MAPS_GET) {
      const slotId = block.getFieldValue("SLOT_ID");
      const expression = blockToExpression(block);
      const rmType = block.getFieldValue("RM_TYPE") || "CODE_PHRASE";
      if (slotId && expression && !seen.has(slotId)) {
        seen.add(slotId);
        slots.push({ slotId, rmType, expression });
      }
      continue;
    }
    if (block.type === "party_identified") {
      const slotId = block.getFieldValue("SLOT_ID");
      const exprBlock = block.getInputTargetBlock(rmAttributeInputName("name"));
      const expression = blockToExpression(exprBlock);
      if (slotId && expression && !seen.has(slotId)) {
        seen.add(slotId);
        const hatch = hatchFromExprTree(exprBlock);
        slots.push(hatch ? { slotId, rmType: "PARTY_IDENTIFIED", expression, hatch } : {
          slotId,
          rmType: "PARTY_IDENTIFIED",
          expression,
        });
      }
      continue;
    }
    if (
      block.type !== "element" && !isGenericValueBlockType(block.type) && !isDataValueBlock(block) &&
      !isSchemaStructureBlock(block)
    ) {
      continue;
    }
    if (isSchemaStructureBlock(block)) {
      for (const input of block.inputList) {
        if (!input.name.startsWith("TARGET_") && !input.name.startsWith("SCHEMA_OPT_")) continue;
        if (input.type === 3) continue;
        const fieldSlot = schemaSlotIdForInput(block, input.name);
        const exprBlock = block.getInputTargetBlock(input.name);
        const expression = blockToExpression(exprBlock);
        if (fieldSlot && expression && !seen.has(fieldSlot)) {
          seen.add(fieldSlot);
          const attr = input.name.replace(/^TARGET_|^SCHEMA_OPT_/, "");
          const hatch = hatchFromExprTree(exprBlock);
          slots.push(hatch ? { slotId: fieldSlot, rmType: attr, expression, hatch } : {
            slotId: fieldSlot,
            rmType: attr,
            expression,
          });
        }
      }
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
      const hatch = hatchFromExprTree(exprBlock);
      slots.push(hatch ? { slotId, rmType, expression, hatch } : { slotId, rmType, expression });
    }
  }
  return slots;
}

function optionalRmFromWorkspace(workspace: Workspace): OptionalRmInsertion[] {
  const out: OptionalRmInsertion[] = [];
  for (const block of workspace.getAllBlocks(false)) {
    const slotId = block.getFieldValue("SLOT_ID");
    if (!slotId) continue;
    const extras = isSchemaStructureBlock(block)
      ? schemaOptionalExtrasOf(block)
      : optionalRmExtrasOf(block);
    if (!extras.length) continue;
    for (const name of extras) {
      const input = isSchemaStructureBlock(block)
        ? block.getInput(schemaOptionalInputName(name))
        : block.getInput(optionalRmInputName(name)) ??
          block.getInput(rmAttributeInputName(name));
      const child = input?.connection?.targetBlock();
      const rmType = child?.getFieldValue("RM_TYPE") ||
        child?.getFieldValue("TARGET_TYPE") ||
        (child ? String(child.type).toUpperCase() : name);
      out.push({ attachmentSlotId: slotId, rmType, attributeName: name });
    }
  }
  return out;
}

function loopsFromWorkspace(workspace: Workspace): MappingLoop[] {
  const loops: MappingLoop[] = [];
  for (const block of workspace.getAllBlocks(false)) {
    if (block.type === "for_each_source") {
      const inner = block.getInputTargetBlock("DO");
      const attachSlotId = firstSlotIdInStack(inner);
      const varName = String(block.getFieldValue("VAR") || "");
      const path = String(block.getFieldValue("PATH") || "");
      if (attachSlotId && varName && path) {
        loops.push({ attachSlotId, varName, path, kind: "source" });
      }
      continue;
    }
    if (block.type !== "for_each_list") continue;
    const inner = block.getInputTargetBlock("DO");
    const attachSlotId = firstSlotIdInStack(inner);
    const varName = String(block.getFieldValue("VAR") || "");
    const listBlock = block.getInputTargetBlock("LIST");
    const collection = blockToExpression(listBlock) ?? undefined;
    if (attachSlotId && varName) {
      loops.push({
        attachSlotId,
        varName,
        path: "",
        kind: "list",
        ...(collection ? { collection } : {}),
      });
    }
  }
  return loops;
}

function firstSlotIdInStack(block: Block | null): string | null {
  let current = block;
  while (current) {
    if (!LOOP_TYPES.has(current.type)) {
      const slotId = current.getFieldValue("SLOT_ID");
      if (slotId) return slotId;
    }
    const nested = current.type === "for_each_source" || current.type === "for_each_list"
      ? firstSlotIdInStack(current.getInputTargetBlock("DO"))
      : null;
    if (nested) return nested;
    current = current.getNextBlock();
  }
  return null;
}

function targetSignatureFromWorkspace(workspace: Workspace): TargetSignatureNode[] {
  const nodes = new Map<string, TargetSignatureNode>();
  const parentOf = new Map<string, string>();
  const optionalIds = new Set<string>();

  for (const block of workspace.getAllBlocks(false)) {
    if (LOOP_TYPES.has(block.type)) continue;
    const slotId = block.getFieldValue("SLOT_ID");
    if (!slotId || nodes.has(slotId)) continue;
    const rmType = String(
      block.getFieldValue("RM_TYPE") || block.getFieldValue("TARGET_TYPE") || block.type,
    );
    const label = String(block.getFieldValue("LABEL") || block.getFieldValue("NAME") || "");
    nodes.set(slotId, {
      slotId,
      rmType,
      ...(label ? { label } : {}),
      children: [],
    });
    const parent = nearestSlotParent(block);
    if (parent) {
      parentOf.set(slotId, parent.slotId);
      if (parent.optional) optionalIds.add(slotId);
    }
  }

  for (const [id, node] of nodes) {
    if (optionalIds.has(id)) node.optional = true;
    const parentId = parentOf.get(id);
    if (parentId) {
      const parent = nodes.get(parentId);
      if (parent) parent.children.push(node);
    }
  }

  const roots: TargetSignatureNode[] = [];
  for (const [id, node] of nodes) {
    if (!parentOf.has(id)) roots.push(node);
  }
  return roots;
}

function nearestSlotParent(block: Block): { slotId: string; optional: boolean } | null {
  let current: Block | null = block.getParent();
  let child: Block = block;
  while (current) {
    if (!LOOP_TYPES.has(current.type)) {
      const slotId = current.getFieldValue("SLOT_ID");
      if (slotId) {
        return { slotId, optional: isOptionalAttachment(current, child) };
      }
    }
    child = current;
    current = current.getParent();
  }
  return null;
}

function isOptionalAttachment(parent: Block, child: Block): boolean {
  for (const input of parent.inputList) {
    if (!input.name) continue;
    let connected: Block | null = parent.getInputTargetBlock(input.name);
    while (connected) {
      if (connected === child || descendantOf(connected, child)) {
        return input.name.startsWith(OPTIONAL_INPUT_PREFIX) || isSchemaOptionalInput(input.name);
      }
      connected = connected.getNextBlock();
    }
  }
  return false;
}

function descendantOf(root: Block, target: Block): boolean {
  let current: Block | null = target;
  while (current) {
    if (current === root) return true;
    current = current.getParent();
  }
  return false;
}

function unsupportedFromWorkspace(
  workspace: Workspace,
  slots: MappingModelExtract["slots"],
): MappingUnsupportedBlock[] {
  const out: MappingUnsupportedBlock[] = [];
  const seen = new Set<string>();

  const record = (
    block: Block,
    reason: MappingUnsupportedBlock["reason"],
  ): void => {
    if (seen.has(block.id)) return;
    seen.add(block.id);
    const slotId = enclosingSlotId(block);
    const lang = block.type === "text_code" ? String(block.getFieldValue("LANG") || "") : "";
    out.push({
      blockType: block.type,
      reason,
      ...(slotId ? { slotId } : {}),
      ...(lang ? { lang } : {}),
    });
  };

  for (const block of workspace.getAllBlocks(false)) {
    if (block.isShadow?.()) continue;
    if (isVmsRemovedBlockType(block.type)) {
      record(block, "removed");
      continue;
    }
    if (block.type === "text_code") {
      const lang = String(block.getFieldValue("LANG") || "");
      const text = String(block.getFieldValue("TEXT") || "");
      if (isTemplateEscapeHatch("text_code", lang, text)) record(block, "escape");
      continue;
    }
    if (block.type === "text_handlebars") {
      const script = block.getInputTargetBlock("SCRIPT");
      const text = script
        ? String(script.getFieldValue("TEXT") || "")
        : "";
      if (isTemplateEscapeHatch("text_handlebars", undefined, text)) {
        record(block, "escape");
      }
      continue;
    }
    if (isVmsEscapeBlockType(block.type)) record(block, "escape");
  }

  const mapped = new Set(slots.map((s) => s.slotId));
  for (const block of workspace.getAllBlocks(false)) {
    if (block.isShadow?.()) continue;
    if (isVmsRemovedBlockType(block.type) || isVmsEscapeBlockType(block.type)) continue;
    if (LOOP_TYPES.has(block.type)) continue;
    const slotId = block.getFieldValue("SLOT_ID");
    if (!slotId || mapped.has(slotId)) continue;
    const valueBlock = block.getInputTargetBlock("VALUE");
    if (!valueBlock) continue;
    const exprBlock = isDataValueBlock(valueBlock)
      ? expressionBlockFromDataValueShell(valueBlock)
      : valueBlock;
    if (exprBlock && !blockToExpression(exprBlock)) {
      record(exprBlock, isVmsEscapeBlockType(exprBlock.type) ? "escape" : "unsupported");
    }
  }

  return out;
}

function enclosingSlotId(block: Block): string | undefined {
  let current: Block | null = block;
  while (current) {
    if (!LOOP_TYPES.has(current.type)) {
      const slotId = current.getFieldValue("SLOT_ID");
      if (slotId) return slotId;
    }
    current = current.getParent();
  }
  return undefined;
}

function hatchFromExprTree(block: Block | null): MappingSlotHatch | undefined {
  if (!block) return undefined;
  if (block.type === "text_code") {
    const lang = String(block.getFieldValue("LANG") || "") || undefined;
    const text = String(block.getFieldValue("TEXT") || "");
    if (!isTemplateEscapeHatch("text_code", lang, text)) return undefined;
    return { kind: "text_code", lang };
  }
  if (block.type === "text_handlebars") {
    const script = block.getInputTargetBlock("SCRIPT");
    const text = script ? String(script.getFieldValue("TEXT") || "") : "";
    if (!isTemplateEscapeHatch("text_handlebars", undefined, text)) return undefined;
    return { kind: "text_handlebars" };
  }
  if (block.type === "procedures_callreturn") return { kind: "procedures_callreturn" };
  for (const input of block.inputList) {
    const child = block.getInputTargetBlock(input.name);
    const found = hatchFromExprTree(child);
    if (found) return found;
  }
  return undefined;
}

function sheetNamesFromWorkspace(workspace: Workspace): string[] {
  const names = new Set<string>();
  const accessors = new Set<string>([...SHEET_ACCESSOR_TYPES, DECISION_TABLE_BLOCK]);
  for (const block of workspace.getAllBlocks(false)) {
    if (
      block.type !== SHEET_BLOCK_TYPE &&
      block.type !== DECISION_TABLE_DECL &&
      !accessors.has(block.type)
    ) continue;
    const name = String(block.getFieldValue("NAME") || "").trim();
    if (name) names.add(name);
  }
  return [...names];
}
