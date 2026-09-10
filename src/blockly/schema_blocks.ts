/**
 * Schema-specific Blockly structure blocks: connection shape, type checks,
 * and inlined primitive slots (no wrapper `target_value` for UserId/PatId).
 */
import type { Block, BlockSvg, WorkspaceSvg } from "blockly/core";
import type { SkeletonNode } from "../types/mod.ts";
import {
  isSchemaStructureBlockType,
  schemaConnectionMode,
  schemaFieldName,
  schemaInputSpecs,
  type SchemaInputSpec,
} from "../core/target/schema_block_ids.ts";
import { findSkeletonNode, findSkeletonNodeByBlockType, setSchemaCatalog } from "./schema_catalog.ts";
import {
  applySchemaConnectionMode,
  ensureSchemaStructureType,
  syncSchemaFieldInputs,
  TARGET_CHILD_PREFIX,
} from "./blocks/target_blocks.ts";
import { applyInstanceRootCap } from "./instance_root.ts";

export type { SchemaInputSpec };
export { specForChild, schemaInputSpecs } from "../core/target/schema_block_ids.ts";

export interface SchemaStructureExtraState {
  connection?: "statement" | "value";
  typeCheck?: string;
  fields?: SchemaInputSpec[];
  optionalFields?: SchemaInputSpec[];
  childGroups?: string[];
  extras?: string[];
  xmlAttributes?: string[];
  instanceRoot?: boolean;
}

export function registerSchemaBlocksFromSkeleton(skeleton: SkeletonNode[]): void {
  setSchemaCatalog(skeleton);
  const walk = (node: SkeletonNode) => {
    if (node.kind === "container" && isSchemaStructureBlockType(node.blockType)) {
      ensureSchemaStructureType(node.blockType);
    }
    for (const child of node.children) walk(child);
  };
  for (const root of skeleton) walk(root);
}

export function configureSchemaStructureBlock(
  block: Block,
  node: SkeletonNode,
  isRoot: boolean,
): void {
  const typeCheck = node.blockType;
  const mode = schemaConnectionMode(node, isRoot);
  applySchemaConnectionMode(block, mode, typeCheck);
  const fields = schemaInputSpecs(node, { mandatoryOnly: true });
  syncSchemaFieldInputs(block, fields);
  storeSchemaFieldState(block, fields);
}

export function storeSchemaFieldState(block: Block, fields: SchemaInputSpec[]): void {
  (block as Block & { schemaFields_?: SchemaInputSpec[] }).schemaFields_ = fields;
  (block as Block & { schemaXmlAttributes_?: string[] }).schemaXmlAttributes_ =
    fields.filter((field) => field.xmlKind === "attribute").map((field) => field.name);
}

export function schemaExtraStateOf(block: Block): SchemaStructureExtraState | null {
  const fields = (block as Block & { schemaFields_?: SchemaInputSpec[] }).schemaFields_;
  const extras = block.schemaExtraFields_ ?? [];
  const connection = (block as Block & { schemaConnectionMode_?: "statement" | "value" })
    .schemaConnectionMode_;
  const typeCheck = (block as Block & { schemaTypeCheck_?: string }).schemaTypeCheck_;
  const xmlAttributes = (block as Block & { schemaXmlAttributes_?: string[] })
    .schemaXmlAttributes_;
  const payload: SchemaStructureExtraState = {};
  if (connection) payload.connection = connection;
  if (typeCheck) payload.typeCheck = typeCheck;
  if (fields?.length) payload.fields = fields;
  if (extras.length) payload.extras = extras;
  const optionalFields = extras.map((name) =>
    (block.schemaOptionalSpecs_ ?? []).find((spec) => spec.name === name)
  ).filter((spec): spec is SchemaInputSpec => Boolean(spec));
  if (optionalFields.length) payload.optionalFields = optionalFields;
  if (xmlAttributes?.length) payload.xmlAttributes = xmlAttributes;
  const childGroups = block.inputList
    .filter((input) => input.name.startsWith(TARGET_CHILD_PREFIX))
    .map((input) => input.name.slice(TARGET_CHILD_PREFIX.length));
  if (!fields?.length && childGroups.length) payload.childGroups = childGroups;
  if ((block as Block & { isInstanceRoot_?: boolean }).isInstanceRoot_) {
    payload.instanceRoot = true;
  }
  return Object.keys(payload).length ? payload : null;
}

export function restoreSchemaExtraState(
  block: Block,
  state: SchemaStructureExtraState | null | undefined,
): void {
  const typeCheck = state?.typeCheck || block.type;
  const connection = state?.connection ??
    (block.outputConnection ? "value" : "statement");
  applySchemaConnectionMode(block, connection, typeCheck);
  const fields = state?.fields?.length
    ? state.fields
    : (state?.childGroups ?? []).map((name) => ({
      name,
      kind: "statement" as const,
      check: null,
      slotId: "",
    }));
  storeSchemaFieldState(block, fields);
  syncSchemaFieldInputs(block, fields);
  block.schemaExtraFields_ = Array.isArray(state?.extras) ? state!.extras! : [];
  block.schemaOptionalSpecs_ = Array.isArray(state?.optionalFields) ? state!.optionalFields! : [];
  block.updateSchemaFields_?.();
  if (state?.instanceRoot) applyInstanceRootCap(block);
}

export function schemaSlotIdForInput(block: Block, inputName: string): string | null {
  const name = inputName.startsWith(TARGET_CHILD_PREFIX)
    ? inputName.slice(TARGET_CHILD_PREFIX.length)
    : inputName.startsWith("SCHEMA_OPT_")
    ? inputName.slice("SCHEMA_OPT_".length)
    : "";
  if (!name) return null;
  const fields = (block as Block & { schemaFields_?: SchemaInputSpec[] }).schemaFields_;
  const fromState = fields?.find((field) => field.name === name);
  if (fromState?.slotId) return fromState.slotId;
  const optional = (block.schemaOptionalSpecs_ ?? []).find((field) => field.name === name);
  if (optional?.slotId) return optional.slotId;
  const parentSlotId = String(block.getFieldValue("SLOT_ID") ?? "");
  const parent = (parentSlotId ? findSkeletonNode(parentSlotId) : undefined) ??
    findSkeletonNodeByBlockType(block.type);
  const child = parent?.children.find((node) => schemaFieldName(node) === name);
  return child?.slotId ?? null;
}

export function createSchemaStructureBlock(
  workspace: WorkspaceSvg,
  node: SkeletonNode,
  isRoot: boolean,
): BlockSvg {
  ensureSchemaStructureType(node.blockType);
  const block = workspace.newBlock(node.blockType) as BlockSvg;
  configureSchemaStructureBlock(block, node, isRoot);
  return block;
}

/** Unique complex types for the Target schema toolbox (skip inlined primitives). */
export function uniqueSchemaContainerNodes(skeleton: SkeletonNode[]): SkeletonNode[] {
  const seen = new Set<string>();
  const out: SkeletonNode[] = [];
  const walk = (node: SkeletonNode) => {
    if (
      node.kind === "container" &&
      isSchemaStructureBlockType(node.blockType) &&
      !seen.has(node.blockType)
    ) {
      seen.add(node.blockType);
      out.push(node);
    }
    for (const child of node.children) walk(child);
  };
  for (const root of skeleton) walk(root);
  return out;
}
