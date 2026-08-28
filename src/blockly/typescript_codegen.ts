/**
 * Blockly workspace → TypeScript conversion script (ehrtslib constructors).
 *
 * Preferred over the skeleton walker when a canvas snapshot is available so
 * Optional RM Insertion, `for_each_source`, and live block edits show up in
 * Generated conversion script(s).
 */

import type { Block, Workspace } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import { blockToExpression } from "./expression_serialize.ts";
import {
  isDataValueBlock,
  isRmContainerBlockType,
  rmAttributeInputName,
  RM_ATTR_INPUT_PREFIX,
  RM_SPECIALIZATION_INPUT,
  isEventFamilyType,
  isItemStructureFamilyType,
} from "./blocks/rm_blocks.ts";
import { isGenericValueBlockType } from "./blocks/target_blocks.ts";
import { TERM_PICK_BLOCK_TYPE } from "./blocks/term_pick.ts";
import { TERM_PICK_NONE, termSetById } from "../core/openehr_term_catalog.ts";
import { DEFAULTS_BLOCK_TYPE } from "../core/defaults/extract.ts";
import { attributesFor, isPrimitiveRmType } from "../core/rm_meta.ts";
import { LOCATABLE_TYPES } from "../core/rm_mandatory.ts";
import type { MappingModel } from "../types/mod.ts";
import {
  asStringExpr,
  createTsEmitContext,
  emitTsExpressionSource,
  formatObjectLiteral,
  formatRmConstruct,
  generateTypeScriptFromSkeleton,
  generateTypeScriptFromSlots,
  indentTsBlock,
  isBlankGeneratedExpr,
  isListAttribute,
  wrapTypeScriptModule,
  type TsEmitContext,
} from "../core/codegen/typescript.ts";
import { registerExportTargetAdapter } from "../core/codegen/mod.ts";
import { migrateMapsCreateWithJson } from "../core/defaults/mod.ts";
import { runWithoutBlocklyEvents } from "./blockly_events.ts";

const STATEMENT_INPUT_TYPE = 3;

export function registerTypeScriptExportAdapter(): void {
  registerExportTargetAdapter({
    id: "typescript",
    extension: "ts",
    mime: "text/typescript",
    generate(model, options) {
      if (options?.blocklyState) {
        const fromCanvas = generateTypeScriptFromBlocklyState(options.blocklyState, model);
        if (fromCanvas) return fromCanvas;
      }
      if (options?.skeleton?.length) {
        return generateTypeScriptFromSkeleton(model, options.skeleton);
      }
      return generateTypeScriptFromSlots(model);
    },
  });
}

export function generateTypeScriptFromBlocklyState(
  state: unknown,
  model: MappingModel,
): string | null {
  if (!state || typeof state !== "object") return null;
  const workspace = new Blockly.Workspace();
  try {
    const snapshot = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    migrateMapsCreateWithJson(snapshot);
    let generated: string | null = null;
    runWithoutBlocklyEvents(() => {
      Blockly.serialization.workspaces.load(snapshot, workspace);
      generated = generateTypeScriptFromWorkspace(workspace, model);
    });
    return generated;
  } catch (err) {
    console.warn("TypeScript codegen from Blockly failed; falling back to skeleton", err);
    return null;
  } finally {
    workspace.dispose();
  }
}

export function generateTypeScriptFromWorkspace(
  workspace: Workspace,
  model: MappingModel,
): string | null {
  const ctx = createTsEmitContext();
  const roots = workspace.getTopBlocks(true).filter((block) =>
    block.type !== DEFAULTS_BLOCK_TYPE &&
    block.type !== "maps_create_with"
  );
  const composition = roots.find((block) => block.type === "composition") ??
    roots.find((block) => isRmContainerBlockType(block.type));

  let body: string;
  let rootType: string | undefined;
  if (composition) {
    const code = emitBlock(composition, ctx, 0);
    rootType = rmTypeOf(composition);
    if (rootType === "COMPOSITION") {
      body = `const composition = ${code};\nreturn composition;`;
    } else {
      body = `return ${code};`;
    }
  } else if (model.targetFormat && model.targetFormat !== "openehr-template") {
    const generic = roots.find((block) =>
      block.type === "target_structure" || block.type === "json_object"
    );
    if (generic) {
      body = `return ${emitGeneric(generic, ctx, 0)};`;
    } else {
      return null;
    }
  } else {
    return null;
  }

  return wrapTypeScriptModule({
    templateId: model.templateId,
    body,
    types: ctx.types,
    helpers: ctx.helpers,
    rootType,
    source: "blockly",
  });
}

