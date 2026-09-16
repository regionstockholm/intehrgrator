/**
 * Compact inspect payloads for Agent API / MCP (no DOM).
 */

import type { MappingModel, SchemaTreeNode, SkeletonNode } from "../types/mod.ts";
import { collectValueSlots } from "../core/skeleton/generate_skeleton.ts";
import { INSTANCE_ENCODING_FIELD } from "../core/output/instance_encoding.ts";
import { parseInstanceEncoding } from "../core/output/instance_encoding.ts";
import type { SheetDocument } from "../core/sheets/mod.ts";

export interface SlotInspectRow {
  slotId: string;
  valueType: string;
  label?: string;
  multiplicity?: string;
  mapped: boolean;
  expression?: string;
  mandatory?: boolean;
}

export interface SourceTreeNode {
  path: string;
  name: string;
  type: string;
  multiplicity?: string;
  value?: unknown;
  children?: SourceTreeNode[];
}

export interface ProductStackRow {
  type: string;
  encoding?: string;
  varName?: string;
  path?: string;
}

interface BlocklyJsonNode {
  type?: string;
  fields?: Record<string, unknown>;
  next?: { block?: BlocklyJsonNode };
  extraState?: unknown;
}

export function listSlotsInspect(skeleton: SkeletonNode[], model: MappingModel): SlotInspectRow[] {
  const byId = new Map(model.slots.map((s) => [s.slotId, s]));
  return collectValueSlots(skeleton).map((slot) => {
    const mapped = byId.get(slot.slotId);
    const expression = mapped?.expression;
    return {
      slotId: slot.slotId,
      valueType: slot.rmType,
      ...(slot.label ? { label: slot.label } : {}),
      ...(slot.multiplicity ? { multiplicity: slot.multiplicity } : {}),
      mapped: Boolean(expression),
      ...(expression ? { expression } : {}),
      ...(slot.mandatory ? { mandatory: true } : {}),
    };
  });
}

export function compactSourceTree(
  node: SchemaTreeNode | null | undefined,
  depth = 0,
  maxDepth = 8,
): SourceTreeNode | null {
  if (!node) return null;
  const row: SourceTreeNode = {
    path: node.path,
    name: node.name,
    type: node.type,
  };
  if (node.multiplicity) row.multiplicity = node.multiplicity;
  if (node.value !== undefined && (typeof node.value !== "object" || node.value === null)) {
    row.value = node.value;
  }
  if (depth < maxDepth && node.children.length) {
    row.children = node.children
      .map((child) => compactSourceTree(child, depth + 1, maxDepth))
      .filter((c): c is SourceTreeNode => Boolean(c));
  }
  return row;
}

export function productStackInspect(blocklyState: unknown): ProductStackRow[] {
  const tops = topBlocks(blocklyState);
  const start = tops.find((block) => block.type === "conversion_start");
  const rows: ProductStackRow[] = [];
  let current = start?.next?.block;
  while (current?.type) {
    const fields = current.fields ?? {};
    const encodingRaw = fields[INSTANCE_ENCODING_FIELD];
    rows.push({
      type: current.type,
      ...(typeof encodingRaw === "string"
        ? { encoding: parseInstanceEncoding(encodingRaw) }
        : {}),
      ...(typeof fields.VAR === "string" ? { varName: fields.VAR } : {}),
      ...(typeof fields.PATH === "string" ? { path: fields.PATH } : {}),
    });
    current = current.next?.block;
  }
  return rows;
}

function topBlocks(state: unknown): BlocklyJsonNode[] {
  if (!state || typeof state !== "object") return [];
  const blocks = (state as { blocks?: { blocks?: BlocklyJsonNode[] } }).blocks?.blocks;
  return Array.isArray(blocks) ? blocks : [];
}

export function sheetSummaries(sheets: SheetDocument[]): Array<{
  name: string;
  kind: string;
  headers: string[];
  rows: number;
}> {
  return sheets.map((sheet) => ({
    name: sheet.name,
    kind: sheet.kind === "decision-table" ? "decision-table" : "sheet",
    headers: [...sheet.headers],
    rows: sheet.values.length,
  }));
}
