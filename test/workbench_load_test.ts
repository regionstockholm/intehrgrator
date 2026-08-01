import { assertEquals, assert } from "@std/assert";
import { join } from "@std/path";
import { WorkbenchController } from "@intehrgrator/workbench/controller.ts";
import { collectValueSlots } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import type { HostAdapter } from "@intehrgrator/host/web_adapter.ts";
import type { ProjectBundle } from "@intehrgrator/types/mod.ts";
import type { LoadableProjectEntry, StoredProjectRecord } from "@intehrgrator/core/persistence/mod.ts";

function stubHost(): HostAdapter {
  return {
    pickFile: async () => null,
    readTextFile: async () => "",
    downloadText: () => {},
    downloadBytes: () => {},
    copyToClipboard: async () => {},
    readClipboard: async () => "",
    saveProject: async () => {},
    loadProject: async () => null,
    listProjects: async () => [] as ProjectBundle[],
    saveAutosave: async () => {},
    saveManualSave: async () => {},
    loadStoredProject: async () => null,
    loadStoredProjectRecord: async () => null as StoredProjectRecord | null,
    listLoadableProjects: async () => [] as LoadableProjectEntry[],
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
  const composition = after.testResult?.composition as {
    slots?: Record<string, unknown>;
  };
  assertEquals(composition?.slots?.[slotId], 120);
});
