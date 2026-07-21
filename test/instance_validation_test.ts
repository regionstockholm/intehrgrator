import { assertEquals } from "@std/assert";
import { loadJsonSchema } from "@intehrgrator/core/source/schema_loader.ts";
import { validateInstanceAgainstSchema } from "@intehrgrator/core/source/instance_validation.ts";

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
