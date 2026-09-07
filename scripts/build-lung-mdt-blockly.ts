/**
 * Build examples/lung-MDT-form/mapping/mapping.blockly.json from the
 * TakeCare XSD + the production Handlebars mapping script.
 *
 *   deno run -A scripts/build-lung-mdt-blockly.ts
 */
import { dirname, fromFileUrl, join } from "@std/path";
import { Blockly } from "../src/blockly/blockly_core.ts";
import { initBlocklyGenerators } from "../src/blockly/mod.ts";
import {
  attachOptionalSchemaChild,
  loadSkeletonIntoWorkspace,
} from "../src/blockly/skeleton_loader.ts";
import { createSchemaStructureBlock } from "../src/blockly/schema_blocks.ts";
import { findSkeletonNode } from "../src/blockly/schema_catalog.ts";
import {
  composeSchemaOptionalFields,
  schemaOptionalInputName,
} from "../src/blockly/blocks/schema_mutator.ts";
import { targetChildInputName } from "../src/blockly/blocks/target_blocks.ts";
import { createMapsGetBlock } from "../src/blockly/blocks/map_blocks.ts";
import { createSourceQueryBlock } from "../src/blockly/source_query.ts";
import { applySkeletonBlockLabels } from "../src/blockly/block_labels.ts";
import { createEmptyModel } from "../src/core/mapping_model/mod.ts";
import { getTargetFormatHandler } from "../src/core/target/mod.ts";
import { DEFAULTS_MAP_NAME } from "../src/core/defaults/mod.ts";
import type { SkeletonNode } from "../src/types/mod.ts";
import "blockly/blocks";

const rootDir = join(dirname(fromFileUrl(import.meta.url)), "..");

export interface ExtractedKeyword {
  kind: "TextKeyWord" | "DatetimeKeyword";
  termId: string;
  note: string;
  condition?: string;
  comment?: string;
}

export function extractTakeCareKeywords(script: string): ExtractedKeyword[] {
  const out: ExtractedKeyword[] = [];
  const re = /<(TextKeyWord|DatetimeKeyword)>([\s\S]*?)<\/\1>/g;
  let lastEnd = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(script))) {
    const kind = match[1] as ExtractedKeyword["kind"];
    const body = match[2];
    const termId = body.match(/<TermId>\s*(\d+)\s*<\/TermId>/)?.[1];
    const note = body.match(/<Note>([\s\S]*?)<\/Note>/)?.[1] ?? "";
    if (!termId) continue;
    const between = script.slice(lastEnd, match.index);
    const comments = [...between.matchAll(/<!--\s*([\s\S]*?)\s*-->/g)];
    const comment = comments.at(-1)?.[1]?.replace(/\s+/g, " ").trim();
    out.push({
      kind,
      termId,
      note,
      condition: conditionBefore(between),
      ...(comment ? { comment } : {}),
    });
    lastEnd = match.index + match[0].length;
  }
  return out;
}

function conditionBefore(between: string): string | undefined {
  const lastIf = between.lastIndexOf("{{#if");
  if (lastIf < 0) return undefined;
  const afterIf = between.slice(lastIf);
  if (afterIf.includes("{{/if}}")) return undefined;
  const close = afterIf.indexOf("}}");
  if (close < 0) return undefined;
  return afterIf.slice("{{#if".length, close).trim() || undefined;
}

function descendant(node: SkeletonNode | undefined, ...names: string[]): SkeletonNode | undefined {
  let current = node;
  for (const name of names) {
    current = current?.children.find((child) => (child.rmAttribute ?? child.label) === name);
  }
  return current;
}

function fillValue(parent: Blockly.Block, inputName: string, value: Blockly.Block): void {
  const input = parent.getInput(inputName);
  if (!input?.connection || !value.outputConnection) {
    throw new Error(`Cannot fill ${parent.type}.${inputName}`);
  }
  const existing = input.connection.targetBlock();
  if (existing) existing.dispose(false);
  input.connection.connect(value.outputConnection);
}

function appendStatement(parent: Blockly.Block, inputName: string, block: Blockly.Block): void {
  const input = parent.getInput(inputName);
  if (!input?.connection || !block.previousConnection) {
    throw new Error(`Cannot append ${block.type} onto ${parent.type}.${inputName}`);
  }
  const first = input.connection.targetBlock();
  if (!first) {
    input.connection.connect(block.previousConnection);
    return;
  }
  let tail: Blockly.Block = first;
  while (tail.getNextBlock()) tail = tail.getNextBlock()!;
  if (!tail.nextConnection) throw new Error(`No next connection on ${tail.type}`);
  tail.nextConnection.connect(block.previousConnection);
}

function mapsGet(workspace: Blockly.Workspace, key: string): Blockly.Block {
  return createMapsGetBlock(workspace, DEFAULTS_MAP_NAME, key);
}

function mathNumber(workspace: Blockly.Workspace, value: string): Blockly.Block {
  const block = workspace.newBlock("math_number");
  block.setFieldValue(value, "NUM");
  return block;
}

function textCode(workspace: Blockly.Workspace, text: string): Blockly.Block {
  const block = workspace.newBlock("text_code");
  if (block.getField("LANG")) block.setFieldValue("handlebars", "LANG");
  block.setFieldValue(text, "TEXT");
  return block;
}

