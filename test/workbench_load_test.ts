import { assertEquals, assert, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { WorkbenchController } from "@intehrgrator/workbench/controller.ts";
import { collectValueSlots } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import type { HostAdapter } from "@intehrgrator/host/mod.ts";
import type { LoadableProjectEntry, StoredProjectRecord } from "@intehrgrator/core/persistence/mod.ts";

function stubHost(overrides: Partial<HostAdapter> = {}): HostAdapter {
  return {
    pickTextFile: async () => null,
    pickTextFilesFromDirectory: async () => null,
    pickBinaryFile: async () => null,
    downloadText: () => {},
    downloadBytes: () => {},
    copyToClipboard: async () => {},
    readClipboard: async () => "",
    saveAutosave: async () => {},
    saveManualSave: async () => {},
    loadStoredProjectRecord: async () => null as StoredProjectRecord | null,
    listLoadableProjects: async () => [] as LoadableProjectEntry[],
    resolveAppUrl: (path) => path,
    fetchTextUrl: () => Promise.reject(new Error("fetchTextUrl not stubbed")),
    ...overrides,
  };
}

Deno.test("controller loads template/schema/example from content", async () => {
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const schema = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "ui", "bp_source_schema.json"),
  );
  const example = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "ui", "bp_example.json"),
  );

  const controller = new WorkbenchController(stubHost());
  controller.loadTemplateContent("blood_pressure.opt", opt);
  controller.loadSchemaContent("bp_source_schema.json", schema);
  controller.addExampleContent("bp_example.json", example);

  const state = controller.getState();
  assert(state.templateId.includes("blood_pressure"));
  assert(state.schemaTree);
  assertEquals(controller.lookupSourceSchemaType("$.systolic"), "number");
  assertEquals(controller.lookupSourceSchemaType("$.patientId"), "string");
  assertEquals(state.examples.length, 1);
  assertEquals(state.activeExample?.filename, "bp_example.json");

  const slotId = collectValueSlots(state.skeleton).find((s) =>
    s.slotId.endsWith("items/at0004/value/value/value")
  )?.slotId;
  assert(slotId);

  controller.armSlot(slotId);
  controller.bindFromNode("$.systolic", "json");
  controller.runTestNow();

  const after = controller.getState();
  const composition = after.testResult?.output as { _type?: string };
  assertEquals(composition?._type, "COMPOSITION");
  assertEquals("slots" in (composition ?? {}), false, "openEHR Test Run must not include a slots sidecar");
  assertStringIncludes(JSON.stringify(composition), "120");
});

Deno.test("mapNodeToSlot binds without Listening Mode (drag-and-drop path)", async () => {
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const example = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "ui", "bp_example.json"),
  );

  const controller = new WorkbenchController(stubHost());
  controller.loadTemplateContent("blood_pressure.opt", opt);
  controller.addExampleContent("bp_example.json", example);

  const slotId = collectValueSlots(controller.getState().skeleton).find((s) =>
    s.slotId.endsWith("items/at0004/value/value/value")
  )?.slotId;
  assert(slotId);
  assertEquals(controller.getState().listeningSlotId, null);

  controller.mapNodeToSlot(slotId, "$.systolic", "json");
  assertEquals(controller.getState().listeningSlotId, null);

  const mapped = controller.getState().model.slots.find((s) => s.slotId === slotId);
  assert(mapped?.expression.includes("systolic"));

  controller.runTestNow();
  const composition = controller.getState().testResult?.output as { _type?: string };
  assertEquals(composition?._type, "COMPOSITION");
  assertEquals("slots" in (composition ?? {}), false, "openEHR Test Run must not include a slots sidecar");
  assertStringIncludes(JSON.stringify(composition), "120");
});

Deno.test("controller loads JSON Schema target and renders mapped object", () => {
  const controller = new WorkbenchController(stubHost());
  controller.loadTargetContent(
    "summary.json",
    JSON.stringify({
      $id: "patient-summary",
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    }),
  );
  controller.addExampleContent("p.json", JSON.stringify({ patient: { name: "Ada" } }));
  const nameSlot = collectValueSlots(controller.getState().skeleton).find((s) =>
    s.label === "name"
  );
  assert(nameSlot);
  controller.mapNodeToSlot(nameSlot.slotId, "$.patient.name", "json");
  controller.runTestNow();
  assertEquals(controller.getState().testResult?.output, { name: "Ada" });
});

Deno.test("free-form Handlebars target walks source like Kintegrate", () => {
  const controller = new WorkbenchController(stubHost());
  controller.loadTargetContent(
    "note.hbs",
    "{{toUpperCase patient.name}}: {{patient.score}}",
  );
  assertEquals(controller.getState().settings.exportTarget, "handlebars");
  controller.addExampleContent(
    "p.json",
    JSON.stringify({ patient: { name: "Ada", score: 9 } }),
  );
  controller.runTestNow();
  assertEquals(controller.getState().testResult?.output, "ADA: 9");
});

Deno.test("schema drop of JSON Schema document populates the schema tree", async () => {
  const schema = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "ui", "bp_source_schema.json"),
  );
  const controller = new WorkbenchController(stubHost());
  await controller.loadSchemaFromDrop({ name: "bp-sche.json", text: schema });
  const state = controller.getState();
  assertEquals(state.schemaError, null);
  assert(state.schemaTree);
  assertEquals(state.schemaTree.children.some((c) => c.name === "systolic"), true);
  assertStringIncludes(state.statusMessage, "bp-sche.json");
});

