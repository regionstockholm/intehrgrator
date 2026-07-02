import { assertEquals, assert } from "@std/assert";
import { join } from "@std/path";
import { generateSkeleton, collectValueSlots } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { isAutoFixedValueSlot, mandatoryAttributesFor } from "@intehrgrator/core/rm_mandatory.ts";
import { countUnmappedMandatory, createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";

const fixture = await Deno.readTextFile(
  join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
);

Deno.test("OPT skeleton includes template value slots", () => {
  const { templateId, skeleton } = generateSkeleton(fixture);
  assert(templateId.includes("blood_pressure"));
  const slots = collectValueSlots(skeleton);
  assert(slots.length > 0);
});

Deno.test("collectValueSlots excludes auto-fixed LOCATABLE attrs", () => {
  const { skeleton } = generateSkeleton(fixture);
  const slots = collectValueSlots(skeleton);
  assertEquals(
    slots.some((s) => s.label === "archetype_node_id" || s.label === "name"),
    false,
  );
  const autoFixed = skeleton.flatMap(function walk(n): typeof skeleton {
    const kids = n.children.flatMap((c) => walk(c));
    return n.kind === "value" && isAutoFixedValueSlot(n) ? [n] : kids;
  });
  assert(autoFixed.length > 0, "fixture should still generate silent-mandatory nodes in tree");
});

Deno.test("unmapped mandatory count ignores auto-fixed LOCATABLE attrs", () => {
  const { skeleton } = generateSkeleton(fixture);
  const model = createEmptyModel("t");
  const count = countUnmappedMandatory(model, skeleton);
  const mappableMandatory = collectValueSlots(skeleton).filter((s) => s.mandatory).length;
  assertEquals(count, mappableMandatory);
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
