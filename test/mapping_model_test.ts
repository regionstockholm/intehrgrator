import { assertEquals } from "@std/assert";
import { createEmptyModel, applyExpressionEdit, validateModel } from "@intehrgrator/core/mapping_model/mod.ts";
import type { SkeletonNode } from "@intehrgrator/types/mod.ts";

const skeleton: SkeletonNode[] = [{
  slotId: "t1/",
  blockType: "composition",
  rmType: "COMPOSITION",
  label: "comp",
  kind: "container",
  mandatory: true,
  children: [{
    slotId: "t1//value",
    blockType: "dv_quantity",
    rmType: "DV_QUANTITY",
    label: "systolic",
    rmAttribute: "content",
    kind: "value",
    mandatory: true,
    children: [],
  }],
}];

Deno.test("mapping model expression edit", () => {
  let model = createEmptyModel("t1");
  model = applyExpressionEdit(model, "t1//value", 'xpathNumber("/systolic")', {
    rmType: "DV_QUANTITY",
    returnType: "number",
    mandatory: true,
  });
  assertEquals(model.slots.length, 1);
  assertEquals(model.slots[0].expression.includes("systolic"), true);
});

Deno.test("mapping model is a derived index with a versioned target", () => {
  const model = createEmptyModel("t1");
  model.targetFormat = "json-schema";
  assertEquals(model.modelVersion, 2);
  assertEquals(model.targetFormat, "json-schema");
});

Deno.test("validate unmapped mandatory slot", () => {
  const model = createEmptyModel("t1");
  const issues = validateModel(model, skeleton);
  assertEquals(issues.some((i) => i.severity === "warning"), true);
});
