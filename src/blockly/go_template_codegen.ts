/**
 * Blockly workspace → Go text/template conversion script.
 *
 * Preferred over the JSON snapshot walker when a canvas snapshot is available so
 * Conversion start, schema/XML instance roots, preamble defines, and live block
 * edits show up in Generated conversion script(s).
 */

import type { Block, Workspace } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import { blockToExpression } from "./expression_serialize.ts";
import { isRmContainerBlockType, isDataValueBlock } from "./blocks/rm_blocks.ts";
import {
  isGenericValueBlockType,
  isSchemaStructureBlock,
  TARGET_CHILD_PREFIX,
} from "./blocks/target_blocks.ts";
import { registerSchemaBlocksFromSkeleton } from "./schema_blocks.ts";
import { DEFAULTS_BLOCK_TYPE } from "../core/defaults/extract.ts";
import {
  CONVERSION_START_TYPE,
  findInstanceRootUnderStart,
  inferTargetFormatFromRoot,
  isInstanceRootBlockType,
  TEXT_DOCUMENT_BLOCK_TYPE,
} from "./instance_root.ts";
import { findScaffoldInstanceRoot } from "./conversion_start_canvas.ts";
import type { MappingModel } from "../types/mod.ts";
import {
  emitGoExpr,
  generateFromSlots,
  generateGoTemplateFromBlocklyJson,
  goTemplateHeader,
} from "../core/codegen/go_template.ts";
import { parseExpression } from "../core/expression/mod.ts";
import { registerExportTargetAdapter } from "../core/codegen/mod.ts";
import { runWithoutBlocklyEvents } from "./blockly_events.ts";

const SKIP_TOP_LEVEL = new Set([
  DEFAULTS_BLOCK_TYPE,
  CONVERSION_START_TYPE,
  "maps_create_with",
]);

export function registerGoTemplateExportAdapter(): void {
  registerExportTargetAdapter({
    id: "go-template",
    extension: "tmpl",
    mime: "text/x-go-template",
    generate(model, options) {
      if (options?.blocklyState) {
        const fromCanvas = generateGoTemplateFromBlocklyState(
          options.blocklyState,
          model,
          options.skeleton,
        );
        if (fromCanvas) return fromCanvas;
        const fromJson = generateGoTemplateFromBlocklyJson(options.blocklyState, model);
        if (fromJson.trim()) return goTemplateHeader(model) + "\n" + fromJson;
      }
      if (model.slots.length) return goTemplateHeader(model) + "\n" + generateFromSlots(model);
      return goTemplateHeader(model);
    },
  });
}

export function generateGoTemplateFromBlocklyState(
  state: unknown,
  model: MappingModel,
  skeleton?: import("../types/mod.ts").SkeletonNode[],
): string | null {
  if (!state || typeof state !== "object") return null;
  const workspace = new Blockly.Workspace();
  try {
    const snapshot = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    let generated: string | null = null;
    runWithoutBlocklyEvents(() => {
      if (skeleton?.length) registerSchemaBlocksFromSkeleton(skeleton);
      Blockly.serialization.workspaces.load(snapshot, workspace);
      generated = generateGoTemplateFromWorkspace(workspace, model);
    });
    return generated;
  } catch (err) {
    console.warn("Go template codegen from Blockly failed; falling back to slots", err);
    return null;
  } finally {
    workspace.dispose();
  }
}

