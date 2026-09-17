import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  findNodeBySyncPath,
  loadJsonSchema,
} from "@intehrgrator/core/source/schema_loader.ts";
import { getSourceFormatHandler } from "@intehrgrator/core/source/mod.ts";
import type { SchemaTreeNode } from "@intehrgrator/types/mod.ts";

function collectNames(node: SchemaTreeNode): string[] {
  return [node.name, ...node.children.flatMap(collectNames)];
}

Deno.test("JSON Schema $defs $ref inlines Substans fields on AdministrationRCCV1", async () => {
  const schemaText = await Deno.readTextFile(
    join(
      import.meta.dirname!,
      "fixtures",
      "administrerad-medicinsk-onkologisk-behandling",
      "source-schema",
      "AdministrationRCCV1_source_schema.json",
    ),
  );
  const handler = getSourceFormatHandler("json");
  const tree = handler.loadSchema(schemaText, "AdministrationRCCV1");
  const names = collectNames(tree);
  assertEquals(names.includes("$defs"), false, names.join(","));
  assertEquals(names.includes("Substanser"), true, names.join(","));

  const dose = findNodeBySyncPath(tree, "$.Substanser[*].Dose");
  assert(dose, "expected $.Substanser[*].Dose after $ref resolution");
  assertEquals(dose.type, "number");
  assertEquals(dose.multiplicity, "0..1");
  const item = findNodeBySyncPath(tree, "$.Substanser[*]");
  assert(item);
  assertEquals(item.type, "object");

  const atc = findNodeBySyncPath(tree, "$.Substanser[*].Innholdstoff_ATC");
  assert(atc, "expected $.Substanser[*].Innholdstoff_ATC");
  assertEquals(atc.type, "string");
  assertEquals(handler.pathToExpression(atc.path), "$.Substanser[*].Innholdstoff_ATC");
});

Deno.test("nested $defs refs expand independently on OrdinationRCCV1", async () => {
  const schemaText = await Deno.readTextFile(
    join(
      import.meta.dirname!,
      "fixtures",
      "ordinerad-medicinsk-onkologisk-behandling",
      "source-schema",
      "OrdinationRCCV1_source_schema.json",
    ),
  );
  const tree = loadJsonSchema(schemaText, "OrdinationRCCV1");
  const names = collectNames(tree);
  assertEquals(names.includes("$defs"), false, names.join(","));

  const dayNo = findNodeBySyncPath(tree, "$.KurDagar[*].KurdagLopenummer");
  assert(dayNo, "expected KurDag fields under $.KurDagar[*]");
  assertEquals(dayNo.type, "integer");

  const atc = findNodeBySyncPath(tree, "$.KurDagar[*].Substanser[*].Innholdstoff_ATC");
  assert(atc, "expected nested Substans $ref under KurDag");
  assertEquals(atc.type, "string");
  assertEquals(atc.path, "$.KurDagar[*].Substanser[*].Innholdstoff_ATC");
});

Deno.test("the same $defs schema can be mapped from every $ref site", () => {
  const tree = loadJsonSchema(JSON.stringify({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {
      home: { $ref: "#/$defs/Address" },
      work: { $ref: "#/$defs/Address" },
    },
    $defs: {
      Address: {
        type: "object",
        properties: {
          street: { type: "string" },
        },
        required: ["street"],
      },
    },
  }), "Places");
  const home = findNodeBySyncPath(tree, "$.home.street");
  const work = findNodeBySyncPath(tree, "$.work.street");
  assert(home);
  assert(work);
  assertEquals(home.path, "$.home.street");
  assertEquals(work.path, "$.work.street");
  assertEquals(home.multiplicity, "1");
  assertEquals(work.multiplicity, "1");
});

Deno.test("draft-07 definitions $ref inlines like $defs", () => {
  const tree = loadJsonSchema(JSON.stringify({
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties: {
      item: { $ref: "#/definitions/Line" },
    },
    definitions: {
      Line: {
        type: "object",
        properties: { sku: { type: "string" } },
      },
    },
  }), "Order");
  assertEquals(collectNames(tree).includes("definitions"), false);
  const sku = findNodeBySyncPath(tree, "$.item.sku");
  assert(sku);
  assertEquals(sku.type, "string");
});

Deno.test("circular $ref stops expanding instead of looping", () => {
  const tree = loadJsonSchema(JSON.stringify({
    type: "object",
    properties: {
      child: { $ref: "#/$defs/Node" },
    },
    $defs: {
      Node: {
        type: "object",
        properties: {
          name: { type: "string" },
          child: { $ref: "#/$defs/Node" },
        },
      },
    },
  }), "Tree");
  const name = findNodeBySyncPath(tree, "$.child.name");
  assert(name);
  const nested = findNodeBySyncPath(tree, "$.child.child");
  assert(nested);
  assertEquals(nested.type, "object");
  assertEquals(nested.children.length, 0);
});

Deno.test("$ref sibling description is kept on the usage site", () => {
  const tree = loadJsonSchema(JSON.stringify({
    type: "object",
    properties: {
      home: {
        $ref: "#/$defs/Address",
        description: "Home address",
      },
    },
    $defs: {
      Address: {
        type: "object",
        description: "Postal address",
        properties: { street: { type: "string" } },
      },
    },
  }), "Contact");
  const home = findNodeBySyncPath(tree, "$.home");
  assert(home);
  assertEquals(home.description, "Home address");
  assertEquals(home.type, "object");
});

Deno.test("root $ref into $defs is treated as JSON Schema, not instance keys", () => {
  const tree = loadJsonSchema(JSON.stringify({
    $ref: "#/$defs/Root",
    $defs: {
      Root: {
        type: "object",
        properties: { id: { type: "string" } },
      },
    },
  }), "Wrapped");
  const names = collectNames(tree);
  assertEquals(names.includes("$defs"), false, names.join(","));
  assertEquals(names.includes("$ref"), false, names.join(","));
  const id = findNodeBySyncPath(tree, "$.id");
  assert(id);
  assertEquals(id.type, "string");
});
