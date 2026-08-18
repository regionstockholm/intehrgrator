import { assertEquals, assert, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { WorkbenchController } from "@intehrgrator/workbench/controller.ts";
import { collectValueSlots } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import type { HostAdapter } from "@intehrgrator/host/mod.ts";
import type { LoadableProjectEntry, StoredProjectRecord } from "@intehrgrator/core/persistence/mod.ts";

function stubHost(): HostAdapter {
  return {
    pickTextFile: async () => null,
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