export function generateGoTemplateFromWorkspace(
  workspace: Workspace,
  model: MappingModel,
): string | null {
  const instanceRoot = findScaffoldInstanceRoot(workspace);
  const targetFormat = model.targetFormat ??
    (instanceRoot ? inferTargetFormatFromRoot(instanceRoot) : undefined);

  if (instanceRoot && isOpenEhrRmRoot(instanceRoot)) {
    if (!model.slots.length) return null;
    return goTemplateHeader(model) + "\n" + generateFromSlots(model);
  }

  const lines: string[] = [goTemplateHeader(model)];
  let emitted = false;

  for (const top of workspace.getTopBlocks(false)) {
    if (SKIP_TOP_LEVEL.has(top.type)) continue;
    if (instanceRoot && top.id === instanceRoot.id) continue;
    if (isInstanceRootBlockType(top.type) || top.type === "xml_element" || top.type === "json_object") {
      continue;
    }
    if (top.type === "text_code" || top.type === "text") {
      const chunk = emitBlock(top);
      if (chunk.length) {
        lines.push(...chunk);
        emitted = true;
      }
    }
  }

  if (instanceRoot?.type === TEXT_DOCUMENT_BLOCK_TYPE) {
    const value = instanceRoot.getInputTargetBlock("VALUE");
    if (value) {
      lines.push(...emitValueExpression(value));
      emitted = true;
    } else {
      lines.push("");
    }
  } else if (instanceRoot) {
    const chunk = emitBlock(instanceRoot);
    if (chunk.length) {
      lines.push(...chunk);
      emitted = true;
    }
  } else if (targetFormat && targetFormat !== "openehr-template") {
    for (const top of workspace.getTopBlocks(false)) {
      if (SKIP_TOP_LEVEL.has(top.type)) continue;
      if (
        isSchemaStructureBlock(top) ||
        top.type === "json_object" ||
        top.type === "xml_element"
      ) {
        const chunk = emitStatementChain(top);
        if (chunk.length) {
          lines.push(...chunk);
          emitted = true;
        }
      }
    }
  }

  if (!emitted) {
    if (model.slots.length) return goTemplateHeader(model) + "\n" + generateFromSlots(model);
    return null;
  }

  return lines.join("\n");
}

function isOpenEhrRmRoot(block: Block): boolean {
  if (block.type === "composition" || isRmContainerBlockType(block.type)) return true;
  if (isDataValueBlock(block)) return true;
  return false;
}

function emitStatementChain(block: Block): string[] {
  const lines: string[] = [];
  let current: Block | null = block;
  while (current) {
    lines.push(...emitBlock(current));
    current = current.getNextBlock();
  }
  return lines;
}

function emitBlock(block: Block): string[] {
  if (block.type === "text" || block.type === "text_code") {
    return [String(block.getFieldValue("TEXT") ?? "")];
  }

  const fromExpr = emitExpressionValue(block);
  if (fromExpr !== null) return fromExpr;

  switch (block.type) {
    case "xml_element":
    case "target_structure":
      return emitXmlOrSchemaElement(block);
    case "xml_text": {
      const value = block.getInputTargetBlock("VALUE");
      if (value) return emitValueExpression(value);
      return [String(block.getFieldValue("TEXT") ?? "")];
    }
    case "xml_attribute":
      return [];
    case "controls_if":
      return emitControlsIf(block);
    case "for_each_source":
      return emitForEachSource(block);
    case "for_each_list":
      return emitForEachList(block);
    case "text":
    case "text_code":
      return [String(block.getFieldValue("TEXT") ?? "")];
    case "text_handlebars": {
      const script = block.getInputTargetBlock("SCRIPT");
      return script ? emitValueExpression(script) : [];
    }
    default:
      if (block.type.startsWith("schema_")) return emitXmlOrSchemaElement(block);
      if (isGenericValueBlockType(block.type)) {
        const value = block.getInputTargetBlock("VALUE");
        return value ? emitValueExpression(value) : [];
      }
      return [`{{- /* unsupported block: ${block.type} */ -}}`];
  }
}

function emitExpressionValue(block: Block): string[] | null {
  const serialized = blockToExpression(block);
  if (!serialized) return null;
  const ast = parseExpression(serialized);
  const goExpr = emitGoExpr(ast);
  if (goExpr.startsWith("/*")) return [`{{- ${goExpr} -}}`];
  if (goExpr.includes("{{")) return [goExpr];
  return [`{{ ${goExpr} }}`];
}

