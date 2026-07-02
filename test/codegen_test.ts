import { assertEquals } from "@std/assert";
import { createEmptyModel, applyExpressionEdit } from "@intehrgrator/core/mapping_model/mod.ts";
import { generate } from "@intehrgrator/core/codegen/mod.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";

Deno.test("typescript codegen contains template id", () => {
  const model = applyExpressionEdit(createEmptyModel("vitals"), "s1", 'xpathNumber("/a")', {
    rmType: "DV_QUANTITY",
    returnType: "number",
  });
  const ts = generate(model, "typescript");
  assertEquals(ts.includes("vitals"), true);
  assertEquals(ts.includes("evaluateXPathToNumber"), true);
});

Deno.test("java codegen structure", () => {
  const model = createEmptyModel("vitals");
  const java = generate(model, "java");
  assertEquals(java.includes("class ConversionScript"), true);
});

Deno.test("test runner evaluates json slot", () => {
  const model = applyExpressionEdit(createEmptyModel("vitals"), "s1", 'xpathNumber("$.systolic")', {
    rmType: "DV_QUANTITY",
    returnType: "number",
  });
  const result = runTest(model, JSON.stringify({ systolic: 120 }), "json");
  assertEquals(result.ok || (result.composition as Record<string, unknown>)?.slots !== undefined, true);
});
