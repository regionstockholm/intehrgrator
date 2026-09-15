import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { applyExpressionEdit, createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { generate } from "@intehrgrator/core/codegen/mod.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";
import { WorkbenchController } from "@intehrgrator/workbench/controller.ts";
import type { HostAdapter } from "@intehrgrator/host/mod.ts";
import type { LoadableProjectEntry, StoredProjectRecord } from "@intehrgrator/core/persistence/mod.ts";

const kintegrateDir = join(import.meta.dirname!, "fixtures", "kintegrate");

function stubHost(): HostAdapter {
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
  };
}

Deno.test("Handlebars Output mode executes authored template against loaded JSON example", () => {
  const model = createEmptyModel("narrative");
  const result = runTest(
    model,
    JSON.stringify({ given: "Linnaeus", city: "Uppsala" }),
    "json",
    {
      outputMode: "handlebars",
      handlebarsTemplate: "Patient {{given}} ({{city}})",
    },
  );
  assertEquals(result.ok, true);
  assertEquals(result.output, "Patient Linnaeus (Uppsala)");
});

Deno.test("Handlebars Output mode executes generated slot template against loaded JSON example", () => {
  const model = applyExpressionEdit(
    createEmptyModel("narrative"),
    "patient_name",
    'xpathString("$.given")',
    { rmType: "DV_TEXT", returnType: "string", label: "Patient name" },
  );
  const generated = generate(model, "handlebars");
  assertStringIncludes(generated, '{{slot "patient_name"}}');
  const result = runTest(model, JSON.stringify({ given: "Linnaeus" }), "json", {
    outputMode: "handlebars",
    generatedCode: generated,
  });
  assertEquals(result.error, undefined);
  assertEquals(result.ok, true);
  assertEquals(String(result.output).includes("Linnaeus"), true);
});

Deno.test("Handlebars Output mode generates then runs the slot template when generatedCode is omitted", () => {
  const model = applyExpressionEdit(
    createEmptyModel("narrative"),
    "patient_name",
    'xpathString("$.given")',
    { rmType: "DV_TEXT", returnType: "string", label: "Patient name" },
  );
  const result = runTest(model, JSON.stringify({ given: "Linnaeus" }), "json", {
    outputMode: "handlebars",
  });
  assertEquals(result.error, undefined);
  assertEquals(result.ok, true);
  assertEquals(String(result.output).includes("Linnaeus"), true);
});

Deno.test("Handlebars Output mode with empty conversion template errors clearly", () => {
  const model = createEmptyModel("narrative");
  const result = runTest(model, JSON.stringify({ given: "Linnaeus" }), "json", {
    outputMode: "handlebars",
  });
  assertEquals(result.ok, false);
  assertEquals(result.error, "No Handlebars template provided.");
});

Deno.test("Handlebars Output mode processes loaded Kintegrate intro.json via generatedCode seam", async () => {
  const source = await Deno.readTextFile(join(kintegrateDir, "intro.json"));
  const template = await Deno.readTextFile(join(kintegrateDir, "intro_tips.hbs"));
  const model = createEmptyModel("intro");
  const generated = generate(model, "handlebars", { handlebarsTemplate: template });
  const result = runTest(model, source, "json", {
    outputMode: "handlebars",
    generatedCode: generated,
  });
  assertEquals(result.ok, true);
  assertStringIncludes(String(result.output), "Click a checkbox in the tree to select a node");
  assertStringIncludes(
    String(result.output),
    "Generate hierarchical nesting structure showing or iterating over this node",
  );
});

Deno.test("Workbench Handlebars Output mode Run Test processes the Active Example", () => {
  const controller = new WorkbenchController(stubHost());
  controller.addExampleContent(
    "patient.json",
    JSON.stringify({ given: "Linnaeus", city: "Uppsala" }),
  );
  controller.setHandlebarsTemplate("Patient {{given}} ({{city}})");
  controller.setExportTarget("handlebars");
  const state = controller.getState();
  assertEquals(state.settings.exportTarget, "handlebars");
  assertEquals(state.testResult?.ok, true);
  assertEquals(state.testResult?.output, "Patient Linnaeus (Uppsala)");
});

Deno.test("Workbench Handlebars Output mode runs generated slot template against the Active Example", () => {
  const controller = new WorkbenchController(stubHost());
  controller.addExampleContent("patient.json", JSON.stringify({ given: "Linnaeus" }));
  controller.applySlotExpression("patient_name", 'xpathString("$.given")');
  controller.setExportTarget("handlebars");
  const state = controller.getState();
  assertEquals(state.settings.exportTarget, "handlebars");
  assertStringIncludes(state.generatedCode, '{{slot "patient_name"}}');
  assertEquals(state.testResult?.ok, true);
  assertEquals(String(state.testResult?.output).includes("Linnaeus"), true);
});
