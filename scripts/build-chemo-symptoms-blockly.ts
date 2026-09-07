/**
 * Build examples/patient-reported-chemotherapy-symptoms/mapping/mapping.blockly.json
 * from the TakeCare XSD using schema-generated blocks (not generic XML).
 *
 *   deno run -A scripts/build-chemo-symptoms-blockly.ts
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

const BASE =
  "patientrapporterade_symptom_inför_medicinsk_onkologisk_behandling/frågeformulär_för_symptom_och_andra_tecken/ospecificerad_händelse:0";

export interface ChemoSymptomKeyword {
  termId: string;
  path: string;
  condition?: "neq-nej";
}

/** First three symptom sections plus the always-emitted composition UID keyword. */
export const CHEMO_TEXT_KEYWORDS: ChemoSymptomKeyword[] = [
  {
    termId: "2811",
    path: `${BASE}/trötthet/upplever_du_trötthet_fatigue_som_påverkar_ditt_dagliga_liv|value`,
    condition: "neq-nej",
  },
  {
    termId: "1830",
    path: `${BASE}/andning/upplever_du_andnöd_vid_ansträngning_eller_i_vila|value`,
    condition: "neq-nej",
  },
  {
    termId: "6298",
    path: `${BASE}/hjärta-kärl/upplever_du_bröstsmärtor_hjärtklappning_eller_svullna_ben|value`,
    condition: "neq-nej",
  },
  {
    termId: "13700",
    path: "patientrapporterade_symptom_inför_medicinsk_onkologisk_behandling/_uid|value",
  },
];

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

function wrapIfNeqNej(
  workspace: Blockly.Workspace,
  inner: Blockly.Block,
  path: string,
): Blockly.Block {
  const iff = workspace.newBlock("controls_if");
  const cmp = workspace.newBlock("logic_compare");
  cmp.setFieldValue("NEQ", "OP");
  const src = createSourceQueryBlock(workspace, path, "string");
  const nej = workspace.newBlock("text");
  nej.setFieldValue("Nej", "TEXT");
  cmp.getInput("A")?.connection?.connect(src.outputConnection!);
  cmp.getInput("B")?.connection?.connect(nej.outputConnection!);
  iff.getInput("IF0")?.connection?.connect(cmp.outputConnection!);
  iff.getInput("DO0")?.connection?.connect(inner.previousConnection!);
  return iff;
}

export function buildChemoSymptomsWorkspace(xsd: string): Blockly.Workspace {
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
    Time: "Time",
    InvokingSystem: "InvokingSystem",
  };
  for (const [field, key] of Object.entries(headerKeys)) {
    const input = root.getInput(targetChildInputName(field));
    if (!input) continue;
    fillValue(root, targetChildInputName(field), mapsGet(workspace, key));
  }

  fillValue(root, targetChildInputName("TemplateType"), mathNumber(workspace, "1"));

  composeSchemaOptionalFields(root, ["Signed", "UUID"]);
  fillValue(root, schemaOptionalInputName("Signed"), mathNumber(workspace, "0"));
  fillValue(root, schemaOptionalInputName("UUID"), mapsGet(workspace, "UUID"));

  const keywords = root.getInput("TARGET_Keywords")?.connection?.targetBlock();
  if (!keywords) throw new Error("missing Keywords");
  composeSchemaOptionalFields(keywords, ["TextKeywords"]);
  attachOptionalSchemaChild(workspace, keywords, "TextKeywords");

  const textKeywords = keywords.getInput(schemaOptionalInputName("TextKeywords"))
    ?.connection?.targetBlock();
  if (!textKeywords) throw new Error("missing TextKeywords");

  const scaffolded = textKeywords.getInput("TARGET_TextKeyWord")?.connection?.targetBlock();
  if (scaffolded) scaffolded.dispose(false);

  const rootNode = findSkeletonNode(root.getFieldValue("SLOT_ID"));
  const textKeyWordNode = descendant(rootNode, "Keywords", "TextKeywords", "TextKeyWord");
  if (!textKeyWordNode) throw new Error("missing TextKeyWord skeleton node");

  for (const item of CHEMO_TEXT_KEYWORDS) {
    const block = structureFromNode(workspace, textKeyWordNode);
    fillValue(block, targetChildInputName("TermId"), mathNumber(workspace, item.termId));
    fillValue(
      block,
      targetChildInputName("Note"),
      createSourceQueryBlock(workspace, item.path, "string"),
    );
    const stacked = item.condition === "neq-nej"
      ? wrapIfNeqNej(workspace, block, item.path)
      : block;
    appendStatement(textKeywords, targetChildInputName("TextKeyWord"), stacked);
  }

  return workspace;
}

if (import.meta.main) {
  const xsd = Deno.readTextFileSync(
    join(rootDir, "examples/TakeCare/TakeCare-CasenoteWrite-edit01.xsd"),
  );
  const workspace = buildChemoSymptomsWorkspace(xsd);
  const state = Blockly.serialization.workspaces.save(workspace);
  const out = join(
    rootDir,
    "examples/patient-reported-chemotherapy-symptoms/mapping/mapping.blockly.json",
  );
  Deno.writeTextFileSync(out, `${JSON.stringify(state, null, 2)}\n`);
  workspace.dispose();
  console.log(`Wrote ${out}`);
}
