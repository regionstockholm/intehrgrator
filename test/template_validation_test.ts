import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";
import { validateConvertedOutput } from "@intehrgrator/core/output/template_validation.ts";
import { getTargetFormatHandler } from "@intehrgrator/core/target/mod.ts";
import { generateSkeleton } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { WorkbenchController } from "@intehrgrator/workbench/controller.ts";
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

const bpOptPath = join(import.meta.dirname!, "fixtures", "blood_pressure.opt");

Deno.test("validateConvertedOutput deserializes preview JSON and reports template errors", async () => {
  const opt = await Deno.readTextFile(bpOptPath);
  const { skeleton } = generateSkeleton(opt);
  const target = {
    format: "openehr-template" as const,
    filename: "blood_pressure.opt",
    targetId: "openEHR-EHR-COMPOSITION.sample_encounter.v1",
    content: opt,
    skeleton,
  };
  const output = getTargetFormatHandler("openehr-template").render({
    definition: target,
    slotValues: {},
  });
  const validation = validateConvertedOutput(output, target, { deserializeMode: "hybrid" });
  assert(validation.applicable);
  assertEquals(validation.valid, false);
  assert(
    validation.messages.length > 1,
    `expected multiple validation messages, got: ${
      validation.messages.map((m) => m.message).join("; ")
    }`,
  );
  assert(
    !validation.messages.some((m) => m.message.includes("canonical deserializer")),
    "hybrid mode should not surface canonical deserializer strict-mode errors",
  );
});

Deno.test("canonical strict mode differs from hybrid for preview JSON", async () => {
  const opt = await Deno.readTextFile(bpOptPath);
  const { skeleton } = generateSkeleton(opt);
  const target = {
    format: "openehr-template" as const,
    filename: "blood_pressure.opt",
    targetId: "openEHR-EHR-COMPOSITION.sample_encounter.v1",
    content: opt,
    skeleton,
  };
  const output = getTargetFormatHandler("openehr-template").render({
    definition: target,
    slotValues: {},
  });
  const hybrid = validateConvertedOutput(output, target, { deserializeMode: "hybrid" });
  const strict = validateConvertedOutput(output, target, { deserializeMode: "canonical-strict" });
  assert(hybrid.applicable && strict.applicable);
  assertEquals(hybrid.valid, false);
  assertEquals(strict.valid, false);
  assert(hybrid.messages.length > 1, "hybrid should reach template validator");
});

Deno.test("runTest preview on BP target with legacy JSON instance collects output validation", async () => {
  const opt = await Deno.readTextFile(bpOptPath);
  const example = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "legacy-simulated-json", "instances", "bp-inst.json"),
  );
  const model = createEmptyModel("openEHR-EHR-COMPOSITION.sample_encounter.v1");
  const { skeleton } = generateSkeleton(opt);
  const target = {
    format: "openehr-template" as const,
    filename: "blood_pressure.opt",
    targetId: "openEHR-EHR-COMPOSITION.sample_encounter.v1",
    content: opt,
    skeleton,
  };
  const result = runTest(model, example, "json", {
    target,
    outputMode: "preview",
    openEhrJsonDeserializeMode: "hybrid",
  });
  assert(result.outputValidation?.applicable);
  assertEquals(result.outputValidation?.valid, false);
  assert(
    (result.outputValidation?.messages.length ?? 0) > 1,
    "expected multiple template constraint messages for an unmapped BP conversion",
  );
});

Deno.test("runAllTests validates every loaded example for autoplay", async () => {
  const opt = await Deno.readTextFile(bpOptPath);
  const inst1 = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "legacy-simulated-json", "instances", "bp-inst.json"),
  );
  const inst2 = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "legacy-simulated-json", "instances", "bp-inst-3-invalid.json"),
  );
  const controller = new WorkbenchController(stubHost());
  controller.loadTemplateContent("blood_pressure.opt", opt);
  controller.addExampleContent("bp-inst.json", inst1);
  controller.addExampleContent("bp-inst-3-invalid.json", inst2);
  controller.runAllTests();
  const state = controller.getState();
  assertEquals(state.examples.length, 2);
  for (const ex of state.examples) {
    const validation = state.outputValidations[ex.id];
    assert(validation?.applicable, `expected validation for ${ex.filename}`);
    assertEquals(validation?.valid, false);
    assert(
      (validation?.messages.length ?? 0) > 0,
      `expected validation messages for ${ex.filename}`,
    );
  }
});
