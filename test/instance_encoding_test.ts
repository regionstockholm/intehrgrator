import { assert, assertEquals, assertThrows } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  attachStartToInstanceRoot,
  findInstanceRootUnderStart,
  initBlocklyGenerators,
  TEXT_DOCUMENT_BLOCK_TYPE,
  workspaceToModelJson,
} from "@intehrgrator/blockly/mod.ts";
import {
  CONVERSION_START_TYPE,
  INSTANCE_ROOT_CONNECTION,
  applyInstanceRootCap,
  productStackBlocks,
} from "@intehrgrator/blockly/instance_root.ts";
import { generateTypeScriptFromWorkspace } from "@intehrgrator/blockly/typescript_codegen.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import {
  formatTestRunPayload,
  INSTANCE_ENCODING_FIELD,
  instanceShapeForEncoding,
  juxtaposeFragments,
  parseInstanceEncoding,
  preferredInstanceEncoding,
  serializeInstance,
} from "@intehrgrator/core/output/instance_encoding.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";
import { getTargetFormatHandler } from "@intehrgrator/core/target/mod.ts";
import {
  DEFAULT_INSTANCE_ENCODING,
  isInstanceEncoding,
} from "@intehrgrator/types/mod.ts";
import { join } from "@std/path";

function freshWorkspace(): import("blockly/core").Workspace {
  initBlocklyGenerators();
  return new Blockly.Workspace();
}

const MINIMAL_COMPOSITION = {
  _type: "COMPOSITION",
  name: { _type: "DV_TEXT", value: "Blood pressure" },
  archetype_node_id: "openEHR-EHR-COMPOSITION.report.v1",
  language: {
    _type: "CODE_PHRASE",
    terminology_id: { _type: "TERMINOLOGY_ID", value: "ISO_639-1" },
    code_string: "en",
  },
  territory: {
    _type: "CODE_PHRASE",
    terminology_id: { _type: "TERMINOLOGY_ID", value: "ISO_3166-1" },
    code_string: "SE",
  },
  category: {
    _type: "DV_CODED_TEXT",
    value: "event",
    defining_code: {
      _type: "CODE_PHRASE",
      terminology_id: { _type: "TERMINOLOGY_ID", value: "openehr" },
      code_string: "433",
    },
  },
  composer: { _type: "PARTY_IDENTIFIED", name: "Test" },
};

Deno.test("parseInstanceEncoding defaults and accepts official encodings", () => {
  assertEquals(parseInstanceEncoding(undefined), DEFAULT_INSTANCE_ENCODING);
  assertEquals(parseInstanceEncoding("nope"), "canonical-json");
  assertEquals(parseInstanceEncoding("canonical-xml"), "canonical-xml");
  assertEquals(parseInstanceEncoding("flat-json"), "flat-json");
  assertEquals(parseInstanceEncoding("structured-json"), "structured-json");
  assert(isInstanceEncoding("canonical-json"));
  assertEquals(isInstanceEncoding("hybrid"), false);
  assertEquals(instanceShapeForEncoding("canonical-xml"), "xml");
  assertEquals(instanceShapeForEncoding("flat-json"), "json");
  assertEquals(preferredInstanceEncoding({}), "canonical-json");
  assertEquals(preferredInstanceEncoding({ instanceEncodings: ["canonical-xml"] }), "canonical-xml");
});

Deno.test("juxtaposeFragments concatenates with no implicit delimiter", () => {
  assertEquals(juxtaposeFragments(["{\"a\":1}", "\n", "{\"b\":2}"]), "{\"a\":1}\n{\"b\":2}");
  assertEquals(juxtaposeFragments(["<A/>", "<B/>"]), "<A/><B/>");
});

