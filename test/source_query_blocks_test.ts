import { assertEquals, assert } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { javascriptGenerator } from "blockly/javascript";
import {
  initBlocklyGenerators,
  blockToExpression,
  buildDemoToolbox,
  createSourceQueryBlock,
  sourceBlockTypeForReturnType,
  sourceReturnTypeFromSchemaType,
} from "@intehrgrator/blockly/mod.ts";
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

Deno.test("Source toolbox drawer lists string, number, and boolean source blocks", () => {
  ensure();
  const toolbox = buildDemoToolbox("en") as {
    contents: Array<{ name?: string; contents?: Array<{ type?: string }> }>;
  };
  const source = toolbox.contents.find((cat) => cat.name === msg("en").CAT_SOURCE);
  const types = (source?.contents ?? []).map((block) => block.type);
  assertEquals(types, ["source_query", "source_query_number", "source_query_boolean"]);
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