function emitBlock(block: Block, ctx: TsEmitContext, indent: number): string {
  const fromExpr = emitExpressionBlock(block, ctx);
  if (fromExpr !== null) return fromExpr;

  if (block.type === "for_each_source") return emitForEach(block, ctx, indent);
  if (block.type === TERM_PICK_BLOCK_TYPE) return emitTermPick(block, ctx);
  if (block.type === "code_phrase") return emitCodePhrase(block, ctx, indent);
  if (block.type === "party_ref") return emitPartyRef(block, ctx, indent);
  if (block.type === "party_identified" || block.type === "party_related") {
    return emitRmContainer(block, ctx, indent);
  }
  if (block.type === "party_self") {
    ctx.types.add("PARTY_SELF");
    return "new PARTY_SELF()";
  }
  if (block.type === "party_proxy") {
    const kind = block.getInputTargetBlock(RM_SPECIALIZATION_INPUT);
    if (kind) return emitBlock(kind, ctx, indent);
    ctx.types.add("PARTY_SELF");
    return "new PARTY_SELF()";
  }
  if (block.type === "lists_getIndex") return emitListsGetIndex(block, ctx);
  if (block.type === "lists_create_with") return emitListsCreate(block, ctx);
  if (block.type === "element" || isRmContainerBlockType(block.type)) {
    return emitRmContainer(block, ctx, indent);
  }
  if (isDataValueBlock(block)) return emitDvShell(block, ctx, indent);
  if (isGenericValueBlockType(block.type) || block.type === "target_structure") {
    return emitGeneric(block, ctx, indent);
  }
  return "undefined";
}

function emitExpressionBlock(block: Block, ctx: TsEmitContext): string | null {
  const serialized = blockToExpression(block);
  if (!serialized) return null;
  return emitTsExpressionSource(serialized, ctx);
}

function emitRmContainer(block: Block, ctx: TsEmitContext, indent: number): string {
  const rmType = rmTypeOf(block);
  const props = collectRmProps(block, ctx, indent);
  if (!props.length && rmType !== "COMPOSITION") {
    if (rmType === "PARTY_SELF") {
      ctx.types.add("PARTY_SELF");
      return "new PARTY_SELF()";
    }
    return "";
  }
  return formatRmConstruct(rmType, props, indent, ctx);
}

function collectRmProps(
  block: Block,
  ctx: TsEmitContext,
  indent: number,
): Array<[string, string]> {
  const rmType = rmTypeOf(block);
  const props: Array<[string, string]> = [];
  const name = String(block.getFieldValue("NAME") ?? "").trim();
  const nodeId = String(block.getFieldValue("ARCHETYPE_NODE_ID") ?? "").trim();
  if (name && shouldEmitLocatableName(rmType, name)) {
    props.push([
      "name",
      rmType === "COMPOSITION"
        ? JSON.stringify(name)
        : (ctx.types.add("DV_TEXT"), `new DV_TEXT(${JSON.stringify(name)})`),
    ]);
  }
  if (nodeId) props.push(["archetype_node_id", JSON.stringify(nodeId)]);

  if (block.type === "element") {
    const value = block.getInputTargetBlock("VALUE");
    if (value && !value.isShadow()) {
      const code = emitBlock(value, ctx, indent + 1);
      if (!isBlankGeneratedExpr(code)) props.push(["value", code]);
    }
  }

  const seen = new Set<string>();
  for (const input of block.inputList) {
    if (!input.name.startsWith(RM_ATTR_INPUT_PREFIX)) continue;
    const attr = input.name.slice(RM_ATTR_INPUT_PREFIX.length);
    if (seen.has(attr)) continue;
    seen.add(attr);
    const code = emitAttribute(block, input.name, attr, rmType, ctx, indent);
    if (code && !isBlankGeneratedExpr(code)) props.push([attr, code]);
  }
  return props;
}