function emitValueExpression(block: Block): string[] {
  if (block.type === "text" || block.type === "text_code") {
    return [String(block.getFieldValue("TEXT") ?? "")];
  }

  const fromExpr = emitExpressionValue(block);
  if (fromExpr !== null) return fromExpr;

  switch (block.type) {
    case "text_changeCase": {
      const inner = block.getInputTargetBlock("TEXT");
      const caseType = String(block.getFieldValue("CASE") ?? "LOWERCASE");
      if (inner) {
        const innerExpr = emitValueExpression(inner).join("");
        const stripped = stripDelimiters(innerExpr);
        if (caseType === "LOWERCASE") return [`{{ ${stripped} | lower }}`];
        if (caseType === "UPPERCASE") return [`{{ ${stripped} | upper }}`];
      }
      return inner ? emitValueExpression(inner) : [];
    }
    case "text_trim": {
      const inner = block.getInputTargetBlock("TEXT");
      if (inner) {
        const innerExpr = emitValueExpression(inner).join("");
        return [`{{ ${stripDelimiters(innerExpr)} | trim }}`];
      }
      return [];
    }
    default:
      return [`{{- /* value: ${block.type} */ -}}`];
  }
}

function emitControlsIf(block: Block): string[] {
  const lines: string[] = [];
  let ifCount = 0;
  while (block.getInput(`IF${ifCount}`)) ifCount++;
  if (ifCount === 0) ifCount = 1;

  for (let i = 0; i < ifCount; i++) {
    const cond = block.getInputTargetBlock(`IF${i}`);
    const body = block.getInputTargetBlock(`DO${i}`);
    const keyword = i === 0 ? "if" : "else if";
    const condStr = cond ? emitConditionExpression(cond) : "true";
    lines.push(`{{- ${keyword} ${condStr} }}`);
    if (body) lines.push(...emitStatementChain(body));
  }

  if (block.getInput("ELSE")) {
    const elseBody = block.getInputTargetBlock("ELSE");
    lines.push(`{{- else }}`);
    if (elseBody) lines.push(...emitStatementChain(elseBody));
  }

  lines.push(`{{- end }}`);
  return lines;
}

function emitForEachSource(block: Block): string[] {
  const varName = String(block.getFieldValue("VAR") || "item");
  const path = String(block.getFieldValue("PATH") || "");
  const safeVar = /^[A-Za-z_][A-Za-z0-9_]*$/.test(varName) ? varName : "item";
  const lines: string[] = [
    `{{- /* for_each_source: ${safeVar} over ${path} */ -}}`,
    `{{- range $${safeVar} := index .Data ${goQuote(path)} -}}`,
  ];
  const body = block.getInputTargetBlock("DO");
  if (body) lines.push(...emitStatementChain(body));
  lines.push(`{{- end -}}`);
  return lines;
}

function emitForEachList(block: Block): string[] {
  const varName = String(block.getFieldValue("VAR") || "item");
  const safeVar = /^[A-Za-z_][A-Za-z0-9_]*$/.test(varName) ? varName : "item";
  const listBlock = block.getInputTargetBlock("LIST");
  const listExpr = listBlock ? emitInlineValue(listBlock) : "index .Data \"\"";
  const lines: string[] = [
    `{{- range $${safeVar} := ${listExpr} -}}`,
  ];
  const body = block.getInputTargetBlock("DO");
  if (body) lines.push(...emitStatementChain(body));
  lines.push(`{{- end -}}`);
  return lines;
}

