import { assertEquals, assert } from "@std/assert";
import { join } from "@std/path";
import { generateSkeleton, collectValueSlots } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { mandatoryAttributesFor } from "@intehrgrator/core/rm_mandatory.ts";

const fixture = await Deno.readTextFile(
  join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
);

Deno.test("OPT skeleton includes template value slots", () => {
  const { templateId, skeleton } = generateSkeleton(fixture);
  assert(templateId.includes("blood_pressure"));
  const slots = collectValueSlots(skeleton);
  assert(slots.length > 0);
});

Deno.test("silent-mandatory RM attributes for COMPOSITION", () => {
  const attrs = mandatoryAttributesFor("COMPOSITION");
  assertEquals(attrs.includes("language"), true);
  assertEquals(attrs.includes("composer"), true);
});

Deno.test("skeleton generator returns warnings array", () => {
  const { warnings } = generateSkeleton(fixture);
  assert(Array.isArray(warnings));
});
