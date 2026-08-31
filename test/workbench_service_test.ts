import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { WorkbenchService } from "@intehrgrator/workbench/service.ts";
import { createAgentApiHandler } from "@intehrgrator/agent/http.ts";
import { syncModelToBlocklyState } from "@intehrgrator/workbench/blockly_sync.ts";
import { collectValueSlots } from "@intehrgrator/core/skeleton/generate_skeleton.ts";

Deno.test("WorkbenchService importSuggestions updates revision and blockly JSON", async () => {
  const opt = await Deno.readTextFile(join(import.meta.dirname!, "fixtures", "blood_pressure.opt"));
  const example = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "ui", "bp_example.json"),
  );
  const service = new WorkbenchService();
  service.loadTemplateContent("blood_pressure.opt", opt);
  service.addExampleContent("bp_example.json", example);

  const slotId = collectValueSlots(service.exportBundle().target?.skeleton ?? []).find((s) =>
    s.slotId.endsWith("items/at0004/value/value/value")
  )?.slotId;
  if (!slotId) throw new Error("missing systolic slot");

  const before = service.getRevision();
  const targetId = service.exportBundle().target?.targetId ?? "";
  const report = service.importSuggestions(JSON.stringify({
    format: "intehrgrator-suggestions",
    version: "2",
    target: { format: "openehr-template", targetId },
    suggestions: [{
      slotId,
      block: {
        type: "source_query_number",
        fields: { EXPRESSION: "$.systolic" },
      },
    }],
  }));
  assertEquals(report.applied, 1);
  assertEquals(service.getRevision() !== before, true);
  service.runTest();
  const snap = service.getSnapshot();
  assertEquals(snap.testOk, true);
});

Deno.test("Agent HTTP import-suggestions and undo", async () => {
  const opt = await Deno.readTextFile(join(import.meta.dirname!, "fixtures", "blood_pressure.opt"));
  const service = new WorkbenchService();
  service.loadTemplateContent("blood_pressure.opt", opt);
  const handler = createAgentApiHandler(service);
  const slotId = collectValueSlots(service.exportBundle().target?.skeleton ?? []).find((s) =>
    s.slotId.endsWith("items/at0004/value/value/value")
  )?.slotId;
  if (!slotId) throw new Error("missing slot");
  const targetId = service.exportBundle().target?.targetId ?? "";
  const rev = service.getRevision();

  const importRes = await handler(new Request("http://local/api/v1/import-suggestions", {
    method: "POST",
    headers: { "If-Match": rev, "content-type": "text/plain" },
    body: JSON.stringify({
      format: "intehrgrator-suggestions",
      version: "2",
      target: { format: "openehr-template", targetId },
      suggestions: [{
        slotId,
        block: { type: "source_query_number", fields: { EXPRESSION: "$.systolic" } },
      }],
    }),
  }));
  assertEquals(importRes.status, 200);
  const imported = await importRes.json();
  assertEquals(imported.report.applied, 1);

  const undoRes = await handler(new Request("http://local/api/v1/undo", { method: "POST" }));
  assertEquals(undoRes.status, 200);
  const undone = await undoRes.json();
  assertEquals(undone.ok, true);
});

Deno.test("syncModelToBlocklyState patches expressions without DOM", () => {
  const state = { blocks: { languageVersion: 0, blocks: [] } };
  const synced = syncModelToBlocklyState(state, {
    templateId: "t",
    modelVersion: 1,
    slots: [{ slotId: "s", expression: 'xpathNumber("1")', rmType: "DV_QUANTITY", returnType: "number" }],
    optionalRm: [],
    loops: [],
  });
  assertEquals(typeof synced, "object");
});