function emitAttribute(
  block: Block,
  inputName: string,
  attr: string,
  parentRmType: string,
  ctx: TsEmitContext,
  indent: number,
): string | null {
  const input = block.getInput(inputName);
  if (!input) return null;
  if (input.type === STATEMENT_INPUT_TYPE) {
    return emitStatementList(
      block.getInputTargetBlock(inputName),
      isListAttribute(parentRmType, attr),
      ctx,
      indent,
    );
  }
  const target = block.getInputTargetBlock(inputName);
  if (!target || target.isShadow()) return null;
  if (target.type === "lists_create_with") {
    return emitListsCreate(target, ctx);
  }
  if (isListAttribute(parentRmType, attr)) {
    const code = emitBlock(target, ctx, indent + 1);
    if (!code || isBlankGeneratedExpr(code)) return null;
    return `[${code}]`;
  }
  const simplified = emitSimplifiedParty(attr, target, ctx, indent);
  if (simplified) return simplified;
  const code = emitBlock(target, ctx, indent + 1);
  return isBlankGeneratedExpr(code) ? null : code;
}

function emitSimplifiedParty(
  attr: string,
  block: Block,
  ctx: TsEmitContext,
  indent: number,
): string | null {
  if (attr !== "composer" && attr !== "health_care_facility") return null;
  if (block.type !== "party_identified" && block.type !== "party_related") return null;
  const nameBlock = block.getInputTargetBlock(rmAttributeInputName("name"));
  const name = nameBlock && !nameBlock.isShadow()
    ? emitBlock(nameBlock, ctx, indent + 1)
    : null;
  if (!name) return null;
  return `{ name: ${asStringExpr(name)} }`;
}

function emitStatementList(
  first: Block | null,
  asList: boolean,
  ctx: TsEmitContext,
  indent: number,
): string | null {
  const blocks: Block[] = [];
  let current = first;
  while (current) {
    blocks.push(current);
    current = current.getNextBlock();
  }
  if (!blocks.length) return null;
  const asArray = asList || blocks.length > 1 ||
    blocks.some((block) => block.type === "for_each_source");
  if (!asArray) {
    const code = emitBlock(blocks[0]!, ctx, indent + 1);
    return isBlankGeneratedExpr(code) ? null : code;
  }
  const parts: string[] = [];
  for (const block of blocks) {
    const code = block.type === "for_each_source"
      ? emitForEach(block, ctx, 0)
      : emitBlock(block, ctx, 0);
    if (!isBlankGeneratedExpr(code)) parts.push(indentTsBlock(code, indent + 2));
  }
  if (!parts.length) return null;
  return `[\n${parts.join(",\n")},\n${"  ".repeat(indent + 1)}]`;
}

function emitForEach(block: Block, ctx: TsEmitContext, indent: number): string {
  ctx.helpers.add("nodes");
  const name = String(block.getFieldValue("VAR") || "item");
  const path = String(block.getFieldValue("PATH") || "/");
  const ident = /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : "__node";
  const innerCtx: TsEmitContext = {
    ...ctx,
    sourceVar: ident,
    loopVar: ident,
  };
  const bodyBlock = block.getInputTargetBlock("DO");
  const body = bodyBlock
    ? emitBlock(bodyBlock, innerCtx, indent)
    : "undefined";
  return "...xpathNodes(" + JSON.stringify(path) + ").map((" + ident + ") => " +
    body + ")";
}