function structureFromNode(
  workspace: Blockly.Workspace,
  node: SkeletonNode,
): Blockly.Block {
  const block = createSchemaStructureBlock(workspace, node, false);
  block.setFieldValue(node.rmType, "TARGET_TYPE");
  block.setFieldValue(node.slotId, "SLOT_ID");
  applySkeletonBlockLabels(block, node);
  return block;
}

function wrapIf(
  workspace: Blockly.Workspace,
  inner: Blockly.Block,
  condition: string | undefined,
): Blockly.Block {
  if (!condition) return inner;
  const iff = workspace.newBlock("controls_if");
  const cond = createSourceQueryBlock(workspace, condition, "boolean");
  iff.getInput("IF0")?.connection?.connect(cond.outputConnection!);
  iff.getInput("DO0")?.connection?.connect(inner.previousConnection!);
  return iff;
}

export function buildLungMdtWorkspace(
  xsd: string,
  script: string,
): Blockly.Workspace {
  initBlocklyGenerators();
  const target = getTargetFormatHandler("xml-schema").load(
    "TakeCare-CasenoteWrite-edit01.xsd",
    xsd,
  );
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(
    workspace,
    target.skeleton,
    createEmptyModel(target.targetId),
    null,
    "en",
    "xml-schema",
  );

  const root = workspace.getAllBlocks(false).find((block) =>
    block.type === "schema_ProfdocHISMessage"
  );
  if (!root) throw new Error("missing schema_ProfdocHISMessage");

  const headerKeys: Record<string, string> = {
    PatId: "PatientId",
    UserId: "UserId",
    EventTime: "Time",
    Signer: "Signer",
    TemplateId: "TemplateId",
    TemplateType: "TemplateType",
    Time: "Time",
    InvokingSystem: "InvokingSystem",
  };
  for (const [field, key] of Object.entries(headerKeys)) {
    const input = root.getInput(targetChildInputName(field));
    if (!input) continue;
    fillValue(root, targetChildInputName(field), mapsGet(workspace, key));
  }

  composeSchemaOptionalFields(root, ["UUID"]);
  fillValue(root, schemaOptionalInputName("UUID"), mapsGet(workspace, "UUID"));

  const keywords = root.getInput("TARGET_Keywords")?.connection?.targetBlock();
  if (!keywords) throw new Error("missing Keywords");
  composeSchemaOptionalFields(keywords, ["TextKeywords", "DatetimeKeywords"]);
  attachOptionalSchemaChild(workspace, keywords, "TextKeywords");
  attachOptionalSchemaChild(workspace, keywords, "DatetimeKeywords");

  const textKeywords = keywords.getInput(schemaOptionalInputName("TextKeywords"))
    ?.connection?.targetBlock();
  const datetimeKeywords = keywords.getInput(schemaOptionalInputName("DatetimeKeywords"))
    ?.connection?.targetBlock();
  if (!textKeywords || !datetimeKeywords) throw new Error("missing keyword containers");

  const scaffolded = textKeywords.getInput("TARGET_TextKeyWord")?.connection?.targetBlock();
  if (scaffolded) scaffolded.dispose(false);
  const scaffoldedDt = datetimeKeywords.getInput("TARGET_DatetimeKeyword")?.connection?.targetBlock();
  if (scaffoldedDt) scaffoldedDt.dispose(false);

  const rootNode = findSkeletonNode(root.getFieldValue("SLOT_ID"));
  const textKeyWordNode = descendant(rootNode, "Keywords", "TextKeywords", "TextKeyWord");
  const datetimeKeywordNode = descendant(
    rootNode,
    "Keywords",
    "DatetimeKeywords",
    "DatetimeKeyword",
  );
  if (!textKeyWordNode || !datetimeKeywordNode) throw new Error("missing keyword skeleton nodes");

  const extracted = extractTakeCareKeywords(script);
  if (!extracted.length) throw new Error("no keywords parsed from mapping script");

  for (const item of extracted) {
    const node = item.kind === "TextKeyWord" ? textKeyWordNode : datetimeKeywordNode;
    const parent = item.kind === "TextKeyWord" ? textKeywords : datetimeKeywords;
    const mouth = targetChildInputName(item.kind);
    const block = structureFromNode(workspace, node);
    fillValue(block, targetChildInputName("TermId"), mathNumber(workspace, item.termId));
    if (item.kind === "TextKeyWord") {
      fillValue(block, targetChildInputName("Note"), textCode(workspace, item.note));
    } else {
      composeSchemaOptionalFields(block, ["Note"]);
      fillValue(block, schemaOptionalInputName("Note"), textCode(workspace, item.note));
    }
    appendStatement(parent, mouth, wrapIf(workspace, block, item.condition));
  }

  return workspace;
}

if (import.meta.main) {
  const xsd = Deno.readTextFileSync(
    join(rootDir, "examples/TakeCare/TakeCare-CasenoteWrite-edit01.xsd"),
  );
  const script = Deno.readTextFileSync(
    join(rootDir, "examples/lung-MDT-form/mapping/Mappningsscript XML 3.2.0 (PROD).txt"),
  );
  const workspace = buildLungMdtWorkspace(xsd, script);
  const state = Blockly.serialization.workspaces.save(workspace);
  const out = join(rootDir, "examples/lung-MDT-form/mapping/mapping.blockly.json");
  Deno.writeTextFileSync(out, `${JSON.stringify(state, null, 2)}\n`);
  workspace.dispose();
  console.log(`Wrote ${out}`);
}
