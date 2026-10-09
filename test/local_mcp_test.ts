import { assertEquals } from "@std/assert";
import { createAgentApiHandler } from "../src/agent/http.ts";
import { LOCAL_MCP_STOPPED, mcpClientCommand } from "../src/agent/local_mcp.ts";
import { agentPollDisposition } from "../src/web/agent_bridge.ts";
import { WorkbenchService } from "../src/workbench/service.ts";

Deno.test("mcpClientCommand uses --mcp for a compiled binary and deno for a checkout", () => {
  assertEquals(mcpClientCommand("C:\\Apps\\intEHRgrator.exe"), {
    command: "C:\\Apps\\intEHRgrator.exe",
    args: ["--mcp"],
  });
  assertEquals(mcpClientCommand("/usr/local/bin/deno"), {
    command: "/usr/local/bin/deno",
    args: ["run", "-A", "src/agent/mcp_stdio.ts"],
  });
});

Deno.test("agent poll pauses on local MCP stop and stops only on 404", () => {
  assertEquals(agentPollDisposition(200), "sync");
  assertEquals(agentPollDisposition(503), "pause");
  assertEquals(agentPollDisposition(404), "stop");
  assertEquals(agentPollDisposition(500), "pause");
});

Deno.test("local MCP stop blocks agent tools and leaves health and the switch up", async () => {
  const handler = createAgentApiHandler(new WorkbenchService(), {
    token: "s3cret",
    execPath: "/usr/local/bin/deno",
  });
  const headers = { authorization: "Bearer s3cret" };

  const open = await handler(new Request("http://127.0.0.1:8765/api/v1/snapshot", { headers }));
  assertEquals(open.status, 200);

  const status = await handler(new Request("http://127.0.0.1:8765/api/v1/local-mcp", { headers }));
  assertEquals(status.status, 200);
  const body = await status.json();
  assertEquals(body.enabled, true);
  assertEquals(body.agentUrl, "http://127.0.0.1:8765");
  assertEquals(body.token, "s3cret");
  assertEquals(body.mcpJson.mcpServers.intehrgrator.command, "/usr/local/bin/deno");
  assertEquals(body.mcpJson.mcpServers.intehrgrator.args, ["run", "-A", "src/agent/mcp_stdio.ts"]);
  assertEquals(body.mcpJson.mcpServers.intehrgrator.env, {
    INTEHR_AGENT_URL: "http://127.0.0.1:8765",
    INTEHR_AGENT_TOKEN: "s3cret",
  });

  const stopped = await handler(new Request("http://127.0.0.1:8765/api/v1/local-mcp", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ enabled: false }),
  }));
  assertEquals(stopped.status, 200);
  assertEquals((await stopped.json()).enabled, false);

  const blocked = await handler(new Request("http://127.0.0.1:8765/api/v1/snapshot", { headers }));
  assertEquals(blocked.status, 503);
  assertEquals(await blocked.json(), { error: LOCAL_MCP_STOPPED });

  const health = await handler(new Request("http://127.0.0.1:8765/api/v1/health"));
  assertEquals(health.status, 200);

  const started = await handler(new Request("http://127.0.0.1:8765/api/v1/local-mcp", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ enabled: true }),
  }));
  assertEquals(started.status, 200);
  const again = await handler(new Request("http://127.0.0.1:8765/api/v1/snapshot", { headers }));
  assertEquals(again.status, 200);
});
