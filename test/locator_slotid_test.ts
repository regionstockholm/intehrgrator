/**
 * #127 / #122: colliding siblings get unique openEHR locator slotIds.
 *
 * Seams: `generateSkeleton` slotId uniqueness, `listSlotsInspect` pathLabel.
 */
import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  collectValueSlots,
  generateSkeleton,
  generateSkeletonFromOperational,
  pathLabelFromTrail,
  findSkeletonTrail,
} from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { listSlotsInspect } from "@intehrgrator/agent/inspect.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import type { SkeletonNode } from "@intehrgrator/types/mod.ts";
import { diagnoseLikeOpt } from "./scaffold_issues_test.ts";

function flatten(nodes: SkeletonNode[]): SkeletonNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

function uniqueIds(nodes: SkeletonNode[]): void {
  const ids = nodes.map((n) => n.slotId);
  assertEquals(new Set(ids).size, ids.length, `duplicate slotIds:\n${ids.join("\n")}`);
}

Deno.test("#67 colliding observations use locator predicates, not archetype-id segments", () => {
  const { skeleton } = generateSkeletonFromOperational(diagnoseLikeOpt());
  const observations = flatten(skeleton).filter((n) => n.rmType === "OBSERVATION");
  uniqueIds(observations);
  const colliding = observations.filter((obs) => obs.archetypeNodeId === "at0000");
  assert(colliding.length >= 2);
  for (const obs of colliding) {
    assert(obs.slotId.includes("[openEHR-EHR-OBSERVATION."), obs.slotId);
    assertEquals(obs.slotId.includes("/openEHR-EHR-OBSERVATION."), false, obs.slotId);
  }
});

Deno.test("#122 Rate and Temperature on simple-diagnose-and-vitals have distinct slotIds", () => {
  const opt = Deno.readTextFileSync(
    join(
      import.meta.dirname!,
      "..",
      "vendor",
      "openEHR-model-examples",
      "local",
      "theme-packs",
      "simple-diagnose-and-vitals",
      "simple-diagnose-and-vitals.opt",
    ),
  );
  const { skeleton, templateId } = generateSkeleton(opt);
  assertEquals(templateId, "simple-diagnose-and-vitals");
  uniqueIds(flatten(skeleton));
  const values = collectValueSlots(skeleton);
  const rate = values.find((n) => n.label === "Rate" && n.slotId.includes("OBSERVATION.pulse.v2"));
  const temp = values.find((n) => n.label === "Temperature");
  assert(rate, "missing Pulse Rate slot");
  assert(temp, "missing Temperature slot");
  assertEquals(rate.slotId === temp.slotId, false);
  assert(rate.slotId.includes("[openEHR-EHR-OBSERVATION.pulse.v2]"), rate.slotId);
  assert(temp.slotId.includes("[openEHR-EHR-OBSERVATION.body_temperature.v2]"), temp.slotId);
  assertEquals(rate.slotId.includes("/openEHR-EHR-OBSERVATION.pulse.v2/"), false);
});

Deno.test("#127 admin OPT unique-ifies at0003 identifiers and organisation names", () => {
  const opt = Deno.readTextFileSync(
    join(
      import.meta.dirname!,
      "fixtures",
      "administrerad-medicinsk-onkologisk-behandling",
      "target-schema",
      "AdministreradMedicinskOnkologiskBehandlingPerSubstans.1.0.0-alpha.5.sv.en.opt",
    ),
  );
  const { skeleton } = generateSkeleton(opt);
  uniqueIds(flatten(skeleton));
  uniqueIds(collectValueSlots(skeleton));

  const action = flatten(skeleton).find((n) => n.rmType === "ACTION");
  const evaluation = flatten(skeleton).find((n) => n.rmType === "EVALUATION");
  assert(action?.slotId.endsWith("//content[openEHR-EHR-ACTION.medication.v1]"), action?.slotId);
  assert(
    evaluation?.slotId.includes("//content[openEHR-EHR-EVALUATION.reason_for_encounter.v1]"),
    evaluation?.slotId,
  );

  const idents = flatten(skeleton).filter((n) =>
    n.rmType === "ELEMENT" && n.archetypeNodeId === "at0003" && n.slotId.includes("other_context")
  );
  const names = idents.map((n) => n.nameConstraint ?? n.label).sort();
  assert(names.includes("Identifierare"), names.join(","));
  assert(names.includes("Organisationsnummer"), names.join(","));
  assert(
    idents.some((n) => n.slotId.includes("[at0003, 'Organisationsnummer']")),
    idents.map((n) => n.slotId).join("\n"),
  );
  assert(
    idents.some((n) => n.slotId.includes("[at0003, 'Identifierare']")),
    idents.map((n) => n.slotId).join("\n"),
  );

  const orgs = flatten(skeleton).filter((n) =>
    n.rmType === "CLUSTER" && n.archetypeRef?.includes("CLUSTER.organisation")
  );
  const orgNames = orgs.map((n) => n.nameConstraint).filter(Boolean).sort();
  assertEquals(orgNames.includes("Vårdenhet"), true, orgNames.join(","));
  assertEquals(orgNames.includes("Vårdgivare"), true, orgNames.join(","));

  const rows = listSlotsInspect(skeleton, createEmptyModel("t"));
  const identRows = rows.filter((r) => r.slotId.includes("[at0003,"));
  const labels = identRows.map((r) => r.pathLabel).filter(Boolean);
  assertEquals(new Set(labels).size, labels.length, labels.join(" | "));
  assert(
    identRows.some((r) => r.pathLabel?.includes("Organisationsnummer")),
    identRows.map((r) => r.pathLabel).join(" | "),
  );
  const vardenhet = orgs.find((n) => n.nameConstraint === "Vårdenhet");
  const vardgivare = orgs.find((n) => n.nameConstraint === "Vårdgivare");
  assert(vardenhet && vardgivare);
  const veLabel = pathLabelFromTrail(findSkeletonTrail(skeleton, vardenhet.slotId));
  const vgLabel = pathLabelFromTrail(findSkeletonTrail(skeleton, vardgivare.slotId));
  assert(veLabel?.includes("Vårdenhet"), veLabel);
  assert(vgLabel?.includes("Vårdgivare"), vgLabel);
  assertEquals(veLabel === vgLabel, false);
});

Deno.test("unique blood_pressure OPT keeps content/at0000 without a predicate", () => {
  const opt = Deno.readTextFileSync(join(import.meta.dirname!, "fixtures", "blood_pressure.opt"));
  const { skeleton } = generateSkeleton(opt);
  const observation = flatten(skeleton).find((n) => n.rmType === "OBSERVATION");
  assert(observation?.slotId.includes("//content/at0000"), observation?.slotId);
  assertEquals(observation?.slotId.includes("[openEHR-EHR-OBSERVATION"), false);
});
