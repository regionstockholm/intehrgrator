import { assert, assertEquals, assertExists } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import "blockly/blocks";
import {
  initBlocklyGenerators,
  loadSkeletonIntoWorkspace,
  generateTypeScriptFromWorkspace,
} from "@intehrgrator/blockly/mod.ts";
import {
  CONVERSION_START_TYPE,
  TEXT_DOCUMENT_TYPE,
  ensureConversionStart,
  findConversionStart,
  findInstanceRootBlock,
  inferTargetFormatFromRoot,
  instanceRootTypeFromBlocklyState,
} from "@intehrgrator/blockly/conversion_start.ts";
import { generateSkeleton } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { buildDemoToolbox, toolboxBlockTypes } from "@intehrgrator/blockly/toolbox_demo.ts";
import { projectBlocklyState } from "@intehrgrator/workbench/mapping_spec/project.ts";
import { join } from "@std/path";

const fixture = await Deno.readTextFile(
  join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
);

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

Deno.test("Conversion start is in openEHR, JSON, XML, and Text drawers", () => {
  ensure();
  const types = toolboxBlockTypes(buildDemoToolbox("en"));
  assertEquals(types.filter((t) => t === CONVERSION_START_TYPE).length >= 4, true);
  assert(types.includes(TEXT_DOCUMENT_TYPE));
});

Deno.test("scaffolding an OPT attaches Conversion start on composition", () => {
  ensure();
  const opt = fixture;
  const { skeleton } = generateSkeleton(opt);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  const start = findConversionStart(workspace);
  assertExists(start);
  const root = findInstanceRootBlock(workspace);
  assertExists(root);
  assertEquals(root.type, "composition");
  assertEquals(start.getNextBlock()?.id, root.id);
  assertEquals(root.nextConnection, null);
  workspace.dispose();
});

Deno.test("a second Conversion start is dropped", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const first = workspace.newBlock(CONVERSION_START_TYPE);
  const json = workspace.newBlock("json_object");
  first.nextConnection?.connect(json.previousConnection!);
  ensureConversionStart(workspace);
  workspace.newBlock(CONVERSION_START_TYPE);
  ensureConversionStart(workspace);
  const starts = workspace.getAllBlocks(false).filter((b) => b.type === CONVERSION_START_TYPE);
  assertEquals(starts.length, 1);
  assertEquals(starts[0]?.id, first.id);
  workspace.dispose();
});

Deno.test("schema-less json_object under Start infers json-schema and emits TS {}", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const start = workspace.newBlock(CONVERSION_START_TYPE);
  const json = workspace.newBlock("json_object");
  start.nextConnection?.connect(json.previousConnection!);
  assertEquals(inferTargetFormatFromRoot("json_object"), "json-schema");
  const model = createEmptyModel("");
  model.targetFormat = "json-schema";
  const code = generateTypeScriptFromWorkspace(workspace, model);
  assertExists(code);
  assertEquals(code.includes("return {}"), true);
  workspace.dispose();
});

Deno.test("schema-less xml_element and Text document round-trip TypeScript", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const start = workspace.newBlock(CONVERSION_START_TYPE);
  const xml = workspace.newBlock("xml_element");
  start.nextConnection?.connect(xml.previousConnection!);
  const model = createEmptyModel("");
  model.targetFormat = "xml-schema";
  const xmlCode = generateTypeScriptFromWorkspace(workspace, model);
  assertExists(xmlCode);
  assertEquals(xmlCode.includes("return "), true);

  xml.previousConnection?.disconnect();
  xml.dispose(false);
  const text = workspace.newBlock(TEXT_DOCUMENT_TYPE);
  const literal = workspace.newBlock("text");
  literal.setFieldValue("hello", "TEXT");
  text.getInput("VALUE")?.connection?.connect(literal.outputConnection!);
  start.nextConnection?.connect(text.previousConnection!);
  model.targetFormat = "free-form";
  const textCode = generateTypeScriptFromWorkspace(workspace, model);
  assertExists(textCode);
  assertEquals(textCode.includes('"hello"'), true);
  workspace.dispose();
});

Deno.test("Mapping Spec omits Conversion start and projects the Instance root", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const start = workspace.newBlock(CONVERSION_START_TYPE);
  const json = workspace.newBlock("json_object");
  start.nextConnection?.connect(json.previousConnection!);
  const state = Blockly.serialization.workspaces.save(workspace);
  const projection = projectBlocklyState(state);
  assertEquals(projection.roots.some((r) => r.type === CONVERSION_START_TYPE), false);
  assertEquals(projection.roots.some((r) => r.type === "json_object"), true);
  workspace.dispose();
});

Deno.test("bundle JSON without Start still reports the Instance root type", () => {
  const type = instanceRootTypeFromBlocklyState({
    blocks: { blocks: [{ type: "json_object", id: "a" }] },
  });
  assertEquals(type, "json_object");
  const capped = instanceRootTypeFromBlocklyState({
    blocks: {
      blocks: [{
        type: CONVERSION_START_TYPE,
        next: { block: { type: "composition" } },
      }],
    },
  });
  assertEquals(capped, "composition");
});