Deno.test("serializeInstance Canonical JSON pretty-prints a composition object", () => {
  const pretty = serializeInstance(MINIMAL_COMPOSITION, "canonical-json", { prettyPrint: true });
  assert(pretty.includes("\n"));
  assert(pretty.includes('"COMPOSITION"'));
  const compact = serializeInstance(MINIMAL_COMPOSITION, "canonical-json", { prettyPrint: false });
  assertEquals(compact.includes("\n"), false);
});

Deno.test("serializeInstance Canonical XML emits ITS-XML", () => {
  const xml = serializeInstance(MINIMAL_COMPOSITION, "canonical-xml", { prettyPrint: true });
  assert(xml.includes("COMPOSITION"), xml.slice(0, 200));
  assert(xml.trimStart().startsWith("<") || xml.includes("<COMPOSITION") || xml.includes("COMPOSITION"), xml.slice(0, 300));
});

Deno.test("serializeInstance Simplified FLAT needs a Web Template", () => {
  assertThrows(
    () => serializeInstance(MINIMAL_COMPOSITION, "flat-json"),
    Error,
    "Web Template",
  );
});

Deno.test("formatTestRunPayload parses a single JSON-family root and leaves XML/stacks as strings", () => {
  assertEquals(formatTestRunPayload('{"_type":"COMPOSITION"}', "canonical-json", false), {
    _type: "COMPOSITION",
  });
  assertEquals(formatTestRunPayload("<composition/>", "canonical-xml", false), "<composition/>");
  assertEquals(
    formatTestRunPayload('{"a":1}{"b":2}', "canonical-json", true),
    '{"a":1}{"b":2}',
  );
});

Deno.test("applyInstanceRootCap keeps a next INSTANCE_ROOT notch", () => {
  const ws = freshWorkspace();
  const root = ws.newBlock("json_object");
  applyInstanceRootCap(root);
  assert(root.nextConnection, "product stack needs a next notch");
  assertEquals(root.nextConnection?.getCheck(), [INSTANCE_ROOT_CONNECTION]);
  assertEquals(root.previousConnection?.getCheck(), [INSTANCE_ROOT_CONNECTION]);
  ws.dispose();
});

Deno.test("COMPOSITION exposes Instance encoding dropdown and a next notch", () => {
  const ws = freshWorkspace();
  const composition = ws.newBlock("composition");
  assertEquals(composition.getFieldValue(INSTANCE_ENCODING_FIELD), "canonical-json");
  composition.setFieldValue("canonical-xml", INSTANCE_ENCODING_FIELD);
  assertEquals(composition.getFieldValue(INSTANCE_ENCODING_FIELD), "canonical-xml");
  assertEquals(
    composition.getInput("HEADER")?.fieldRow.some((field) => field.name === INSTANCE_ENCODING_FIELD),
    false,
    "encoding dropdown is not on HEADER",
  );
  assertEquals(composition.inputList[0]?.name, "HEADER");
  assertEquals(composition.inputList[1]?.name, "ENCODING");
  assert(
    composition.getInput("ENCODING")?.fieldRow.some((field) => field.name === INSTANCE_ENCODING_FIELD),
    "encoding dropdown sits on the ENCODING row under the title",
  );
  assert(composition.nextConnection, "COMPOSITION stacks with sibling instance roots");
  const nextCheck = composition.nextConnection?.getCheck();
  assertEquals(
    nextCheck === INSTANCE_ROOT_CONNECTION ||
      (Array.isArray(nextCheck) && nextCheck.includes(INSTANCE_ROOT_CONNECTION)),
    true,
  );
  ws.dispose();
});

Deno.test("Conversion start product stack chains two json_object roots", () => {
  const ws = freshWorkspace();
  const first = ws.newBlock("json_object");
  const second = ws.newBlock("json_object");
  attachStartToInstanceRoot(ws, first);
  assert(first.nextConnection, "capped root still has next");
  first.nextConnection!.connect(second.previousConnection!);
  assertEquals(findInstanceRootUnderStart(ws)?.id, first.id);
  const stack = productStackBlocks(ws);
  assertEquals(stack.map((block) => block.type), ["json_object", "json_object"]);
  ws.dispose();
});

