import { assertEquals, assertRejects } from "@std/assert";
import { importSuggestions } from "@intehrgrator/core/ai/mod.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import {
  exportBundle,
  importBundle,
  BUNDLE_VERSION,
} from "@intehrgrator/core/persistence/mod.ts";
import type { ProjectBundle } from "@intehrgrator/types/mod.ts";
import { DEFAULT_SETTINGS } from "@intehrgrator/types/mod.ts";

Deno.test("AI import validates templateId", () => {
  const model = createEmptyModel("expected");
  assertRejects(async () => {
    importSuggestions(model, {
      format: "intehrgrator-suggestions",
      version: "1",
      templateId: "other",
      suggestions: [],
    }, new Set(["s1"]));
  });
});

Deno.test("AI import applies valid suggestion", () => {
  const model = createEmptyModel("t1");
  const { model: next, report } = importSuggestions(model, {
    format: "intehrgrator-suggestions",
    version: "1",
    templateId: "t1",
    suggestions: [{ slotId: "s1", expression: 'xpathNumber("/x")' }],
  }, new Set(["s1"]));
  assertEquals(report.applied, 1);
  assertEquals(next.slots[0].expression, 'xpathNumber("/x")');
});

Deno.test("project bundle round-trip", () => {
  const bundle: ProjectBundle = {
    version: BUNDLE_VERSION,
    projectId: "p1",
    appVersion: "0.1.0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    template: null,
    sourceSchema: null,
    examples: [],
    activeExampleId: null,
    mapping: { blocklyState: null, model: createEmptyModel("t1") },
    settings: DEFAULT_SETTINGS,
  };
  const restored = importBundle(exportBundle(bundle));
  assertEquals(restored.projectId, "p1");
});
