import { assertEquals } from "@std/assert";
import { AGENT_TOKEN_HEADER, agentApiUnauthorized, agentTokenFromRequest } from "@intehrgrator/agent/auth.ts";

Deno.test("agentTokenFromRequest reads Bearer and custom header", () => {
  const bearer = new Request("http://127.0.0.1/api/v1/snapshot", {
    headers: { authorization: "Bearer s3cret" },
  });
  assertEquals(agentTokenFromRequest(bearer), "s3cret");
  const custom = new Request("http://127.0.0.1/api/v1/snapshot", {
    headers: { [AGENT_TOKEN_HEADER]: "abc" },
  });
  assertEquals(agentTokenFromRequest(custom), "abc");
});

Deno.test("agentApiUnauthorized allows health and matching token", () => {
  const health = new Request("http://127.0.0.1/api/v1/health");
  assertEquals(agentApiUnauthorized(health, "tok"), null);
  const ok = new Request("http://127.0.0.1/api/v1/snapshot", {
    headers: { authorization: "Bearer tok" },
  });
  assertEquals(agentApiUnauthorized(ok, "tok"), null);
  const denied = agentApiUnauthorized(new Request("http://127.0.0.1/api/v1/snapshot"), "tok");
  assertEquals(denied?.status, 401);
  assertEquals(agentApiUnauthorized(new Request("http://127.0.0.1/api/v1/snapshot"), undefined), null);
});

Deno.test("Agent API ai-chat-completions rejects a body without endpoint", async () => {
  const { createAgentApiHandler } = await import("@intehrgrator/agent/http.ts");
  const { WorkbenchService } = await import("@intehrgrator/workbench/service.ts");
  const handler = createAgentApiHandler(new WorkbenchService());
  const res = await handler(
    new Request("http://127.0.0.1/api/v1/ai-chat-completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  assertEquals(res.status, 400);
});
