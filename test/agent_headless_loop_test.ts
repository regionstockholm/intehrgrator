import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { WorkbenchService } from "@intehrgrator/workbench/service.ts";
import { createAgentApiHandler } from "@intehrgrator/agent/http.ts";
import { AGENT_TOOLS, AGENT_TOOL_HTTP, callAgentTool } from "@intehrgrator/agent/tools.ts";
import { handleMcpRequest, LocalAgentClient } from "@intehrgrator/agent/mcp_stdio.ts";
import { collectValueSlots } from "@intehrgrator/core/skeleton/generate_skeleton.ts";

const fixtures = join(import.meta.dirname!, "fixtures");

Deno.test("AGENT_TOOLS and HTTP routes stay 1:1", () => {
  const toolNames = AGENT_TOOLS.map((t) => t.name).sort();
  const httpNames = Object.keys(AGENT_TOOL_HTTP).sort();
  assertEquals(toolNames, httpNames);
});

Deno.test("headless MCP tools: load JSON target → import → run_test → generate_script → export", async () => {
  const service = new WorkbenchService();
  const target = await Deno.readTextFile(join(fixtures, "dummy-json-vitals", "target.schema.json"));
  const schema = await Deno.readTextFile(join(fixtures, "dummy-json-vitals", "source.schema.json"));
  const example = await Deno.readTextFile(join(fixtures, "dummy-json-vitals", "instance-1.json"));

  await callAgentTool(service, "load_target", {
    filename: "target.schema.json",
    content: target,
  });
  await callAgentTool(service, "load_source_schema", {
    filename: "source.schema.json",
    content: schema,
  });
  await callAgentTool(service, "add_example", {
    filename: "instance-1.json",
    content: example,
  });

  const slots = await callAgentTool(service, "list_slots", {}) as {
    slots: Array<{ slotId: string; mapped: boolean }>;
  };
  const systolic = slots.slots.find((s) => s.slotId.includes("systolic"))?.slotId;
  const diastolic = slots.slots.find((s) => s.slotId.includes("diastolic"))?.slotId;
  const unit = slots.slots.find((s) => s.slotId.includes("unit"))?.slotId;
  if (!systolic || !diastolic || !unit) throw new Error(`missing slots: ${slots.slots.map((s) => s.slotId)}`);

  const snap = await callAgentTool(service, "get_snapshot", {}) as {
    revision: string;
    templateId: string;
  };
  const envelope = {
    format: "intehrgrator-suggestions",
    version: "2",
    target: { format: "json-schema", targetId: snap.templateId },
    suggestions: [
      { slotId: systolic, block: { type: "source_query_number", fields: { EXPRESSION: "$.systolic" } } },
      { slotId: diastolic, block: { type: "source_query_number", fields: { EXPRESSION: "$.diastolic" } } },
      { slotId: unit, block: { type: "source_query", fields: { EXPRESSION: "$.unit" } } },
    ],
  };
  const imported = await callAgentTool(service, "import_suggestions", {
    text: JSON.stringify(envelope),
    revision: snap.revision,
  }) as { report: { applied: number; errors: string[] } };
  assertEquals(imported.report.applied, 3, imported.report.errors.join("; "));

  const tested = await callAgentTool(service, "run_test", {}) as {
    testResult: { ok: boolean; output?: unknown; error?: string };
  };
  assertEquals(tested.testResult.ok, true, String(tested.testResult.error));

  const script = await callAgentTool(service, "generate_script", { language: "typescript" }) as {
    code: string;
    language: string;
  };
  assertEquals(script.language, "typescript");
  assertStringIncludes(script.code, "systolic");

  const exported = await callAgentTool(service, "export_bundle", { format: "json" }) as {
    bundle: { target?: { targetId?: string } };
  };
  assertEquals(exported.bundle.target?.targetId, snap.templateId);
});