function emitDvShell(block: Block, ctx: TsEmitContext, indent: number): string {
  const rmType = String(block.getFieldValue("RM_TYPE") || block.type.replace(/-/g, "_"))
    .toUpperCase();
  if (rmType === "CODE_PHRASE" || block.type === "code_phrase") {
    return emitCodePhrase(block, ctx, indent);
  }
  const props: Array<[string, string]> = [];
  for (const attr of attributesFor(rmType)) {
    if (!isPrimitiveRmType(attr.typeName) && attr.typeName !== "CODE_PHRASE") continue;
    const inputName = block.getInput(`FLD_${attr.name}`)
      ? `FLD_${attr.name}`
      : block.getInput(`OPTFLD_${attr.name}`)
      ? `OPTFLD_${attr.name}`
      : null;
    if (!inputName) continue;
    const child = block.getInputTargetBlock(inputName);
    if (!child) continue;
    if (child.isShadow()) {
      if (child.type === "math_number" || isEmptyShadow(child)) continue;
      const shadow = emitBlock(child, ctx, indent + 1);
      if (isEmptyLiteral(shadow)) continue;
      props.push([attr.name, shadow]);
      continue;
    }
    const code = emitBlock(child, ctx, indent + 1);
    if (isBlankGeneratedExpr(code)) continue;
    const wrapped = attr.name === "magnitude"
      ? code
      : (attr.typeName === "String" || attr.name === "value" || attr.name === "code_string" ||
          attr.name === "units" || attr.name === "terminology_id")
      ? asStringExpr(code)
      : code;
    props.push([attr.name, wrapped]);
  }
  if (rmType === "DV_QUANTITY" && !props.some((p) => p[0] === "magnitude")) {
    const mag = block.getInputTargetBlock("MAGNITUDE");
    if (mag && !mag.isShadow()) {
      props.push(["magnitude", emitBlock(mag, ctx, indent + 1)]);
    }
    const units = block.getFieldValue("UNITS");
    if (units) props.push(["units", JSON.stringify(units)]);
  }
  if (rmType === "DV_TEXT" && props.length === 1 && props[0]![0] === "value") {
    ctx.types.add("DV_TEXT");
    return `new DV_TEXT(${props[0]![1]})`;
  }
  if (!props.length) return "";
  return formatRmConstruct(rmType, props, indent, ctx);
}

function emitCodePhrase(block: Block, ctx: TsEmitContext, indent: number): string {
  const codeBlock = block.getInputTargetBlock("FLD_code_string");
  const termBlock = block.getInputTargetBlock("FLD_terminology_id");
  const code = codeBlock ? emitBlock(codeBlock, ctx, indent + 1) : '""';
  const term = termBlock ? emitBlock(termBlock, ctx, indent + 1) : '""';
  const termLit = stringLiteralValue(term);
  const codeLit = stringLiteralValue(code);
  if (termLit !== null && codeLit !== null) {
    if (!codeLit) return "";
    return JSON.stringify(`${termLit}::${codeLit}`);
  }
  if (termLit !== null) {
    if (isBlankGeneratedExpr(code) || isEmptyLiteral(code)) return "";
    return "`" + escapeTemplate(termLit) + "::${String(" + code + ' ?? "")}`';
  }
  if (isBlankGeneratedExpr(code) && isBlankGeneratedExpr(term)) return "";
  ctx.types.add("CODE_PHRASE");
  return `new CODE_PHRASE(${formatObjectLiteral([
    ["terminology_id", term],
    ["code_string", asStringExpr(code)],
  ], indent)})`;
}

function emitTermPick(block: Block, _ctx: TsEmitContext): string {
  const set = termSetById(block.getFieldValue("SET"));
  const rawCode = String(block.getFieldValue("CODE") ?? "");
  const code = rawCode === TERM_PICK_NONE ? "" : rawCode;
  if (!code) return "";
  const terminology = set?.terminologyId ?? "openehr";
  const rubric = set?.codes.find((item) => item.code === code)?.rubric ?? code;
  if (set?.valueRmType === "DV_CODED_TEXT") {
    return JSON.stringify(`${terminology}::${code}|${rubric}|`);
  }
  return JSON.stringify(`${terminology}::${code}`);
}

function shouldEmitLocatableName(rmType: string, name: string): boolean {
  if (rmType === "COMPOSITION") return true;
  if (!LOCATABLE_TYPES.has(rmType)) return false;
  const generic = name.replace(/[_-]/g, " ").toUpperCase();
  return generic !== rmType && generic.replace(/\s+/g, "_") !== rmType;
}

