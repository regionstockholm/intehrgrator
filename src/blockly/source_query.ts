import type { Block } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import { blocklyCheckForReturnType } from "./block_checks.ts";

type BlockSvg = import("blockly/core").BlockSvg;
type Workspace = import("blockly/core").Workspace;
type WorkspaceSvg = import("blockly/core").WorkspaceSvg;

export const SOURCE_QUERY_BLOCK_TYPES = [
  "source_query",
  "source_query_number",
  "source_query_boolean",
] as const;

export type SourceQueryBlockType = typeof SOURCE_QUERY_BLOCK_TYPES[number];
export type SourceReturnType = "string" | "number" | "boolean";

export function isSourceQueryBlockType(type: string): type is SourceQueryBlockType {
  return (SOURCE_QUERY_BLOCK_TYPES as readonly string[]).includes(type);
}

export function sourceBlockTypeForReturnType(returnType: string): SourceQueryBlockType {
  if (returnType === "number") return "source_query_number";
  if (returnType === "boolean") return "source_query_boolean";
  return "source_query";
}

export function returnTypeFromSourceBlockType(blockType: string): SourceReturnType {
  if (blockType === "source_query_number") return "number";
  if (blockType === "source_query_boolean") return "boolean";
  return "string";
}

/** Map JSON Schema / instance `typeof` names onto Blockly source return types. */
export function sourceReturnTypeFromSchemaType(
  schemaType: string | undefined,
): SourceReturnType {
  const t = (schemaType ?? "").toLowerCase();
  if (t === "integer" || t === "number") return "number";
  if (t === "boolean") return "boolean";
  return "string";
}

export function returnTypeFromSourceBlock(block: Block): SourceReturnType {
  if (block.type === "source_query_number") return "number";
  if (block.type === "source_query_boolean") return "boolean";
  const ret = block.getFieldValue("RETURN_TYPE");
  if (ret === "number" || ret === "boolean") return ret;
  return "string";
}

export function createSourceQueryBlock(
  workspace: Workspace,
  xpath: string,
  returnType: string,
): BlockSvg {
  const blockType = sourceBlockTypeForReturnType(returnType);
  const block = workspace.newBlock(blockType) as BlockSvg;
  block.setFieldValue(xpath, "EXPRESSION");
  if (block.getField("RETURN_TYPE")) {
    block.setFieldValue(returnType, "RETURN_TYPE");
  }
  return finalizeRenderedBlock(block);
}

/** Create a top-level source block at workspace coordinates (canvas drop). */
export function placeSourceQueryBlock(
  workspace: WorkspaceSvg,
  xpath: string,
  returnType: string,
  x: number,
  y: number,
): BlockSvg {
  const block = createSourceQueryBlock(workspace, xpath, returnType);
  try {
    moveBlockTo(block, x, y);
  } catch {
    // Leave at the default origin if the workspace has no SVG metrics yet.
  }
  return block;
}

function moveBlockTo(block: BlockSvg, x: number, y: number): void {
  const Coord = Blockly.utils?.Coordinate;
  if (typeof block.moveTo === "function" && typeof Coord === "function") {
    block.moveTo(new Coord(x, y));
    return;
  }
  const cur = typeof block.getRelativeToSurfaceXY === "function"
    ? block.getRelativeToSurfaceXY()
    : { x: 0, y: 0 };
  block.moveBy(x - cur.x, y - cur.y);
}

export function workspacePositionFromClient(
  workspace: WorkspaceSvg,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  try {
    const svg = workspace.getParentSvg?.();
    const inverse = workspace.getInverseScreenCTM?.();
    if (svg && inverse && typeof DOMPoint !== "undefined") {
      const pt = new DOMPoint(clientX, clientY).matrixTransform(inverse);
      const origin = workspace.getOriginOffsetInPixels?.() ?? { x: 0, y: 0 };
      const scale = workspace.scale || 1;
      return {
        x: (pt.x - origin.x) / scale,
        y: (pt.y - origin.y) / scale,
      };
    }
  } catch {
    // fall through
  }
  return { x: 20, y: 20 };
}

export function xpathEvaluatorForReturnType(returnType: string): string {
  if (returnType === "number") return "xpathNumber";
  if (returnType === "boolean") return "xpathBoolean";
  return "xpathString";
}

export function fontoxpathFnForReturnType(returnType: string): string {
  if (returnType === "number") return "evaluateXPathToNumber";
  if (returnType === "boolean") return "evaluateXPathToBoolean";
  return "evaluateXPathToString";
}

export function outputCheckForSourceBlock(block: Block): string | null {
  return blocklyCheckForReturnType(returnTypeFromSourceBlock(block));
}

function finalizeRenderedBlock(block: BlockSvg): BlockSvg {
  try {
    if (typeof document !== "undefined" && typeof block.initSvg === "function") {
      block.initSvg();
      block.render();
    }
  } catch {
    // Headless Blockly.Workspace used in unit tests has no SVG.
  }
  return block;
}