Deno.test("Agent HTTP load-target, list_slots, lease 409, auth", async () => {
  const service = new WorkbenchService();
  const handler = createAgentApiHandler(service);
  const opt = await Deno.readTextFile(join(fixtures, "blood_pressure.opt"));
  const load = await handler(new Request("http://local/api/v1/load-target", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename: "blood_pressure.opt", content: opt }),
  }));
  assertEquals(load.status, 200);

  const slotsRes = await handler(new Request("http://local/api/v1/slots"));
  assertEquals(slotsRes.status, 200);
  const slotsBody = await slotsRes.json() as { slots: Array<{ slotId: string }> };
  const slotId = slotsBody.slots.find((s) => s.slotId.endsWith("items/at0004/value/value/value"))?.slotId;
  if (!slotId) throw new Error("missing systolic slot");

  await handler(new Request("http://local/api/v1/register-agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentId: "agent-a", displayName: "A" }),
  }));
  await handler(new Request("http://local/api/v1/register-agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentId: "agent-b", displayName: "B" }),
  }));

  const leased = await handler(new Request("http://local/api/v1/lease-slot", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Agent-Id": "agent-a", "X-Agent-Name": "A" },
    body: JSON.stringify({ slotId, ttlSec: 60 }),
  }));
  assertEquals(leased.status, 200);

  const blocked = await handler(new Request("http://local/api/v1/map-slot", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Agent-Id": "agent-b", "X-Agent-Name": "B" },
    body: JSON.stringify({ slotId, path: "$.systolic" }),
  }));
  assertEquals(blocked.status, 409);

  const locked = createAgentApiHandler(new WorkbenchService(), { token: "s3cret" });
  const denied = await locked(new Request("http://local/api/v1/snapshot"));
  assertEquals(denied.status, 401);
  const health = await locked(new Request("http://local/api/v1/health"));
  assertEquals(health.status, 200);
  const ok = await locked(new Request("http://local/api/v1/snapshot", {
    headers: { authorization: "Bearer s3cret" },
  }));
  assertEquals(ok.status, 200);
});

Deno.test("MCP stdio tools/list writes the full JSON-RPC body", async () => {
  const reqBody = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const req = new TextEncoder().encode(`Content-Length: ${reqBody.length}\r\n\r\n${reqBody}`);
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "--no-check", "src/agent/mcp_stdio.ts"],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
    env: { ...Deno.env.toObject(), INTEHR_AGENT_URL: "" },
    cwd: join(import.meta.dirname!, ".."),
  });
  const child = cmd.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(req);
  await writer.close();
  const out = await child.output();
  assertEquals(out.code, 0, new TextDecoder().decode(out.stderr));
  const text = new TextDecoder().decode(out.stdout);
  const split = text.indexOf("\r\n\r\n");
  assertEquals(split >= 0, true, text.slice(0, 80));
  const payload = text.slice(split + 4);
  const msg = JSON.parse(payload) as { result: { tools: Array<{ name: string }> } };
  const names = msg.result.tools.map((t) => t.name);
  assertEquals(names.includes("load_example_set"), true);
  assertEquals(names.includes("lease_slot"), true);
  assertEquals(names.length, AGENT_TOOLS.length);
});

Deno.test("MCP tools/list and tools/call load_target via LocalAgentClient", async () => {
  const service = new WorkbenchService();
  const client = new LocalAgentClient(service);
  const listed = await handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, client) as {
    tools: Array<{ name: string }>;
  };
  assertEquals(listed.tools.some((t) => t.name === "load_target"), true);
  assertEquals(listed.tools.some((t) => t.name === "lease_slot"), true);
  assertEquals(listed.tools.some((t) => t.name === "export_bundle"), true);

  const target = await Deno.readTextFile(join(fixtures, "dummy-json-vitals", "target.schema.json"));
  const called = await handleMcpRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "load_target",
      arguments: { filename: "target.schema.json", content: target },
    },
  }, client) as { content: Array<{ text: string }> };
  const payload = JSON.parse(called.content[0]!.text) as { snapshot: { templateId: string } };
  assertEquals(Boolean(payload.snapshot.templateId), true);
});

