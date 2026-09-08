import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { registerMapBlocks } from "@intehrgrator/blockly/blocks/map_blocks.ts";
import { registerTargetBlocks } from "@intehrgrator/blockly/blocks/target_blocks.ts";
import {
  composeSchemaOptionalFields,
  schemaOptionalInputName,
} from "@intehrgrator/blockly/blocks/schema_mutator.ts";
import {
  createEmptyMapBlock,
  ensureDefaultsBlock,
  findDefaultsBlock,
} from "@intehrgrator/blockly/defaults_canvas.ts";
import {
  attachOptionalSchemaChild,
  loadSkeletonIntoWorkspace,
} from "@intehrgrator/blockly/skeleton_loader.ts";
import {
  buildDemoToolbox,
  toolboxBlockTypes,
} from "@intehrgrator/blockly/toolbox_demo.ts";
import { msg } from "@intehrgrator/blockly/i18n/custom_msg.ts";
import { skeletonToolboxSignature } from "@intehrgrator/blockly/schema_catalog.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { getTargetFormatHandler } from "@intehrgrator/core/target/mod.ts";
import { MAPS_CREATE_WITH } from "@intehrgrator/core/defaults/mod.ts";
import "blockly/blocks";

type ToolboxItem = { kind?: string; name?: string; contents?: unknown[]; type?: string };

function findTargetSchemaCategory(toolbox: unknown): ToolboxItem | undefined {
  const walk = (item: unknown): ToolboxItem | undefined => {
    if (!item || typeof item !== "object") return undefined;
    const rec = item as ToolboxItem;
    if (rec.kind === "category" && rec.name === msg("en").CAT_TARGET_SCHEMA) return rec;
    if (Array.isArray(rec.contents)) {
      for (const child of rec.contents) {
        const found = walk(child);
        if (found) return found;
      }
    }
    return undefined;
  };
  return walk(toolbox);
}

/** Nested category depth below this node (0 = flyout of blocks only). */
function nestedCategoryDepth(item: ToolboxItem): number {
  const children = (item.contents ?? []).filter((child): child is ToolboxItem =>
    Boolean(child) && typeof child === "object"
  );
  const categories = children.filter((child) => child.kind === "category");
  if (!categories.length) return 0;
  return 1 + Math.max(...categories.map((child) => nestedCategoryDepth(child)));
}

function schemaRoot(workspace: Blockly.Workspace, inputName: string) {
  return workspace.getAllBlocks(false).find((block) =>
    (block.type === "target_structure" || block.type.startsWith("schema_")) &&
    Boolean(block.getInput(inputName))
  );
}

const schema = JSON.stringify({
  $id: "patient-summary",
  type: "object",
  required: ["name"],
  properties: {
    name: { type: "string" },
    age: { type: "integer" },
    note: { type: "string" },
  },
});

Deno.test("JSON Schema scaffold shows mandatory fields only", () => {
  registerTargetBlocks();
  registerMapBlocks();
  const target = getTargetFormatHandler("json-schema").load("summary.json", schema);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(
    workspace,
    target.skeleton,
    createEmptyModel(target.targetId),
    null,
    "en",
    "json-schema",
  );
  const root = schemaRoot(workspace, "TARGET_name");
  assert(root, "expected a schema structure root");
  assert(root.getInput("TARGET_name"), "mandatory name value slot should scaffold");
  assertEquals(root.getInput("TARGET_name")?.type, 1, "name should be a puzzle-piece value slot");
  assertEquals(root.getInput("TARGET_age"), null, "optional age should not scaffold");
  assertEquals(root.getInput("TARGET_note"), null, "optional note should not scaffold");
  workspace.dispose();
});

Deno.test("schema mutator adds optional field and syncs optionalRm model path", () => {
  registerTargetBlocks();
  registerMapBlocks();
  const target = getTargetFormatHandler("json-schema").load("summary.json", schema);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(
    workspace,
    target.skeleton,
    createEmptyModel(target.targetId),
    null,
    "en",
    "json-schema",
  );
  const root = schemaRoot(workspace, "TARGET_name");
  assert(root);
  composeSchemaOptionalFields(root!, ["age"]);
  const ageInput = root!.getInput(schemaOptionalInputName("age"));
  assert(ageInput, "mutator should open SCHEMA_OPT_age value slot");
  assertEquals(ageInput.type, 1, "optional primitive age should be a value slot, not a mouth");
  attachOptionalSchemaChild(workspace, root!, "age");
  assertEquals(
    ageInput.connection?.targetBlock(),
    null,
    "optional primitive should stay an empty parent slot, not a wrapper block",
  );
  workspace.dispose();
});

