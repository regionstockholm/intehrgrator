/**
 * Instance root connection contract for Conversion start (ADR 0008).
 */
import type { Block } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import type { TargetFormatId } from "../types/mod.ts";
import { isSchemaStructureBlock } from "./blocks/target_blocks.ts";
import { isRmContainerBlockType } from "./blocks/rm_blocks.ts";

export const CONVERSION_START_TYPE = "conversion_start";
export const TEXT_DOCUMENT_BLOCK_TYPE = "text_document";
export const INSTANCE_ROOT_CONNECTION = "INSTANCE_ROOT";

export const INSTANCE_ROOT_BLOCK_TYPES = new Set([
  "composition",
  "json_object",
  "xml_document",
  "xml_element",
  TEXT_DOCUMENT_BLOCK_TYPE,
]);

export function isInstanceRootBlockType(type: string): boolean {
  if (INSTANCE_ROOT_BLOCK_TYPES.has(type)) return true;
  return type.startsWith("schema_");
}

/** Cap an instance root: previous notch for Start, no next notch. */
export function applyInstanceRootCap(block: Block): void {
  if (block.outputConnection?.isConnected()) block.outputConnection.disconnect();
  if (block.nextConnection?.isConnected()) block.nextConnection.disconnect();
  block.setOutput(false);
  block.setNextStatement(false);
  block.setPreviousStatement(true, INSTANCE_ROOT_CONNECTION);
  (block as Block & { isInstanceRoot_?: boolean }).isInstanceRoot_ = true;
}

export function inferTargetFormatFromRoot(block: Block): TargetFormatId | undefined {
  const type = block.type;
  if (type === "composition" || isRmContainerBlockType(type)) return "openehr-template";
  if (isSchemaStructureBlock(block)) {
    const targetType = String(block.getFieldValue("TARGET_TYPE") || "");
    if (targetType.includes("xml") || type.includes("xml")) return "xml-schema";
    return "json-schema";
  }
  if (type === "xml_element" || type === "xml_document") return "xml-schema";
  if (type === "json_object") return "json-schema";
  if (type === TEXT_DOCUMENT_BLOCK_TYPE) return "free-form";
  return undefined;
}

/** Walk from Conversion start to the designated instance root block. */
export function findInstanceRootUnderStart(workspace: Blockly.Workspace): Block | null {
  for (const top of workspace.getTopBlocks(false)) {
    if (top.type !== CONVERSION_START_TYPE) continue;
    const next = top.getNextBlock();
    if (next) return next;
  }
  return null;
}

export function findConversionStartBlock(workspace: Blockly.Workspace): Block | null {
  for (const top of workspace.getTopBlocks(false)) {
    if (top.type === CONVERSION_START_TYPE) return top;
  }
  return null;
}

export function registerConversionStartBlock(): void {
  if (Blockly.Blocks[CONVERSION_START_TYPE]) return;
  Blockly.Blocks[CONVERSION_START_TYPE] = {
    init: function (this: Block) {
      this.appendDummyInput("HEADER")
        .appendField("▶")
        .appendField("Conversion start");
      this.setNextStatement(true, INSTANCE_ROOT_CONNECTION);
      this.setColour("#43A047");
      this.setTooltip(
        "Designates which tree is the conversion product. Not a script trigger — mapping preview and export walk this tree only.",
      );
      this.setDeletable(true);
      this.setMovable(true);
    },
  };
}