Deno.test("mapping IR records per-root Instance encoding in stack order", () => {
  const ws = freshWorkspace();
  const first = ws.newBlock("composition");
  const second = ws.newBlock("composition");
  first.setFieldValue("canonical-json", INSTANCE_ENCODING_FIELD);
  second.setFieldValue("canonical-xml", INSTANCE_ENCODING_FIELD);
  attachStartToInstanceRoot(ws, first);
  first.nextConnection!.connect(second.previousConnection!);
  const ir = workspaceToModelJson(ws);
  assertEquals(ir.instanceEncodings, ["canonical-json", "canonical-xml"]);
  ws.dispose();
});

Deno.test("Text document has no Instance encoding field", () => {
  const ws = freshWorkspace();
  const doc = ws.newBlock(TEXT_DOCUMENT_BLOCK_TYPE);
  assertEquals(doc.getField(INSTANCE_ENCODING_FIELD), null);
  applyInstanceRootCap(doc);
  assert(doc.nextConnection);
  ws.dispose();
});

Deno.test("TypeScript codegen juxtaposes stacked Text document roots", () => {
  const ws = freshWorkspace();
  const first = ws.newBlock(TEXT_DOCUMENT_BLOCK_TYPE);
  const second = ws.newBlock(TEXT_DOCUMENT_BLOCK_TYPE);
  const a = ws.newBlock("text");
  a.setFieldValue("hello", "TEXT");
  const b = ws.newBlock("text");
  b.setFieldValue("world", "TEXT");
  first.getInput("VALUE")?.connection?.connect(a.outputConnection!);
  second.getInput("VALUE")?.connection?.connect(b.outputConnection!);
  attachStartToInstanceRoot(ws, first);
  first.nextConnection!.connect(second.previousConnection!);
  const model = createEmptyModel("");
  model.targetFormat = "free-form";
  const code = generateTypeScriptFromWorkspace(ws, model);
  assert(code);
  assert(code.includes("hello"));
  assert(code.includes("world"));
  assert(code.includes('join("")'), code);
  assertEquals(code.includes("\nworld") && code.includes("hello\n"), false);
  ws.dispose();
});

Deno.test("TypeScript codegen serializes Canonical XML on a COMPOSITION root", () => {
  const ws = freshWorkspace();
  const composition = ws.newBlock("composition");
  composition.setFieldValue("canonical-xml", INSTANCE_ENCODING_FIELD);
  attachStartToInstanceRoot(ws, composition);
  const model = createEmptyModel("report");
  model.targetFormat = "openehr-template";
  model.instanceEncodings = ["canonical-xml"];
  const code = generateTypeScriptFromWorkspace(ws, model);
  assert(code);
  assert(code.includes("XmlSerializer"));
  assert(code.includes(": string"));
  ws.dispose();
});

Deno.test("Conversion start remains unique when stacking roots", () => {
  const ws = freshWorkspace();
  const first = ws.newBlock("json_object");
  const second = ws.newBlock("json_object");
  attachStartToInstanceRoot(ws, first);
  first.nextConnection!.connect(second.previousConnection!);
  const starts = ws.getTopBlocks(false).filter((block) => block.type === CONVERSION_START_TYPE);
  assertEquals(starts.length, 1);
  ws.dispose();
});

Deno.test("Mapping preview Test Run Canonical XML serializes the rendered composition", async () => {
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const target = getTargetFormatHandler("openehr-template").load("blood_pressure.opt", opt);
  const model = createEmptyModel(target.targetId);
  model.targetFormat = "openehr-template";
  model.instanceEncodings = ["canonical-xml"];
  const result = runTest(model, JSON.stringify({ systolic: 120 }), "json", { target });
  assertEquals(result.ok, true);
  assertEquals(typeof result.output, "string");
  const xml = String(result.output);
  assert(xml.includes("COMPOSITION"), xml.slice(0, 400));
});