function emitConditionExpression(block: Block): string {
  switch (block.type) {
    case "logic_compare": {
      const op = String(block.getFieldValue("OP") ?? "EQ");
      const a = block.getInputTargetBlock("A");
      const b = block.getInputTargetBlock("B");
      const aStr = a ? emitInlineValue(a) : '""';
      const bStr = b ? emitInlineValue(b) : '""';
      const goOp = { EQ: "eq", NEQ: "ne", LT: "lt", LTE: "le", GT: "gt", GTE: "ge" }[op] ?? "eq";
      return `${goOp} ${aStr} ${bStr}`;
    }
    case "logic_operation": {
      const op = String(block.getFieldValue("OP") ?? "AND").toLowerCase();
      const a = block.getInputTargetBlock("A");
      const b = block.getInputTargetBlock("B");
      const aStr = a ? `(${emitConditionExpression(a)})` : "true";
      const bStr = b ? `(${emitConditionExpression(b)})` : "true";
      return `${op} ${aStr} ${bStr}`;
    }
    case "logic_negate": {
      const inner = block.getInputTargetBlock("BOOL");
      return inner ? `not (${emitConditionExpression(inner)})` : "true";
    }
    default:
      return emitInlineValue(block);
  }
}

function emitInlineValue(block: Block): string {
  const fromExpr = blockToExpression(block);
  if (fromExpr) {
    const ast = parseExpression(fromExpr);
    const goExpr = emitGoExpr(ast);
    if (!goExpr.startsWith("/*") && !goExpr.includes("{{")) return goExpr;
  }

  switch (block.type) {
    case "source_query":
    case "source_query_number":
    case "source_query_boolean":
    case "source_query_node": {
      const expr = String(block.getFieldValue("EXPRESSION") ?? "");
      return `(index .Data ${goQuote(expr)})`;
    }
    case "maps_get": {
      const name = String(block.getFieldValue("NAME") ?? "defaults");
      const keyBlock = block.getInputTargetBlock("KEY");
      const keyStr = keyBlock ? extractTextValue(keyBlock) : "";
      if (name === "defaults" || name === "Parameters") {
        return `.Parameters.${sanitizeGoField(keyStr)}`;
      }
      return `(index .${sanitizeGoField(name)} ${goQuote(keyStr)})`;
    }
    case "text":
      return goQuote(String(block.getFieldValue("TEXT") ?? ""));
    case "text_code":
      return goQuote(String(block.getFieldValue("TEXT") ?? ""));
    case "math_number":
      return String(block.getFieldValue("NUM") ?? "0");
    case "logic_boolean":
      return block.getFieldValue("BOOL") === "TRUE" ? "true" : "false";
    default:
      return `""`;
  }
}

function emitXmlOrSchemaElement(block: Block): string[] {
  if (block.type === "xml_element") return emitXmlElement(block);

  const tag = xmlTagName(block);
  const extra = block as Block & {
    schemaXmlAttributes_?: string[];
    schemaFields_?: Array<{ name: string; xmlKind?: string }>;
  };
  const xmlAttributes = new Set([
    ...(extra.schemaXmlAttributes_ ?? []),
    ...(extra.schemaFields_ ?? [])
      .filter((field) => field.xmlKind === "attribute")
      .map((field) => field.name),
  ]);
  const attrParts: string[] = [...emitStaticAttributes(block)];
  const inner: string[] = [];

  for (const input of block.inputList) {
    if (!input.name.startsWith(TARGET_CHILD_PREFIX) && !input.name.startsWith("SCHEMA_OPT_")) {
      continue;
    }
    const fieldName = input.name.replace(/^TARGET_|^SCHEMA_OPT_/, "");
    const child = block.getInputTargetBlock(input.name);
    if (!child) continue;
    if (xmlAttributes.has(fieldName) || child.type === "xml_attribute") {
      const val = emitValueExpression(child).join("");
      attrParts.push(` ${fieldName}="${val}"`);
      continue;
    }
    if (isXmlStructureBlockType(child.type)) {
      inner.push(...emitStatementChain(child));
      continue;
    }
    inner.push(
      `<${xmlName(fieldName)}>`,
      ...emitValueExpression(child),
      `</${xmlName(fieldName)}>`,
    );
  }

  const attrs = attrParts.join("");
  if (inner.length) return [`<${tag}${attrs}>`, ...inner, `</${tag}>`];
  return [`<${tag}${attrs}></${tag}>`];
}

