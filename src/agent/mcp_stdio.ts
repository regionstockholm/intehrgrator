/**
 * MCP stdio server — proxies to desktop Agent API when INTEHR_AGENT_URL is set,
 * otherwise uses an embedded WorkbenchService (file-based workflow).
 */

import { getSharedWorkbenchService } from "./http.ts";
import { WorkbenchService } from "../workbench/service.ts";

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

interface AgentClient {
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}

class LocalAgentClient implements AgentClient {
  constructor(private readonly service = getSharedWorkbenchService()) {}

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const revision = args.revision as string | undefined;
    switch (name) {
      case "get_snapshot":
        return this.service.getSnapshot();
      case "build_prompt":
        return {
          prompt: this.service.buildAgentPrompt(
            (args.delivery as "inline") ?? "inline",
            (args.scope as "full") ?? "full",
            args.slotId as string | undefined,
          ),
          revision: this.service.getRevision(),
        };
      case "import_suggestions":
        return {
          report: this.service.importSuggestions(String(args.text ?? ""), revision),
          revision: this.service.getRevision(),
        };
      case "run_test":
        return {
          testResult: this.service.runTest(),
          revision: this.service.getRevision(),
        };
      case "map_slot":
        this.service.mapNodeToSlot(
          String(args.slotId),
          String(args.path),
          (args.format as "json") ?? "json",
          revision,
        );
        return { revision: this.service.getRevision() };
      case "undo":
        return { ok: this.service.undo(), revision: this.service.getRevision() };
      case "redo":
        return { ok: this.service.redo(), revision: this.service.getRevision() };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}

class HttpAgentClient implements AgentClient {
  constructor(private readonly baseUrl: string) {}

  private async request(
    method: string,
    path: string,
    body?: unknown,
    revision?: string,
  ): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (revision) headers["If-Match"] = revision;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(json));
    return json;
  }

  callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const revision = args.revision as string | undefined;
    switch (name) {
      case "get_snapshot":
        return this.request("GET", "/api/v1/snapshot");
      case "build_prompt":
        return this.request("POST", "/api/v1/build-prompt", {
          delivery: args.delivery,
          scope: args.scope,
          slotId: args.slotId,
        }, revision);
      case "import_suggestions":
        return this.request("POST", "/api/v1/import-suggestions", String(args.text ?? ""), revision);
      case "run_test":
        return this.request("POST", "/api/v1/run-test", {}, revision);
      case "map_slot":
        return this.request("POST", "/api/v1/map-slot", {
          slotId: args.slotId,
          path: args.path,
          format: args.format,
        }, revision);
      case "undo":
        return this.request("POST", "/api/v1/undo", {}, revision);
      case "redo":
        return this.request("POST", "/api/v1/redo", {}, revision);
      default:
        return Promise.reject(new Error(`Unknown tool: ${name}`));
    }
  }
}

const TOOLS = [
  {
    name: "get_snapshot",
    description: "Project revision, template id, mapped slot counts, test status.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "build_prompt",
    description: "Build Copy AI Prompt markdown (intehrgrator-suggestions response format).",
    inputSchema: {
      type: "object",
      properties: {
        delivery: { enum: ["inline", "attach", "uri"] },
        scope: { enum: ["full", "slot"] },
        slotId: { type: "string" },
      },
    },
  },
  {
    name: "import_suggestions",
    description: "Apply intehrgrator-suggestions JSON envelope.",
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: { text: { type: "string" }, revision: { type: "string" } },
    },
  },
  {
    name: "map_slot",
    description: "Map a source path to a target value slotId.",
    inputSchema: {
      type: "object",
      required: ["slotId", "path"],
      properties: {
        slotId: { type: "string" },
        path: { type: "string" },
        format: { type: "string" },
        revision: { type: "string" },
      },
    },
  },
  {
    name: "run_test",
    description: "Run Conversion Test against the active example.",
    inputSchema: { type: "object", properties: { revision: { type: "string" } } },
  },
  { name: "undo", description: "Undo last agent mutation.", inputSchema: { type: "object", properties: {} } },
  { name: "redo", description: "Redo.", inputSchema: { type: "object", properties: {} } },
];

function createClient(): AgentClient {
  const base = Deno.env.get("INTEHR_AGENT_URL");
  if (base) return new HttpAgentClient(base.replace(/\/$/, ""));
  return new LocalAgentClient(new WorkbenchService());
}

function writeMessage(msg: unknown): void {
  const body = JSON.stringify(msg);
  const header = `Content-Length: ${new TextEncoder().encode(body).length}\r\n\r\n`;
  Deno.stdout.writeSync(new TextEncoder().encode(header + body));
}

async function handleRequest(req: JsonRpcRequest, client: AgentClient): Promise<void> {
  const id = req.id ?? null;
  const reply = (result: unknown) => writeMessage({ jsonrpc: "2.0", id, result });
  const replyError = (message: string) =>
    writeMessage({ jsonrpc: "2.0", id, error: { code: -32000, message } });

  try {
    if (req.method === "initialize") {
      reply({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "intehrgrator", version: "0.3.0" },
      });
      return;
    }
    if (req.method === "notifications/initialized") return;
    if (req.method === "tools/list") {
      reply({ tools: TOOLS });
      return;
    }
    if (req.method === "tools/call") {
      const params = req.params ?? {};
      const name = String(params.name ?? "");
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      const result = await client.callTool(name, args);
      reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      return;
    }
    replyError(`Method not found: ${req.method}`);
  } catch (e) {
    replyError(e instanceof Error ? e.message : String(e));
  }
}

if (import.meta.main) {
  const client = createClient();
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of Deno.stdin.readable) {
    buffer += decoder.decode(chunk);
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) break;
      const header = buffer.slice(0, headerEnd);
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      const len = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + len) break;
      const body = buffer.slice(bodyStart, bodyStart + len);
      buffer = buffer.slice(bodyStart + len);
      await handleRequest(JSON.parse(body) as JsonRpcRequest, client);
    }
  }
}
