import { assertEquals } from "@std/assert";
import { inferSchemaFromInstance, loadJsonSchema, pathToFontoxpath, canonicalSyncPath } from "@intehrgrator/core/source/schema_loader.ts";
import { evaluate, createSourceContext } from "@intehrgrator/core/source/query_runtime.ts";

Deno.test("loadJsonSchema from json document", () => {
  const tree = loadJsonSchema(JSON.stringify({ patient: { id: "x" } }), "patient");
  assertEquals(tree.name, "patient");
  assertEquals(tree.children[0].name, "patient");
  assertEquals(tree.children[0].children[0].type, "string");
  assertEquals(tree.children[0].children[0].multiplicity, "1");
  assertEquals(tree.children[0].children[0].value, undefined);
});

Deno.test("loadJsonSchema from json schema document", () => {
  const tree = loadJsonSchema(JSON.stringify({
    type: "object",
    properties: {
      id: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["id"],
  }), "root");
  assertEquals(tree.type, "object");
  const idNode = tree.children.find((c) => c.name === "id");
  const tagsNode = tree.children.find((c) => c.name === "tags");
  assertEquals(idNode?.multiplicity, "1");
  assertEquals(tagsNode?.type, "array");
  assertEquals(tagsNode?.multiplicity, "0..*");
});

Deno.test("canonicalSyncPath aligns schema and instance paths", () => {
  assertEquals(canonicalSyncPath("$.patient.id"), "$.patient.id");
  assertEquals(canonicalSyncPath("$/patient/id"), "$.patient.id");
  assertEquals(canonicalSyncPath("$.vitals[1].systolic"), "$.vitals[*].systolic");
});

Deno.test("schema inference from json instance", () => {
  const tree = inferSchemaFromInstance(JSON.stringify({ patient: { id: "x" } }));
  assertEquals(tree.children[0].name, "patient");
  assertEquals(tree.children[0].children[0].path, "$.patient.id");
  assertEquals(tree.children[0].children[0].value, "x");
});

Deno.test("fontoxpath json number evaluation", () => {
  const ctx = createSourceContext(JSON.stringify({ vitals: [{ systolic: 130 }] }), "json");
  const value = evaluate('xpathNumber("$.vitals[1].systolic")', ctx, "number");
  assertEquals(value, 130);
});

Deno.test("pathToFontoxpath json", () => {
  assertEquals(pathToFontoxpath("$.patient.id", "json"), "$.patient.id");
});
