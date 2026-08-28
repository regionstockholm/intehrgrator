import { assertEquals, assert } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { javascriptGenerator } from "blockly/javascript";
import {
  initBlocklyGenerators,
  blockToExpression,
  buildDemoToolbox,
  createSourceQueryBlock,
  sourceBlockTypeForReturnType,
  sourceQueryFieldLabel,
  sourceReturnTypeFromSchemaType,
} from "@intehrgrator/blockly/mod.ts";
import { rmAttributeInputName } from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { msg } from "@intehrgrator/blockly/i18n/custom_msg.ts";
import { parseSourceDragPayload } from "@intehrgrator/workbench/tree_views.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

Deno.test("typed source_query blocks are registered with String/Number/Boolean outputs", () => {
  ensure();
  assert(Blockly.Blocks["source_query"], "missing source_query");
  assert(Blockly.Blocks["source_query_number"], "missing source_query_number");
  assert(Blockly.Blocks["source_query_boolean"], "missing source_query_boolean");

  const workspace = new Blockly.Workspace();
  const str = workspace.newBlock("source_query");
  const num = workspace.newBlock("source_query_number");
  const bool = workspace.newBlock("source_query_boolean");
  assertEquals(str.outputConnection?.getCheck()?.includes("String"), true);
  assertEquals(num.outputConnection?.getCheck()?.includes("Number"), true);
  assertEquals(bool.outputConnection?.getCheck()?.includes("Boolean"), true);
  workspace.dispose();
});

Deno.test("source query labels use type emoji in front of the localized source word", () => {
  assertEquals(sourceQueryFieldLabel("string", "källa"), "🔤 källa");
  assertEquals(sourceQueryFieldLabel("number", "source"), "🔢 source");
  assertEquals(sourceQueryFieldLabel("boolean", "source"), "☑️ source");

  ensure();
  const workspace = new Blockly.Workspace();
  const word = msg("en").SOURCE_QUERY;
  const str = workspace.newBlock("source_query");
  const num = workspace.newBlock("source_query_number");
  const bool = workspace.newBlock("source_query_boolean");
  assertEquals(str.inputList[0]?.fieldRow[0]?.getText(), sourceQueryFieldLabel("string", word));
  assertEquals(num.inputList[0]?.fieldRow[0]?.getText(), sourceQueryFieldLabel("number", word));
  assertEquals(bool.inputList[0]?.fieldRow[0]?.getText(), sourceQueryFieldLabel("boolean", word));
  workspace.dispose();
});

Deno.test("source_query keeps RETURN_TYPE for old workspaces without a visible string box", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const str = workspace.newBlock("source_query");
  assertEquals(str.getFieldValue("EXPRESSION"), "/path");
  assertEquals(str.getFieldValue("RETURN_TYPE"), "string");
  const returnField = str.getField("RETURN_TYPE");
  assert(returnField);
  assertEquals(returnField instanceof Blockly.FieldTextInput, false);
  const saved = Blockly.serialization.blocks.save(str) as {
    fields?: Record<string, string>;
  };
  assertEquals(saved.fields?.RETURN_TYPE, "string");
  workspace.dispose();
});

Deno.test("Source toolbox drawer lists string, number, and boolean source blocks", () => {
  ensure();
  const toolbox = buildDemoToolbox("en") as {
    contents: Array<{ name?: string; contents?: Array<{ type?: string }> }>;
  };
  const source = toolbox.contents.find((cat) => cat.name === msg("en").CAT_SOURCE);
  const types = (source?.contents ?? []).map((block) => block.type);
      assertEquals(types, [
        "source_query",
        "source_query_number",
        "source_query_boolean",
        "source_query_node",
      ]);
});