Deno.test("JSON/XSD targets get empty Defaults Map block", () => {
  registerMapBlocks();
  const workspace = new Blockly.Workspace();
  ensureDefaultsBlock(workspace, "en", "json-schema");
  const defaults = findDefaultsBlock(workspace);
  assert(defaults);
  const map = defaults!.getInputTargetBlock("MAP");
  assert(map);
  assertEquals(map!.type, MAPS_CREATE_WITH);
  assertEquals((map as { itemCount_?: number }).itemCount_, 0);
  workspace.dispose();
});

Deno.test("createEmptyMapBlock has zero entries", () => {
  registerMapBlocks();
  const workspace = new Blockly.Workspace();
  const map = createEmptyMapBlock(workspace);
  assertEquals((map as { itemCount_?: number }).itemCount_, 0);
  workspace.dispose();
});

Deno.test("schema toolbox lists unique complex types in one flyout level", () => {
  const target = getTargetFormatHandler("json-schema").load("summary.json", schema);
  const toolbox = buildDemoToolbox("en", {
    targetFormat: "json-schema",
    skeleton: target.skeleton,
  });
  const types = toolboxBlockTypes(toolbox);
  assert(types.some((type) => type === "target_structure" || type.startsWith("schema_")));
  assert(types.includes("target_value"));
  const targetSchema = findTargetSchemaCategory(toolbox);
  assert(targetSchema, "Target schema drawer should exist");
  assertEquals(
    nestedCategoryDepth(targetSchema),
    0,
    "single-schema drawer must be a flat flyout, not a folding tree",
  );
});

Deno.test("TakeCare Target schema toolbox is one flat unique-type list", async () => {
  const xsd = await Deno.readTextFile(
    join(import.meta.dirname!, "../examples/TakeCare/TakeCare-CasenoteWrite-edit01.xsd"),
  );
  const target = getTargetFormatHandler("xml-schema").load(
    "TakeCare-CasenoteWrite-edit01.xsd",
    xsd,
  );
  const toolbox = buildDemoToolbox("en", {
    targetFormat: "xml-schema",
    skeleton: target.skeleton,
  });
  const targetSchema = findTargetSchemaCategory(toolbox);
  assert(targetSchema, "Target schema drawer should exist");
  assertEquals(
    nestedCategoryDepth(targetSchema),
    0,
    "TakeCare types must not nest Keywords/TextKeywords/UserKeywords as extra categories",
  );
  const types = (targetSchema.contents ?? []).map((item) =>
    (item as { type?: string }).type
  );
  assert(types.includes("schema_ProfdocHISMessage"));
  assert(types.includes("schema_TextKeyWord"));
  assert(types.includes("schema_UserKeyword"));
  assertEquals(types.filter((type) => type === "schema_TextKeyWord").length, 1);
  assertEquals(types.includes("xml_element"), false);
});

Deno.test("skeletonToolboxSignature changes when skeleton structure changes", () => {
  const targetA = getTargetFormatHandler("json-schema").load("a.json", schema);
  const targetB = getTargetFormatHandler("json-schema").load(
    "b.json",
    JSON.stringify({
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } },
    }),
  );
  const sigA = skeletonToolboxSignature(targetA.skeleton);
  const sigB = skeletonToolboxSignature(targetB.skeleton);
  assert(sigA !== sigB, "different skeleton trees should produce different signatures");
});

Deno.test("JSON schema skeleton load replaces openEHR Defaults Map with empty map", () => {
  registerTargetBlocks();
  registerMapBlocks();
  const workspace = new Blockly.Workspace();
  ensureDefaultsBlock(workspace, "en", "openehr-template");
  const before = findDefaultsBlock(workspace)?.getInputTargetBlock("MAP") as { itemCount_?: number } | null;
  assert(before && before.itemCount_! > 0, "openEHR defaults should start with factory keys");

  const target = getTargetFormatHandler("json-schema").load("summary.json", schema);
  loadSkeletonIntoWorkspace(
    workspace,
    target.skeleton,
    createEmptyModel(target.targetId),
    null,
    "en",
    "json-schema",
  );
  const after = findDefaultsBlock(workspace)?.getInputTargetBlock("MAP") as { itemCount_?: number } | null;
  assertEquals(after?.itemCount_, 0);
  workspace.dispose();
});

Deno.test("dummy-json-vitals fixture keeps mandatory vitals scaffold", async () => {
  registerTargetBlocks();
  registerMapBlocks();
  const schemaText = await Deno.readTextFile(
    join(import.meta.dirname!, "../examples/dummy-json-vitals/target.schema.json"),
  );
  const target = getTargetFormatHandler("json-schema").load("target.schema.json", schemaText);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(
    workspace,
    target.skeleton,
    createEmptyModel(target.targetId),
    null,
    "en",
    "json-schema",
  );
  const root = schemaRoot(workspace, "TARGET_systolic");
  assert(root, "systolic/diastolic mandatory slots should scaffold");
  assertEquals(root!.getInput("TARGET_systolic")?.type, 1, "systolic should be a value slot");
  assertEquals(root!.getInput("TARGET_unit"), null, "optional unit should stay off canvas");
  workspace.dispose();
});