Deno.test("loadBundleFile accepts JSON Project Bundle as well as zip", async () => {
  const dir = join(import.meta.dirname!, "fixtures", "dummy-json-vitals");
  const service = new WorkbenchService();
  await callAgentTool(service, "load_target", {
    filename: "target.schema.json",
    content: await Deno.readTextFile(join(dir, "target.schema.json")),
  });
  const json = JSON.stringify(service.exportBundle());
  const other = new WorkbenchService();
  other.loadBundleFile(new TextEncoder().encode(json));
  assertEquals(other.getSnapshot().templateId, service.getSnapshot().templateId);
});

Deno.test("load_bundle accepts unwrapped Project Bundle JSON on HTTP PUT", async () => {
  const service = new WorkbenchService();
  await callAgentTool(service, "load_target", {
    path: join(fixtures, "dummy-json-vitals", "target.schema.json"),
  });
  const bundle = service.exportBundle();
  const other = new WorkbenchService();
  const handler = createAgentApiHandler(other);
  const res = await handler(new Request("http://local/api/v1/bundle", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(bundle),
  }));
  assertEquals(res.status, 200);
  assertEquals(other.getSnapshot().templateId, service.getSnapshot().templateId);
});

Deno.test("load_example_set from local catalogPath hydrates dummy-json-vitals", async () => {
  const service = new WorkbenchService();
  const loaded = await callAgentTool(service, "load_example_set", {
    catalogPath: join(import.meta.dirname!, "..", "examples", "example-sets.json"),
    setId: "dummy-json-vitals",
    includeMapping: false,
  }) as { setId: string; snapshot: { templateId: string; exampleCount: number } };
  assertEquals(loaded.setId, "dummy-json-vitals");
  assertEquals(Boolean(loaded.snapshot.templateId), true);
  assertEquals(loaded.snapshot.exampleCount >= 1, true);
});

Deno.test("list_optional_rm catalog includes container RM attachments", async () => {
  const service = new WorkbenchService();
  await callAgentTool(service, "load_target", {
    path: join(fixtures, "blood_pressure.opt"),
  });
  const listed = await callAgentTool(service, "list_optional_rm", {}) as {
    catalog: Array<{ parentSlotId: string; attachments: Array<{ attributeName: string; rmType: string }> }>;
  };
  assertEquals(listed.catalog.length >= 1, true, "expected Optional RM catalog on OPT containers");
  const first = listed.catalog[0]!;
  const attr = first.attachments[0]!;
  await callAgentTool(service, "optional_rm_add", {
    parentSlotId: first.parentSlotId,
    rmType: attr.rmType,
    attributeName: attr.attributeName,
  });
  const after = await callAgentTool(service, "list_optional_rm", {
    parentSlotId: first.parentSlotId,
  }) as { attachments: Array<{ attributeName: string }> };
  assertEquals(after.attachments.some((row) => row.attributeName === attr.attributeName), false);
});

Deno.test("import_suggestions skips foreign-leased slots", async () => {
  const service = new WorkbenchService();
  const opt = await Deno.readTextFile(join(fixtures, "blood_pressure.opt"));
  service.loadTemplateContent("blood_pressure.opt", opt);
  const slotId = collectValueSlots(service.exportBundle().target?.skeleton ?? []).find((s) =>
    s.slotId.endsWith("items/at0004/value/value/value")
  )?.slotId;
  if (!slotId) throw new Error("missing slot");
  const targetId = service.exportBundle().target?.targetId ?? "";

  const a = service.registerAgent({ agentId: "a", displayName: "A" });
  service.setActor({ kind: "agent", id: a.agentId, displayName: a.displayName, color: a.color });
  service.leaseSlot(slotId, 60);

  const b = service.registerAgent({ agentId: "b", displayName: "B" });
  service.setActor({ kind: "agent", id: b.agentId, displayName: b.displayName, color: b.color });
  const report = service.importSuggestions(JSON.stringify({
    format: "intehrgrator-suggestions",
    version: "2",
    target: { format: "openehr-template", targetId },
    suggestions: [{
      slotId,
      block: { type: "source_query_number", fields: { EXPRESSION: "$.systolic" } },
    }],
  }));
  assertEquals(report.applied, 0);
  assertEquals(report.skipped >= 1, true);
  assertEquals(report.errors.some((e) => e.includes("leased")), true);
});