Deno.test("openEHR types drawer starts with COMPOSITION and keeps DATA_VALUE leaves", () => {
  ensure();
  const toolbox = buildDemoToolbox("sv") as {
    contents: Array<{ name?: string; contents?: Array<{ type?: string; kind?: string; contents?: Array<{ type?: string }> }> }>;
  };
  const cat = toolbox.contents.find((c) => c.name === msg("sv").CAT_OPENEHR_TYPES);
  assertEquals(cat?.name, "openEHR types");
  const types: string[] = [];
  const walk = (items: Array<{ type?: string; kind?: string; contents?: Array<{ type?: string }> }> | undefined) => {
    for (const item of items ?? []) {
      if (item.type) types.push(item.type);
      if (Array.isArray(item.contents)) walk(item.contents);
    }
  };
  walk(cat?.contents);
  assertEquals(types.includes("composition"), true);
  assertEquals(types.filter((t) => t === "section").length, 1);
  assertEquals(types.includes("observation"), true);
  assertEquals(types.includes("evaluation"), true);
  assertEquals(types.includes("instruction"), true);
  assertEquals(types.includes("action"), true);
  assertEquals(types.includes("admin_entry"), true);
  assertEquals(types.includes("cluster"), true);
  assertEquals(types.includes("element"), true);
  assertEquals(types.indexOf("element") > types.indexOf("cluster"), true);
  assertEquals(types.includes("party_proxy"), true);
  assertEquals(types.includes("party_self"), true);
  assertEquals(types.includes("party_identified"), true);
  assertEquals(types.includes("party_related"), true);
  assertEquals(types.includes("item_structure"), true);
  assertEquals(types.includes("dv_quantity"), true);
});

Deno.test("schema types map to Blockly source return types", () => {
  assertEquals(sourceReturnTypeFromSchemaType("string"), "string");
  assertEquals(sourceReturnTypeFromSchemaType("integer"), "number");
  assertEquals(sourceReturnTypeFromSchemaType("number"), "number");
  assertEquals(sourceReturnTypeFromSchemaType("boolean"), "boolean");
  assertEquals(sourceReturnTypeFromSchemaType("object"), "string");
  assertEquals(sourceReturnTypeFromSchemaType(undefined), "string");
  assertEquals(sourceBlockTypeForReturnType("number"), "source_query_number");
  assertEquals(sourceBlockTypeForReturnType("boolean"), "source_query_boolean");
  assertEquals(sourceBlockTypeForReturnType("string"), "source_query");
});

Deno.test("createSourceQueryBlock serializes to typed xpath* expressions", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const num = createSourceQueryBlock(workspace, "$.systolic", "number");
  assertEquals(num.type, "source_query_number");
  assertEquals(blockToExpression(num), 'xpathNumber("$.systolic")');

  const str = createSourceQueryBlock(workspace, "$.patientId", "string");
  assertEquals(str.type, "source_query");
  assertEquals(blockToExpression(str), 'xpathString("$.patientId")');

  const bool = createSourceQueryBlock(workspace, "$.active", "boolean");
  assertEquals(bool.type, "source_query_boolean");
  assertEquals(blockToExpression(bool), 'xpathBoolean("$.active")');

  javascriptGenerator.init(workspace);
  const code = javascriptGenerator.blockToCode(num) as [string, number];
  assert(code[0].includes("evaluateXPathToNumber"), code[0]);
  assert(code[0].includes("$.systolic"), code[0]);
  workspace.dispose();
});

Deno.test("source drag payload keeps schemaType", () => {
  const dt = {
    getData(mime: string) {
      if (mime === "application/x-intehrgrator-source" || mime === "text/plain") {
        return JSON.stringify({
          path: "$.systolic",
          format: "json",
          origin: "schema",
          schemaType: "integer",
        });
      }
      return "";
    },
  } as unknown as DataTransfer;
  const payload = parseSourceDragPayload(dt);
  assertEquals(payload?.path, "$.systolic");
  assertEquals(payload?.schemaType, "integer");
  assertEquals(payload?.origin, "schema");
});

Deno.test("COMPOSITION generator emits ehrtslib constructor with nested CONTENT_ITEM", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const composition = workspace.newBlock("composition");
  const observation = workspace.newBlock("observation");
  const content = composition.getInput(rmAttributeInputName("content"))?.connection;
  assert(content && observation.previousConnection);
  content.connect(observation.previousConnection);
  javascriptGenerator.init(workspace);
  const code = javascriptGenerator.blockToCode(composition) as string;
  assert(code.includes("new COMPOSITION"), code);
  assert(code.includes("rm(OBSERVATION") || code.includes("OBSERVATION"), code);
  assert(code.includes("content:"), code);
  workspace.dispose();
});
