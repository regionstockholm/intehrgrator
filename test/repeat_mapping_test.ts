import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  applyExpressionEdit,
  createEmptyModel,
  promoteIndexedSourcePath,
  relativePathFromLoop,
  upsertLoop,
} from "@intehrgrator/core/mapping_model/mod.ts";
import {
  collectValueSlots,
  findSkeletonTrail,
  nearestRepeatingContainer,
} from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { getTargetFormatHandler } from "@intehrgrator/core/target/mod.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";

Deno.test("promoteIndexedSourcePath rewrites the first array index to [*]", () => {
  assertEquals(promoteIndexedSourcePath("$.measurements[1].pulse"), {
    loopPath: "$.measurements",
    mappedPath: "$.measurements[*].pulse",
    varName: "measurements",
  });
  assertEquals(promoteIndexedSourcePath("$.diagnosis.display"), null);
});

Deno.test("relativePathFromLoop strips the repeating array prefix", () => {
  assertEquals(relativePathFromLoop("$.measurements[*].pulse", "$.measurements"), "pulse");
  assertEquals(relativePathFromLoop("$.measurements[*].timestamp", "$.measurements"), "timestamp");
  assertEquals(relativePathFromLoop("$.measurements[*]", "$.measurements"), ".");
});

Deno.test("Test Run expands repeating EVENT from relative loop paths", async () => {
  const { target, rate, time, eventSlotId } = await loadPulseTarget();
  const instance = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures/legacy-simulated-json/instances-series/bp-series-inst.json"),
  );

  let model = createEmptyModel(target.targetId);
  model.targetFormat = "openehr-template";
  model = upsertLoop(model, {
    attachSlotId: eventSlotId,
    varName: "measurements",
    path: "$.measurements",
  });
  model = applyExpressionEdit(model, rate.slotId, 'xpathNumber("pulse")', {
    rmType: "DV_QUANTITY",
    returnType: "number",
    label: "Rate",
  });
  model = applyExpressionEdit(model, time.slotId, 'xpathString("timestamp")', {
    rmType: time.rmType,
    returnType: "string",
    label: "Time",
  });

  const result = runTest(model, instance, "json", { target });
  assertEquals(result.ok, true, (result.warnings ?? []).join("; "));
  const events = findPulseEvents(result.output);
  assertEquals(events.length, 3);
  const magnitudes = events.map((e) => {
    const items = e.data?.items ?? [];
    const rateItem = items.find((item) =>
      (item as { name?: { value?: string } }).name?.value === "Rate" ||
      (item as { archetype_node_id?: string }).archetype_node_id === "at0004"
    );
    return rateItem?.value?.magnitude;
  });
  assertEquals(magnitudes, [72, 76, undefined]);
  assertEquals(
    events.map((e) => (e as { time?: { value?: string } }).time?.value),
    ["2026-07-02T08:30:00Z", "2026-07-02T14:15:00Z", "2026-07-03T07:45:00Z"],
  );
});

Deno.test("second BP series instance expands four pulse events from a loop", async () => {
  const { target, rate, time, eventSlotId } = await loadPulseTarget();
  const instance = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures/legacy-simulated-json/instances-series/bp-series-inst-2.json"),
  );
  let model = createEmptyModel(target.targetId);
  model.targetFormat = "openehr-template";
  model = upsertLoop(model, {
    attachSlotId: eventSlotId,
    varName: "measurements",
    path: "$.measurements",
  });
  model = applyExpressionEdit(model, rate.slotId, 'xpathNumber("pulse")', {
    rmType: "DV_QUANTITY",
    returnType: "number",
    label: "Rate",
  });
  model = applyExpressionEdit(model, time.slotId, 'xpathString("timestamp")', {
    rmType: time.rmType,
    returnType: "string",
    label: "Time",
  });
  const result = runTest(model, instance, "json", { target });
  assertEquals(result.ok, true, (result.warnings ?? []).join("; "));
  const events = findPulseEvents(result.output);
  assertEquals(events.length, 4);
  assertEquals(events.map((e) => {
    const items = e.data?.items ?? [];
    const rateItem = items.find((item) =>
      item.archetype_node_id === "at0004" || item.name?.value === "Rate"
    );
    return rateItem?.value?.magnitude;
  }), [71, 68, 64, undefined]);
});

Deno.test("Test Run still expands repeating EVENT from [*] source paths", async () => {
  const { target, rate, time } = await loadPulseTarget();
  const instance = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures/legacy-simulated-json/instances-series/bp-series-inst.json"),
  );
  let model = createEmptyModel(target.targetId);
  model.targetFormat = "openehr-template";
  model = applyExpressionEdit(model, rate.slotId, 'xpathNumber("$.measurements[*].pulse")', {
    rmType: "DV_QUANTITY",
    returnType: "number",
    label: "Rate",
  });
  model = applyExpressionEdit(model, time.slotId, 'xpathString("$.measurements[*].timestamp")', {
    rmType: time.rmType,
    returnType: "string",
    label: "Time",
  });
  const result = runTest(model, instance, "json", { target });
  assertEquals(result.ok, true, (result.warnings ?? []).join("; "));
  assertEquals(findPulseEvents(result.output).length, 3);
});

async function loadPulseTarget() {
  const wt = await Deno.readTextFile(
    join(
      import.meta.dirname!,
      "../vendor/openEHR-model-examples/local/theme-packs/sport-event-details/templates/Accident report including vital signs.wt.json",
    ),
  );
  const target = getTargetFormatHandler("openehr-template").load(
    "Accident report including vital signs.wt.json",
    wt,
  );
  const rate = collectValueSlots(target.skeleton).find((s) =>
    s.slotId.includes("OBSERVATION.pulse.v2") &&
    s.slotId.includes("items/at0004/") &&
    s.rmType === "DV_QUANTITY"
  );
  if (!rate) throw new Error("expected pulse Rate value slot");
  const time = collectValueSlots(target.skeleton).find((s) =>
    s.slotId.includes("OBSERVATION.pulse.v2") &&
    s.slotId.includes("events/at0003/time/") &&
    s.kind === "value"
  );
  if (!time) throw new Error("expected pulse event time slot");
  const eventSlotId = nearestRepeatingContainer(findSkeletonTrail(target.skeleton, rate.slotId))
    ?.slotId;
  if (!eventSlotId) throw new Error("expected repeating pulse EVENT");
  return { target, rate, time, eventSlotId };
}

function findPulseEvents(node: unknown): Array<{
  data?: { items?: Array<{ value?: { magnitude?: number } }> };
  time?: { value?: string };
}> {
  if (!node || typeof node !== "object") return [];
  const rec = node as Record<string, unknown>;
  if (rec.archetype_node_id === "openEHR-EHR-OBSERVATION.pulse.v2") {
    const data = rec.data as { events?: unknown } | undefined;
    return Array.isArray(data?.events) ? data.events : [];
  }
  const out: Array<{ data?: { items?: Array<{ value?: { magnitude?: number } }> } }> = [];
  for (const [key, value] of Object.entries(rec)) {
    if (key === "slots") continue;
    if (Array.isArray(value)) {
      for (const item of value) out.push(...findPulseEvents(item));
    } else {
      out.push(...findPulseEvents(value));
    }
  }
  return out;
}