function emitPartyRef(block: Block, ctx: TsEmitContext, indent: number): string {
  ctx.types.add("PARTY_REF");
  ctx.types.add("OBJECT_ID");
  const props: Array<[string, string]> = [];
  const idBlock = block.getInputTargetBlock(rmAttributeInputName("id"));
  const nsBlock = block.getInputTargetBlock(rmAttributeInputName("namespace"));
  const typeBlock = block.getInputTargetBlock(rmAttributeInputName("type"));
  const id = idBlock && !idBlock.isShadow() ? emitBlock(idBlock, ctx, indent + 1) : "";
  const namespace = nsBlock && !nsBlock.isShadow() ? emitBlock(nsBlock, ctx, indent + 1) : "";
  const refType = typeBlock && !typeBlock.isShadow() ? emitBlock(typeBlock, ctx, indent + 1) : "";
  if (id && !isBlankGeneratedExpr(id)) {
    props.push(["id", formatRmConstruct("OBJECT_ID", [["value", asStringExpr(id)]], indent + 1, ctx)]);
  }
  if (namespace && !isBlankGeneratedExpr(namespace)) {
    props.push(["namespace", asStringExpr(namespace)]);
  }
  if (refType && !isBlankGeneratedExpr(refType)) {
    props.push(["type", asStringExpr(refType)]);
  }
  if (!props.length) return "";
  return formatRmConstruct("PARTY_REF", props, indent, ctx);
}

function emitListsGetIndex(block: Block, ctx: TsEmitContext): string {
  const list = block.getInputTargetBlock("VALUE");
  const listCode = list ? emitBlock(list, ctx, 1) : "[]";
  const where = String(block.getFieldValue("WHERE") || "FIRST");
  if (where === "FIRST") return `(${listCode})[0]`;
  if (where === "LAST") return `(${listCode})[(${listCode}).length - 1]`;
  const at = block.getInputTargetBlock("AT");
  const index = at ? emitBlock(at, ctx, 1) : "1";
  return `(${listCode})[Number(${index}) - 1]`;
}

function emitListsCreate(block: Block, ctx: TsEmitContext): string {
  const count = Number((block as Block & { itemCount_?: number }).itemCount_ ?? 0);
  const items: string[] = [];
  for (let i = 0; i < count; i++) {
    const child = block.getInputTargetBlock(`ADD${i}`);
    items.push(child ? emitBlock(child, ctx, 1) : "undefined");
  }
  return `[${items.join(", ")}]`;
}

function emitGeneric(block: Block, ctx: TsEmitContext, indent: number): string {
  if (isGenericValueBlockType(block.type)) {
    const value = block.getInputTargetBlock("VALUE");
    return value ? emitBlock(value, ctx, indent) : "undefined";
  }
  const props: Array<[string, string]> = [];
  for (const input of block.inputList) {
    if (!input.name.startsWith("TARGET_")) continue;
    const attr = input.name.slice("TARGET_".length);
    const code = emitStatementList(block.getInputTargetBlock(input.name), true, ctx, indent);
    if (code) props.push([attr, code]);
  }
  const name = String(block.getFieldValue("NAME") ?? "").trim();
  if (name && !props.length) return JSON.stringify(name);
  return formatObjectLiteral(props, indent);
}

function rmTypeOf(block: Block): string {
  if (block.type === "element") return "ELEMENT";
  const fromType = block.type.replace(/-/g, "_").toUpperCase();
  if (isRmContainerBlockType(block.type)) {
    const field = String(block.getFieldValue("RM_TYPE") ?? "").trim();
    if (field && (isEventFamilyType(field) || isEventFamilyType(fromType))) {
      return field.toUpperCase();
    }
    if (field && (isItemStructureFamilyType(field) || isItemStructureFamilyType(fromType))) {
      return field.toUpperCase();
    }
    return fromType;
  }
  const field = String(block.getFieldValue("RM_TYPE") ?? "").trim();
  if (field) return field.toUpperCase();
  return fromType;
}

function isEmptyShadow(block: Block): boolean {
  if (block.type === "text") return String(block.getFieldValue("TEXT") ?? "") === "";
  if (block.type === "math_number") return false;
  return false;
}

function isEmptyLiteral(code: string): boolean {
  return code === '""' || code === "''" || code === "undefined" || code === "null";
}

function stringLiteralValue(code: string): string | null {
  if (code.length >= 2 && code.startsWith('"') && code.endsWith('"')) {
    try {
      return JSON.parse(code) as string;
    } catch {
      return null;
    }
  }
  return null;
}

function escapeTemplate(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}
