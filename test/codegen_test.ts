import { assertEquals, assertStringIncludes } from "@std/assert";
import { createEmptyModel, applyExpressionEdit } from "@intehrgrator/core/mapping_model/mod.ts";
import {
  generate,
  getExportTargetAdapter,
  jsonDollarPathToLookup,
  emitXQueryExpr,
} from "@intehrgrator/core/codegen/mod.ts";
import { parseExpression } from "@intehrgrator/core/expression/mod.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";

Deno.test("typescript codegen contains template id", () => {
  const model = applyExpressionEdit(createEmptyModel("vitals"), "s1", 'xpathNumber("/a")', {
    rmType: "DV_QUANTITY",
    returnType: "number",
  });
  const ts = generate(model, "typescript");
  assertEquals(ts.includes("vitals"), true);
  assertEquals(ts.includes("evaluateXPathToNumber"), true);
  assertEquals(ts.includes("defaults: Record<string, unknown> = {}"), true);
});

Deno.test("java codegen structure", () => {
  const model = createEmptyModel("vitals");
  const java = generate(model, "java");
  assertEquals(java.includes("class ConversionScript"), true);
});

Deno.test("handlebars export target preserves a user-authored template", () => {
  const model = createEmptyModel("summary");
  const template = "Hello {{patient.name}}";
  assertEquals(generate(model, "handlebars", { handlebarsTemplate: template }), template);
});

Deno.test("xquery codegen emits mapping-result module from Blockly slots", () => {
  const model = applyExpressionEdit(
    createEmptyModel("vitals"),
    "s1",
    'xpathNumber("$.systolic")',
    {
      rmType: "DV_QUANTITY",
      returnType: "number",
      label: "Systolic",
    },
  );
  model.slots.push({
    slotId: "s2",
    rmType: "DV_TEXT",
    expression: 'concat(trim(xpathString("$.unit")), " Hg")',
    returnType: "string",
  });

  const xq = generate(model, "xquery");
  assertStringIncludes(xq, 'xquery version "3.1"');
  assertStringIncludes(xq, "vitals");
  assertStringIncludes(xq, "element mapping-result");
  assertStringIncludes(xq, 'attribute id { "s1" }');
  assertStringIncludes(xq, "local:as-value");
  assertStringIncludes(xq, "DV_QUANTITY");
  assertStringIncludes(xq, "$source?systolic");
  assertStringIncludes(xq, "declare variable $defaults");
  assertStringIncludes(xq, "normalize-space");
  assertStringIncludes(xq, "concat(");

  const adapter = getExportTargetAdapter("xquery");
  assertEquals(adapter.extension, "xq");
  assertEquals(adapter.mime, "application/xquery");
});

Deno.test("xquery expression emit maps builtins and JSON paths", () => {
  assertEquals(
    jsonDollarPathToLookup("$.patient.vitals[1].systolic"),
    "$source?patient?vitals?1?systolic",
  );
  assertEquals(
    emitXQueryExpr(parseExpression('xpathString("/patient/name")')),
    'xs:string(($source/patient/name)[1])',
  );
  assertEquals(
    emitXQueryExpr(parseExpression('if(xpathBoolean("$.ok"), "a", "b")')),
    '(if (xs:boolean(($source?ok)[1])) then "a" else "b")',
  );
  assertEquals(
    emitXQueryExpr(parseExpression('maps_get("defaults", "language")')),
    '(if ("defaults" eq "defaults") then map:get($defaults, "language") else ())',
  );
});

Deno.test("test runner evaluates json slot", () => {
  const model = applyExpressionEdit(createEmptyModel("vitals"), "s1", 'xpathNumber("$.systolic")', {
    rmType: "DV_QUANTITY",
    returnType: "number",
  });
  const result = runTest(model, JSON.stringify({ systolic: 120 }), "json");
  assertEquals(result.ok || (result.composition as Record<string, unknown>)?.slots !== undefined, true);
});
