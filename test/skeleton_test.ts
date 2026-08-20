import { assertEquals, assert } from "@std/assert";
import { join } from "@std/path";
import type { SkeletonNode } from "@intehrgrator/types/mod.ts";
import { generateSkeleton, collectValueSlots } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { isAutoFixedValueSlot, mandatoryAttributesFor } from "@intehrgrator/core/rm_mandatory.ts";
import { rmConstrainedTerminologyId } from "@intehrgrator/core/rm_terminology.ts";
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

function findByAttr(nodes: SkeletonNode[], rmType: string, attr: string): SkeletonNode | undefined {
  for (const node of nodes) {
    if (node.rmType === rmType) {
      const child = node.children.find((c) => c.rmAttribute === attr);
      if (child) return child;
    }
    const nested = findByAttr(node.children, rmType, attr);
    if (nested) return nested;
  }
  return undefined;
}

Deno.test("RM code-set attributes expose their constrained terminology_id", () => {
  assertEquals(rmConstrainedTerminologyId("COMPOSITION", "language"), "ISO_639-1");
  assertEquals(rmConstrainedTerminologyId("COMPOSITION", "territory"), "ISO_3166-1");
  assertEquals(rmConstrainedTerminologyId("OBSERVATION", "language"), "ISO_639-1");
  assertEquals(rmConstrainedTerminologyId("OBSERVATION", "encoding"), "IANA_character-sets");
  assertEquals(rmConstrainedTerminologyId("COMPOSITION", "category"), "openehr");
  assertEquals(rmConstrainedTerminologyId("EVENT_CONTEXT", "setting"), "openehr");
});

Deno.test("skeleton pre-fills RM terminology for language, territory, and encoding", () => {
  const { skeleton } = generateSkeleton(fixture);
  const language = findByAttr(skeleton, "COMPOSITION", "language");
  const territory = findByAttr(skeleton, "COMPOSITION", "territory");
  const encoding = findByAttr(skeleton, "OBSERVATION", "encoding");
  const category = findByAttr(skeleton, "COMPOSITION", "category");
  assertEquals(language?.fixedFields?.terminology_id, "ISO_639-1");
  assertEquals(territory?.fixedFields?.terminology_id, "ISO_3166-1");
  assertEquals(encoding?.fixedFields?.terminology_id, "IANA_character-sets");
  assertEquals(category?.fixedFields?.terminology_id, "openehr");
  assertEquals(category?.fixedFields?.defining_code, "433");
});

Deno.test("skeleton pre-fills COMPOSITION.category from the template code list", () => {
  const persistent = fixture.replace(
    "<code_list>433</code_list>",
    "<code_list>431</code_list>",
  );
  const { skeleton } = generateSkeleton(persistent);
  const category = findByAttr(skeleton, "COMPOSITION", "category");
  assertEquals(category?.fixedFields?.defining_code, "431");
  assertEquals(category?.fixedFields?.code_string, "431");
});

Deno.test("COMPOSITION language and territory are CODE_PHRASE values, not ELEMENT", () => {
  const { skeleton } = generateSkeleton(fixture);
  const language = findByAttr(skeleton, "COMPOSITION", "language");
  const territory = findByAttr(skeleton, "COMPOSITION", "territory");
  const category = findByAttr(skeleton, "COMPOSITION", "category");
  assertEquals(language?.rmType, "CODE_PHRASE");
  assertEquals(language?.kind, "value");
  assertEquals(language?.blockType, "code_phrase");
  assertEquals(language?.children.length, 0);
  assertEquals(territory?.rmType, "CODE_PHRASE");
  assertEquals(territory?.kind, "value");
  assertEquals(territory?.children.length, 0);
  assertEquals(category?.rmType, "DV_CODED_TEXT");
  assertEquals(category?.kind, "value");
});