Deno.test("invalid example instance still loads and reports JSON Schema value mismatches", async () => {
  const schema = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "legacy-simulated-json", "bp-schema.json"),
  );
  const instance = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "legacy-simulated-json", "instances", "bp-inst-3-invalid.json"),
  );
  const controller = new WorkbenchController(stubHost());
  controller.loadSchemaContent("bp-sche.json", schema);
  controller.addExampleContent("bp-inst-3-invalid.json", instance);

  const state = controller.getState();
  assertEquals(state.examples.length, 1);
  assertEquals(state.activeExample?.filename, "bp-inst-3-invalid.json");
  assert(state.exampleTree, "invalid instance must still load into the example tree");
  assert(
    state.activeExampleValidation.some((i) => i.path.includes("diastolic")),
    JSON.stringify(state.activeExampleValidation),
  );
  assert(
    state.activeExampleValidation.some((i) => i.path.includes("bodyPosition")),
    JSON.stringify(state.activeExampleValidation),
  );
  assertStringIncludes(state.statusMessage, "bp-inst-3-invalid.json");
  assertStringIncludes(state.statusMessage, "schema mismatch");
});

Deno.test("schema drop of truncated JSON reports an error instead of staying silent", async () => {
  const truncated = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "ui", "bp_sche_truncated.json"),
  );
  const controller = new WorkbenchController(stubHost());
  await controller.loadSchemaFromDrop({ name: "bp-sche.json", text: truncated });
  const state = controller.getState();
  assertEquals(state.schemaTree, null);
  assert(state.schemaError, "schema pane needs a visible error, not only the status bar");
  assertStringIncludes(state.schemaError, "bp-sche.json");
  assertStringIncludes(state.schemaError.toLowerCase(), "could not load");
  assertStringIncludes(state.statusMessage, "bp-sche.json");
});

Deno.test("controller loads schema, example, and target from URL via host", async () => {
  const schema = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "ui", "bp_source_schema.json"),
  );
  const example = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "ui", "bp_example.json"),
  );
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const requested: string[] = [];
  const files: Record<string, { name: string; text: string }> = {
    "https://example.test/bp.json": { name: "bp.json", text: schema },
    "https://example.test/inst.json": { name: "inst.json", text: example },
    "https://example.test/bp.opt": { name: "bp.opt", text: opt },
  };
  const controller = new WorkbenchController(stubHost({
    fetchTextUrl: (url) => {
      requested.push(url);
      const file = files[url];
      if (!file) return Promise.reject(new Error(`unexpected url ${url}`));
      return Promise.resolve(file);
    },
  }));

  await controller.loadSchemaFromUrl("https://example.test/bp.json");
  await controller.addExampleFromUrl("https://example.test/inst.json");
  await controller.openTemplateFromUrl("https://example.test/bp.opt");

  assertEquals(requested, [
    "https://example.test/bp.json",
    "https://example.test/inst.json",
    "https://example.test/bp.opt",
  ]);
  const state = controller.getState();
  assertEquals(state.schemaError, null);
  assertEquals(state.schemaFilename, "bp.json");
  assertEquals(state.activeExample?.filename, "inst.json");
  assert(state.templateId.includes("blood_pressure"));
});

Deno.test("controller surfaces fetch failure when loading schema from URL", async () => {
  const controller = new WorkbenchController(stubHost({
    fetchTextUrl: () => Promise.reject(new Error("HTTP 404")),
  }));
  await controller.loadSchemaFromUrl("https://example.test/missing.json").then(
    () => {
      throw new Error("expected loadSchemaFromUrl to throw");
    },
    (err) => {
      assert(err instanceof Error);
      assertStringIncludes(err.message, "404");
    },
  );
  const state = controller.getState();
  assertEquals(state.schemaTree, null);
  assert(state.schemaError);
  assertStringIncludes(state.schemaError, "404");
});

Deno.test("mapNodeToSlot promotes indexed JSON paths onto repeating EVENT slots", async () => {
  const wt = await Deno.readTextFile(
    join(
      import.meta.dirname!,
      "../vendor/openEHR-model-examples/local/theme-packs/sport-event-details/templates/Accident report including vital signs.wt.json",
    ),
  );
  const example = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "legacy-simulated-json", "instances-series", "bp-series-inst.json"),
  );
  const controller = new WorkbenchController(stubHost());
  controller.loadTemplateContent("Accident report including vital signs.wt.json", wt);
  controller.addExampleContent("bp-series-inst.json", example);
  const rate = collectValueSlots(controller.getState().skeleton).find((s) =>
    s.slotId.includes("OBSERVATION.pulse.v2") &&
    s.slotId.includes("items/at0004/") &&
    s.rmType === "DV_QUANTITY"
  );
  assert(rate);
  controller.mapNodeToSlot(rate.slotId, "$.measurements[1].pulse", "json");
  const mapped = controller.getState().model.slots.find((s) => s.slotId === rate.slotId);
  assertEquals(mapped?.expression, 'xpathNumber("pulse")');
  assertEquals(controller.getState().model.loops?.[0]?.path, "$.measurements");
});
