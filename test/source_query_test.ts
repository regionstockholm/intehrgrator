import { assertEquals } from "@std/assert";
import { inferSchemaFromInstance, loadJsonSchema, pathToFontoxpath } from "@intehrgrator/core/source/schema_loader.ts";
import { evaluate, createSourceContext } from "@intehrgrator/core/source/query_runtime.ts";

Deno.test("loadJsonSchema from json document", () => {
  const tree = loadJsonSchema(JSON.stringify({ patient: { id: "x" } }), "patient");
  assertEquals(tree.name, "patient");
  assertEquals(tree.children[0].name, "patient");
});

Deno.test("schema inference from json instance", () => {
  const tree = inferSchemaFromInstance(JSON.stringify({ patient: { id: "x" } }));
  assertEquals(tree.children[0].name, "patient");
});

Deno.test("fontoxpath json number evaluation", () => {
  const ctx = createSourceContext(JSON.stringify({ vitals: [{ systolic: 130 }] }), "json");
  const value = evaluate('xpathNumber("$.vitals[1].systolic")', ctx, "number");
  assertEquals(value, 130);
});

Deno.test("pathToFontoxpath json", () => {
  assertEquals(pathToFontoxpath("$.patient.id", "json"), "$.patient.id");
});
