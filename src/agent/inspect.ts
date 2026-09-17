/**
 * Compact inspect payloads for Agent API / MCP (no DOM).
 */

import type { AllowedValue, MappingModel, SchemaTreeNode, SkeletonNode } from "../types/mod.ts";
import {
  collectRepeatableContainers,
  collectValueSlots,
  findSkeletonTrail,
  nearestRepeatingContainer,
  pathLabelFromTrail,
} from "../core/skeleton/generate_skeleton.ts";
import { INSTANCE_ENCODING_FIELD } from "../core/output/instance_encoding.ts";
import { parseInstanceEncoding } from "../core/output/instance_encoding.ts";
import { validateModel } from "../core/mapping_model/mod.ts";
import { lintDecisionTable, type SheetDocument } from "../core/sheets/mod.ts";

export interface SlotInspectRow {
  slotId: string;
  valueType: string;
  label?: string;
  /** Ancestor labels that are not raw RM type names (e.g. `Vårdenhet › Namn`). */
  pathLabel?: string;
  multiplicity?: string;
  /** Repeating ancestor `attachSlotId` for `loops[]` (`for_each_source`). */
  attachSlotId?: string;
  mapped: boolean;
  expression?: string;
  mandatory?: boolean;
  /** Constrained unique UCUM unit copied onto the DV_QUANTITY shell. */
  unitsFixed?: string;
  allowedUnits?: string[];
  /** Unique constrained code when the template pins a single coded value. */
  codeFixed?: string;
  terminologyFixed?: string;
  /** Template-constrained coded/string choices (ISM, setting, local at-codes). */
  allowedValues?: AllowedValue[];
}

export interface RepeatableInspectRow {
  slotId: string;
  rmType: string;
  label?: string;
  multiplicity?: string;
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

export interface ConstraintWarningRow {
  slotId?: string;
  blockId?: string;
  sheetName?: string;
  message: string;
  severity: "error" | "warning";
}

interface BlocklyJsonNode {
  type?: string;
  id?: string;
  fields?: Record<string, unknown>;
  next?: { block?: BlocklyJsonNode };
  inputs?: Record<string, { block?: BlocklyJsonNode; shadow?: BlocklyJsonNode }>;
  extraState?: unknown;
}

/** Same copy as `block_constraints.ts` (kept here so inspect stays Blockly-free). */
const ABSTRACT_EVENT_WARNING =
  "EVENT is abstract. Choose POINT_EVENT or INTERVAL_EVENT — runtime instances cannot be the abstract EVENT class.";
const ABSTRACT_ITEM_STRUCTURE_WARNING =
  "ITEM_STRUCTURE is abstract. Choose ITEM_TREE, ITEM_LIST, ITEM_TABLE, or ITEM_SINGLE — runtime instances cannot be the abstract ITEM_STRUCTURE class.";

export function listSlotsInspect(skeleton: SkeletonNode[], model: MappingModel): SlotInspectRow[] {
  const byId = new Map(model.slots.map((s) => [s.slotId, s]));
  const seen = new Set<string>();
  const rows: SlotInspectRow[] = [];
  for (const slot of collectValueSlots(skeleton)) {
    if (seen.has(slot.slotId)) continue;
    seen.add(slot.slotId);
    const mapped = byId.get(slot.slotId);
    const expression = mapped?.expression;
    const trail = findSkeletonTrail(skeleton, slot.slotId);
    const repeating = nearestRepeatingContainer(trail);
    const pathLabel = pathLabelFromTrail(trail);
    rows.push({
      slotId: slot.slotId,
      valueType: slot.rmType,
      ...(slot.label ? { label: slot.label } : {}),
      ...(pathLabel ? { pathLabel } : {}),
      ...(slot.multiplicity ? { multiplicity: slot.multiplicity } : {}),
      ...(repeating ? { attachSlotId: repeating.slotId } : {}),
      mapped: Boolean(expression),
      ...(expression ? { expression } : {}),
      ...(slot.mandatory ? { mandatory: true } : {}),
      ...(slot.fixedFields?.units ? { unitsFixed: String(slot.fixedFields.units) } : {}),
      ...(slot.fixedFields?.code_string || slot.fixedFields?.defining_code
        ? { codeFixed: String(slot.fixedFields.code_string ?? slot.fixedFields.defining_code) }
        : {}),
      ...(slot.fixedFields?.terminology_id
        ? { terminologyFixed: String(slot.fixedFields.terminology_id) }
        : {}),
      ...(slot.allowedUnits?.length ? { allowedUnits: [...slot.allowedUnits] } : {}),
      ...(slot.allowedValues?.length ? { allowedValues: slot.allowedValues.map(cloneAllowedValue) } : {}),
    });
  }
  return rows;
}

export function listRepeatableInspect(skeleton: SkeletonNode[]): RepeatableInspectRow[] {
  return collectRepeatableContainers(skeleton).map((node) => ({
    slotId: node.slotId,
    rmType: node.rmType,
    ...(node.label ? { label: node.label } : {}),
    ...(node.multiplicity ? { multiplicity: node.multiplicity } : {}),
  }));
}

function cloneAllowedValue(value: AllowedValue): AllowedValue {
  return {
    code: value.code,
    label: value.label,
    ...(value.terminologyId ? { terminologyId: value.terminologyId } : {}),
    ...(value.assumed ? { assumed: true } : {}),
  };
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

/** DOM-free Constraint warnings: Mapping Model, Decision table lint, abstract RM types. */
export function constraintWarningsInspect(options: {
  skeleton: SkeletonNode[];
  model: MappingModel;
  sheets: SheetDocument[];
  blocklyState: unknown;
}): ConstraintWarningRow[] {
  const out: ConstraintWarningRow[] = [];
  for (const issue of validateModel(options.model, options.skeleton)) {
    out.push({
      ...(issue.slotId ? { slotId: issue.slotId } : {}),
      message: issue.message,
      severity: issue.severity,
    });
  }
  for (const sheet of options.sheets) {
    for (const diagnostic of lintDecisionTable(sheet)) {
      out.push({
        sheetName: sheet.name,
        message: diagnostic.message,
        severity: diagnostic.severity === "error" ? "error" : "warning",
      });
    }
  }
  collectAbstractRmWarnings(options.blocklyState, out);
  return out;
}

function collectAbstractRmWarnings(state: unknown, out: ConstraintWarningRow[]): void {
  for (const block of topBlocks(state)) walkBlockForAbstractRm(block, out);
}

function walkBlockForAbstractRm(block: BlocklyJsonNode | undefined, out: ConstraintWarningRow[]): void {
  if (!block) return;
  const rmType = String(block.fields?.RM_TYPE ?? "").toUpperCase();
  if (rmType === "EVENT") {
    out.push({
      ...(block.id ? { blockId: block.id } : {}),
      message: ABSTRACT_EVENT_WARNING,
      severity: "warning",
    });
  }
  if (rmType === "ITEM_STRUCTURE") {
    out.push({
      ...(block.id ? { blockId: block.id } : {}),
      message: ABSTRACT_ITEM_STRUCTURE_WARNING,
      severity: "warning",
    });
  }
  if (block.next?.block) walkBlockForAbstractRm(block.next.block, out);
  if (block.inputs) {
    for (const input of Object.values(block.inputs)) {
      walkBlockForAbstractRm(input?.block, out);
      walkBlockForAbstractRm(input?.shadow, out);
    }
  }
}
