import { assertEquals, assert } from "@std/assert";
import { join } from "@std/path";
import type { SkeletonNode } from "@intehrgrator/types/mod.ts";
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

Deno.test("skeleton resolves at0004 labels per archetype", () => {
  const { skeleton } = generateSkeleton(fixture);
  const at0004 = skeleton.flatMap(function walk(n): SkeletonNode[] {
    const self = n.archetypeNodeId === "at0004" ? [n] : [];
    return [...self, ...n.children.flatMap((c) => walk(c))];
  });
  assertEquals(at0004.length, 2);
  const labels = at0004.map((n) => n.label).sort();
  assertEquals(labels, ["Manufacturer details", "Systolic"]);
  const archetypes = at0004.map((n) => n.archetypeShortName).sort();
  assertEquals(archetypes, ["sample_blood_pressure", "sample_device"]);
});

Deno.test("skeleton uses template term text for blood pressure nodes", () => {
  const { skeleton } = generateSkeleton(fixture);
  const systolic = skeleton.flatMap(function walk(n): SkeletonNode[] {
    const self = n.label === "Systolic" ? [n] : [];
    return [...self, ...n.children.flatMap((c) => walk(c))];
  })[0];
  assert(systolic, "expected Systolic element node");
  assertEquals(systolic.archetypeNodeId, "at0004");
  assertEquals(systolic.archetypeShortName, "sample_blood_pressure");
});

Deno.test("skeleton generator returns warnings array", () => {
  const { warnings } = generateSkeleton(fixture);
  assert(Array.isArray(warnings));
});

Deno.test("OBSERVATION descendants include rmAttribute on data path", () => {
  const { skeleton } = generateSkeleton(fixture);
  const history = skeleton.flatMap(function walk(n): SkeletonNode[] {
    const self = n.rmType === "HISTORY" ? [n] : [];
    return [...self, ...n.children.flatMap((c) => walk(c))];
  })[0];
  assert(history, "expected HISTORY under observation data");
  assertEquals(history.rmAttribute, "data");
});
