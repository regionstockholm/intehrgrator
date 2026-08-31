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
import { skeletonToolboxSignature } from "@intehrgrator/blockly/schema_catalog.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { getTargetFormatHandler } from "@intehrgrator/core/target/mod.ts";
import { MAPS_CREATE_WITH } from "@intehrgrator/core/defaults/mod.ts";
import "blockly/blocks";

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
  const root = workspace.getAllBlocks(false).find((block) => block.type === "target_structure");
  assert(root, "expected a target_structure root");
  assert(root.getInput("TARGET_name"), "mandatory name mouth should scaffold");
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
  const root = workspace.getAllBlocks(false).find((block) => block.type === "target_structure");
  assert(root);
  composeSchemaOptionalFields(root!, ["age"]);
  assert(root!.getInput(schemaOptionalInputName("age")), "mutator should open SCHEMA_OPT_age mouth");
  attachOptionalSchemaChild(workspace, root!, "age");
  assert(
    root!.getInput(schemaOptionalInputName("age"))?.connection?.targetBlock(),
    "optional age child should attach",
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

Deno.test("schema toolbox nests loaded target drawer under schema root", () => {
  const target = getTargetFormatHandler("json-schema").load("summary.json", schema);
  const toolbox = buildDemoToolbox("en", {
    targetFormat: "json-schema",
    skeleton: target.skeleton,
  });
  const types = toolboxBlockTypes(toolbox);
  assert(types.includes("target_structure"));
  assert(types.includes("target_value"));
  const nestedCategory = (item: unknown): boolean => {
    if (!item || typeof item !== "object") return false;
    const rec = item as { kind?: string; contents?: unknown[] };
    if (rec.kind === "category" && Array.isArray(rec.contents)) {
      if (rec.contents.some((child) => {
        const c = child as { kind?: string };
        return c.kind === "category" || c.kind === "block";
      })) return true;
    }
    return Array.isArray(rec.contents) && rec.contents.some(nestedCategory);
  };
  assert(nestedCategory(toolbox), "target schema drawer should nest categories/blocks");
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
  const root = workspace.getAllBlocks(false).find((block) =>
    block.type === "target_structure" && Boolean(block.getInput("TARGET_systolic"))
  );
  assert(root, "systolic/diastolic mandatory slots should scaffold");
  assertEquals(root!.getInput("TARGET_unit"), null, "optional unit should stay off canvas");
  workspace.dispose();
});
