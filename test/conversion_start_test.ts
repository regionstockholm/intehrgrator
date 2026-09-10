import { assertEquals, assertExists } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import {
  attachStartToInstanceRoot,
  ensureConversionStartOnScaffold,
  findScaffoldInstanceRoot,
} from "@intehrgrator/blockly/conversion_start_canvas.ts";
import {
  CONVERSION_START_TYPE,
  findConversionStartBlock,
  findInstanceRootUnderStart,
  inferTargetFormatFromRoot,
  TEXT_DOCUMENT_BLOCK_TYPE,
} from "@intehrgrator/blockly/instance_root.ts";
import { registerTargetBlocks } from "@intehrgrator/blockly/blocks/target_blocks.ts";
import { generateTypeScriptFromWorkspace } from "@intehrgrator/blockly/typescript_codegen.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { projectBlocklyState } from "@intehrgrator/workbench/mapping_spec/mod.ts";
import { ensureDefaultsBlock } from "@intehrgrator/blockly/defaults_canvas.ts";

function freshWorkspace(): import("blockly/core").Workspace {
  initBlocklyGenerators();
  registerTargetBlocks();
  return new Blockly.Workspace();
}

Deno.test("scaffold attach places Conversion start above json_object root", () => {
  const ws = freshWorkspace();
  const root = ws.newBlock("json_object");
  attachStartToInstanceRoot(ws, root);
  const start = findConversionStartBlock(ws);
  assertExists(start);
  assertEquals(findInstanceRootUnderStart(ws)?.type, "json_object");
  assertEquals(root.nextConnection, null);
  assertExists(root.previousConnection);
});

Deno.test("ensureConversionStartOnScaffold attaches when root exists without Start", () => {
  const ws = freshWorkspace();
  ensureDefaultsBlock(ws, "en");
  const root = ws.newBlock("json_object");
  ensureConversionStartOnScaffold(ws);
  assertEquals(findConversionStartBlock(ws)?.type, CONVERSION_START_TYPE);
  assertEquals(findScaffoldInstanceRoot(ws)?.type, "json_object");
});

Deno.test("schema-less json_object codegen returns object literal", () => {
  const ws = freshWorkspace();
  const root = ws.newBlock("json_object");
  attachStartToInstanceRoot(ws, root);
  const model = createEmptyModel("");
  model.targetFormat = inferTargetFormatFromRoot(root);
  const code = generateTypeScriptFromWorkspace(ws, model);
  assertExists(code);
  assertEquals(code.includes("return"), true);
});

Deno.test("text document instance root codegen returns string expression", () => {
  const ws = freshWorkspace();
  const doc = ws.newBlock(TEXT_DOCUMENT_BLOCK_TYPE);
  const text = ws.newBlock("text");
  text.setFieldValue("hello", "TEXT");
  doc.getInput("VALUE")?.connection?.connect(text.outputConnection!);
  attachStartToInstanceRoot(ws, doc);
  const model = createEmptyModel("");
  model.targetFormat = "free-form";
  const code = generateTypeScriptFromWorkspace(ws, model);
  assertExists(code);
  assertEquals(code.includes("hello"), true);
});

Deno.test("mapping spec treats Conversion start as chrome header", () => {
  const ws = freshWorkspace();
  const root = ws.newBlock("json_object");
  attachStartToInstanceRoot(ws, root);
  const state = Blockly.serialization.workspaces.save(ws);
  const projection = projectBlocklyState(state);
  const startLine = projection.lines.find((l) => l.type === "conversion_start");
  assertExists(startLine);
  assertEquals(startLine.kind, "header");
  const divider = projection.lines.find((l) => l.type === "json_object" && l.kind === "header");
  assertExists(divider);
});
