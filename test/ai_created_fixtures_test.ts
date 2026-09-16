import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { WorkbenchService } from "@intehrgrator/workbench/service.ts";
import { callAgentTool } from "@intehrgrator/agent/tools.ts";
import { LocalAgentClient } from "@intehrgrator/agent/mcp_stdio.ts";

const fixtures = join(import.meta.dirname!, "fixtures");

Deno.test("committed AI-created dummy JSON mapping re-imports and Test Run passes", async () => {
  const dir = join(fixtures, "dummy-json-vitals");
  const service = new WorkbenchService();
  const client = new LocalAgentClient(service);
  await client.registerAgent({ displayName: "AI fixture replay" });
  await client.callTool("load_target", {
    filename: "target.schema.json",
    content: await Deno.readTextFile(join(dir, "target.schema.json")),
  });
  await client.callTool("add_example", {
    filename: "instance-1.json",
    content: await Deno.readTextFile(join(dir, "instance-1.json")),
  });
  const text = await Deno.readTextFile(
    join(dir, "mapping", "ai-created-json-schema.intehrgrator-suggestions.json"),
  );
  const imported = await client.callTool("import_suggestions", { text }) as {
    report: { applied: number; errors: string[] };
  };
  assertEquals(imported.report.applied, 3, imported.report.errors.join("; "));
  const tested = await client.callTool("run_test", {}) as { testResult: { ok: boolean; error?: string } };
  assertEquals(tested.testResult.ok, true, String(tested.testResult.error));
});

Deno.test("committed AI-created openEHR BP mapping re-imports and Test Run passes", async () => {
  const service = new WorkbenchService();
  await callAgentTool(service, "load_target", {
    filename: "blood_pressure.opt",
    content: await Deno.readTextFile(join(fixtures, "blood_pressure.opt")),
  });
  await callAgentTool(service, "add_example", {
    filename: "instance-1.json",
    content: await Deno.readTextFile(join(fixtures, "dummy-json-vitals", "instance-1.json")),
  });
  const text = await Deno.readTextFile(
    join(fixtures, "dummy-json-vitals", "mapping", "ai-created-openehr-blood-pressure.intehrgrator-suggestions.json"),
  );
  const imported = await callAgentTool(service, "import_suggestions", { text }) as {
    report: { applied: number; errors: string[] };
  };
  assertEquals(imported.report.applied, 2, imported.report.errors.join("; "));
  const tested = await callAgentTool(service, "run_test", {}) as { testResult: { ok: boolean; error?: string } };
  assertEquals(tested.testResult.ok, true, String(tested.testResult.error));
});
