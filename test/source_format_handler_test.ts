import { assertEquals, assertThrows } from "@std/assert";
import {
  detectSourceFormat,
  getSourceFormatHandler,
  isSourceFormatId,
  listSourceFormatIds,
  registerSourceFormatHandler,
  type SourceFormatHandler,
} from "@intehrgrator/core/source/mod.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";
import { createEmptyModel, applyExpressionEdit } from "@intehrgrator/core/mapping_model/mod.ts";

Deno.test("built-in format handlers are registered", () => {
  const ids = listSourceFormatIds();
  assertEquals(ids.includes("json"), true);
  assertEquals(ids.includes("xml"), true);
  assertEquals(isSourceFormatId("json"), true);
  assertEquals(isSourceFormatId("openehr-composition"), false);
});

Deno.test("detectSourceFormat from filename", () => {
  assertEquals(detectSourceFormat("vitals.json"), "json");
  assertEquals(detectSourceFormat("vitals.XML"), "xml");
  assertEquals(detectSourceFormat("schema.xsd"), "xml");
  assertEquals(detectSourceFormat("unknown.bin"), "json");
});

Deno.test("json handler loadSchema / pathToExpression / evaluate", () => {
  const handler = getSourceFormatHandler("json");
  const tree = handler.loadSchema(JSON.stringify({ vitals: { systolic: 120 } }), "root");
  assertEquals(tree.children[0].name, "vitals");

  const exprPath = handler.pathToExpression("$.vitals.systolic");
  assertEquals(exprPath, "$.vitals.systolic");

  const ctx = handler.createContext(JSON.stringify({ vitals: { systolic: 120 } }));
  const value = handler.evaluate('xpathNumber("$.vitals.systolic")', ctx, "number");
  assertEquals(value, 120);
});

Deno.test("xml handler pathToExpression", () => {
  const handler = getSourceFormatHandler("xml");
  assertEquals(handler.pathToExpression("/patient/id"), "/patient/id");
  assertEquals(handler.pathToExpression("patient/id"), "/patient/id");
});

Deno.test({
  name: "xml handler loadInstance / evaluate (requires DOMParser)",
  ignore: typeof globalThis.DOMParser === "undefined",
  fn() {
    const handler = getSourceFormatHandler("xml");
    const xml = "<patient><id>abc</id></patient>";
    const tree = handler.loadInstance(xml, "patient");
    assertEquals(tree.children[0].name, "id");

    const ctx = handler.createContext(xml);
    const value = handler.evaluate('xpathString("/patient/id")', ctx, "string");
    assertEquals(value, "abc");
  },
});

Deno.test("unknown format throws at the handler seam", () => {
  assertThrows(
    () => getSourceFormatHandler("openehr-composition"),
    Error,
    "Unsupported source format",
  );
});

Deno.test("registerSourceFormatHandler plugs a new adapter", () => {
  const extId = "test-custom-format";
  const custom: SourceFormatHandler = {
    id: extId,
    loadSchema: () => ({ path: "$", name: "stub", type: "object", children: [] }),
    loadInstance: () => ({ path: "$", name: "stub", type: "object", children: [] }),
    pathToExpression: (p) => `STUB:${p}`,
    createContext: (content) => ({ format: "json", json: JSON.parse(content) }),
    evaluate: () => "stubbed",
  };
  registerSourceFormatHandler(custom);
  assertEquals(isSourceFormatId(extId), true);
  assertEquals(getSourceFormatHandler(extId).pathToExpression("a.b"), "STUB:a.b");
  assertEquals(getSourceFormatHandler(extId).evaluate("x", custom.createContext("{}"), "string"), "stubbed");
});

Deno.test("Test Run goes through Source Format Handler", () => {
  let model = createEmptyModel("tmpl");
  model = applyExpressionEdit(model, "slot/systolic", 'xpathNumber("$.systolic")', {
    rmType: "DV_QUANTITY",
    returnType: "number",
  });
  const result = runTest(model, JSON.stringify({ systolic: 118 }), "json");
  assertEquals(result.ok, true);
  const composition = result.composition as { slots: Record<string, unknown> };
  assertEquals(composition.slots["slot/systolic"], 118);
});