function emitXmlElement(block: Block): string[] {
  const tag = xmlTagName(block);
  const bodyHead = firstChildStatement(block);
  const attrParts: string[] = [...emitStaticAttributes(block)];
  const body: Block[] = [];
  let current: Block | null = bodyHead;
  while (current) {
    if (current.type === "xml_attribute") {
      const name = String(current.getFieldValue("NAME") ?? "").trim();
      if (name) {
        const valBlock = current.getInputTargetBlock("VALUE");
        const val = valBlock ? emitValueExpression(valBlock).join("") : "";
        attrParts.push(` ${name}="${val}"`);
      }
    } else {
      body.push(current);
    }
    current = current.getNextBlock();
  }
  const attrs = attrParts.join("");
  if (body.length) {
    const inner: string[] = [];
    for (const child of body) inner.push(...emitBlock(child));
    return [`<${tag}${attrs}>`, ...inner, `</${tag}>`];
  }
  return [`<${tag}${attrs} />`];
}

function isXmlStructureBlockType(type: string): boolean {
  return type === "xml_element" || type === "target_structure" || type.startsWith("schema_") ||
    type === "controls_if" || type === "for_each_source" || type === "for_each_list";
}

function xmlName(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9_.-]/g, "_");
  return /^[A-Za-z_]/.test(safe) ? safe : `_${safe}`;
}

function xmlTagName(block: Block): string {
  const slot = String(block.getFieldValue("SLOT_ID") ?? "");
  const path = slot.includes(":") ? slot.slice(slot.indexOf(":") + 1) : slot;
  const fromPath = path.split("/").filter((part) => part && !part.startsWith("@")).pop();
  if (fromPath) return fromPath;
  const name = String(block.getFieldValue("NAME") ?? "element").trim();
  return name || "element";
}

function firstChildStatement(block: Block): Block | null {
  const children = block.getInputTargetBlock("TARGET_children");
  if (children) return children;
  for (const input of block.inputList) {
    if (input.name.startsWith(TARGET_CHILD_PREFIX) && block.getInputTargetBlock(input.name)) {
      return block.getInputTargetBlock(input.name);
    }
  }
  return null;
}

function emitStaticAttributes(block: Block): string[] {
  const attrs: string[] = [];
  const extra = block as Block & { attributes_?: Array<{ name: string; value: string }> };
  for (const attr of extra.attributes_ ?? []) {
    const name = String(attr.name ?? "").trim();
    if (!name) continue;
    attrs.push(` ${name}="${String(attr.value ?? "")}"`);
  }
  let i = 0;
  while (block.getFieldValue(`ATTR_NAME${i}`) !== null) {
    const name = String(block.getFieldValue(`ATTR_NAME${i}`));
    const valBlock = block.getInputTargetBlock(`ATTR_VALUE${i}`);
    const val = valBlock
      ? emitValueExpression(valBlock).join("")
      : String(block.getFieldValue(`ATTR_VALUE${i}`) ?? "");
    attrs.push(` ${name}="${val}"`);
    i++;
  }
  return attrs;
}

function extractTextValue(block: Block): string {
  if (block.type === "text") return String(block.getFieldValue("TEXT") ?? "");
  if (block.type === "text_code") return String(block.getFieldValue("TEXT") ?? "");
  return String(block.getFieldValue("TEXT") ?? block.getFieldValue("EXPRESSION") ?? "");
}

function stripDelimiters(expr: string): string {
  return expr.replace(/^\{\{\s*/, "").replace(/\s*\}\}$/, "");
}

function goQuote(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function sanitizeGoField(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}
