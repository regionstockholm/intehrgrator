import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { loadJsonSchema } from "@intehrgrator/core/source/schema_loader.ts";
import { validateInstanceAgainstSchema } from "@intehrgrator/core/source/instance_validation.ts";
import { jsonPointerToPath } from "@intehrgrator/core/source/json_schema_validate.ts";

const schemaJson = JSON.stringify({
  type: "object",
  properties: {
    patientId: { type: "string" },
    systolic: { type: "number" },
    diastolic: { type: "number" },
  },
  required: ["patientId", "systolic"],
});

Deno.test("validateInstanceAgainstSchema accepts matching instance", () => {
  const schema = loadJsonSchema(schemaJson, "root");
  const issues = validateInstanceAgainstSchema(
    JSON.stringify({ patientId: "p1", systolic: 120, diastolic: 80 }),
    "json",
    schema,
  );
  assertEquals(issues, []);
});

Deno.test("validateInstanceAgainstSchema reports unknown property", () => {
  const schema = loadJsonSchema(schemaJson, "root");
  const issues = validateInstanceAgainstSchema(
    JSON.stringify({ patientId: "p1", systolic: 120, unknownField: true }),
    "json",
    schema,
  );
  assertEquals(issues.some((i) => i.message.includes("Not in schema")), true);
});

Deno.test("validateInstanceAgainstSchema reports missing required field", () => {
  const schema = loadJsonSchema(schemaJson, "root");
  const issues = validateInstanceAgainstSchema(
    JSON.stringify({ patientId: "p1" }),
    "json",
    schema,
  );
  assertEquals(issues.some((i) => i.message.includes("Required field missing")), true);
});

Deno.test("validateInstanceAgainstSchema reports type mismatch", () => {
  const schema = loadJsonSchema(schemaJson, "root");
  const issues = validateInstanceAgainstSchema(
    JSON.stringify({ patientId: "p1", systolic: "not-a-number" }),
    "json",
    schema,
  );
  assertEquals(issues.some((i) => i.message.includes("Type mismatch")), true);
});

Deno.test("validateInstanceAgainstSchema reports JSON Schema minimum and enum violations", async () => {
  const schemaText = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "legacy-simulated", "bp-sche.json"),
  );
  const instanceText = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "legacy-simulated", "bp-inst-3-invalid.json"),
  );
  const schema = loadJsonSchema(schemaText, "BloodPressureMeasurement");
  const issues = validateInstanceAgainstSchema(instanceText, "json", schema, schemaText);
  assert(
    issues.some((i) => i.path.includes("diastolic") && /minimum|>=|below|less than/i.test(i.message)),
    `expected diastolic minimum issue, got: ${JSON.stringify(issues)}`,
  );
  assert(
    issues.some((i) =>
      i.path.includes("bodyPosition") && /enum|allowed|one of|any of/i.test(i.message)
    ),
    `expected bodyPosition enum issue, got: ${JSON.stringify(issues)}`,
  );
});

Deno.test("validateInstanceAgainstSchema accepts valid BP instance against JSON Schema", async () => {
  const schemaText = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "legacy-simulated", "bp-sche.json"),
  );
  const instanceText = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "legacy-simulated", "bp-inst.json"),
  );
  const schema = loadJsonSchema(schemaText, "BloodPressureMeasurement");
  const issues = validateInstanceAgainstSchema(instanceText, "json", schema, schemaText);
  assertEquals(issues, []);
});

Deno.test("jsonPointerToPath matches Source Pane instance paths", () => {
  assertEquals(jsonPointerToPath("#"), "$");
  assertEquals(jsonPointerToPath("#/diastolic"), "$.diastolic");
  assertEquals(jsonPointerToPath("#/bodyPosition"), "$.bodyPosition");
  assertEquals(jsonPointerToPath("#/items/0"), "$.items[1]");
});
