/**
 * MCP stdio server — proxies to desktop Agent API when INTEHR_AGENT_URL is set,
 * otherwise uses an embedded WorkbenchService (file-based workflow).
 */

import { getSharedWorkbenchService } from "./http.ts";
import { APP_VERSION } from "../core/persistence/mod.ts";

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

interface AgentClient {
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  registerAgent?(args: Record<string, unknown>): Promise<{ agentId: string; displayName: string; color: string }>;
}

class LocalAgentClient implements AgentClient {
  private session: { agentId: string; displayName: string; color: string } | null = null;

  constructor(private readonly service = getSharedWorkbenchService()) {}

  async registerAgent(args: Record<string, unknown>) {
    const reg = this.service.registerAgent({
      agentId: args.agentId as string | undefined,
      displayName: args.displayName as string | undefined,
      color: args.color as string | undefined,
    });
    this.session = reg;
    return reg;
  }

  private actorArgs(args: Record<string, unknown>): Record<string, unknown> {
    if (!this.session) return args;
    return { ...args, _agentId: this.session.agentId, _agentName: this.session.displayName, _agentColor: this.session.color };
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (name === "register_agent") {
      return await this.registerAgent(args);
    }
    const revision = args.revision as string | undefined;
    const enriched = this.actorArgs(args);
    switch (name) {
      case "get_snapshot":
        return this.service.getSnapshot();
      case "get_history":
        return { revision: this.service.getRevision(), entries: this.service.listHistory() };
      case "get_activity":
        return { activity: this.service.getActivity(), agents: this.service.registry.list() };
      case "build_prompt":
        return {
          prompt: this.service.buildAgentPrompt(
            (args.delivery as "inline") ?? "inline",
            (args.scope as "full") ?? "full",
            args.slotId as string | undefined,
          ),
          revision: this.service.getRevision(),
        };
      case "build_patch_prompt":
        return {
          prompt: this.service.buildPatchPrompt(Number(args.targetSeq)),
          format: "intehrgrator-suggestions-v2",
        };
      case "import_suggestions":
        return {
          report: this.service.importSuggestions(String(args.text ?? ""), revision, {
            actor: this.session ? { kind: "agent", id: this.session.agentId, displayName: this.session.displayName, color: this.session.color } : undefined,
          }),
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
          {
            actor: this.session ? { kind: "agent", id: this.session.agentId, displayName: this.session.displayName, color: this.session.color } : undefined,
          },
        );
        return { revision: this.service.getRevision() };
      case "undo":
        return { ok: this.service.undo((args.scope as "global") ?? "global"), revision: this.service.getRevision() };
      case "redo":
        return { ok: this.service.redo(), revision: this.service.getRevision() };
      case "restore_at":
        return {
          ...this.service.restoreAt(Number(args.seq), (args.mode as "view") ?? "view"),
          revision: this.service.getRevision(),
        };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}

class HttpAgentClient implements AgentClient {
  private session: { agentId: string; displayName: string; color: string } | null = null;

  constructor(private readonly baseUrl: string) {}

  async registerAgent(args: Record<string, unknown>) {
    const json = await this.request("POST", "/api/v1/register-agent", args) as {
      agentId: string;
      displayName: string;
      color: string;
    };
    this.session = json;
    return json;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    revision?: string,
  ): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (revision) headers["If-Match"] = revision;
    if (this.session) {
      headers["X-Agent-Id"] = this.session.agentId;
      headers["X-Agent-Name"] = this.session.displayName;
      headers["X-Agent-Color"] = this.session.color;
    }
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
    if (name === "register_agent") return this.registerAgent(args);
    switch (name) {
      case "get_snapshot":
        return this.request("GET", "/api/v1/snapshot");
      case "get_history":
        return this.request("GET", "/api/v1/history");
      case "get_activity":
        return this.request("GET", "/api/v1/activity");
      case "build_prompt":
        return this.request("POST", "/api/v1/build-prompt", {
          delivery: args.delivery,
          scope: args.scope,
          slotId: args.slotId,
        }, revision);
      case "build_patch_prompt":
        return this.request("POST", "/api/v1/patch-prompt", { targetSeq: args.targetSeq });
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
        return this.request("POST", "/api/v1/undo", { scope: args.scope ?? "global" });
      case "redo":
        return this.request("POST", "/api/v1/redo", {});
      case "restore_at":
        return this.request("POST", "/api/v1/restore-at", { seq: args.seq, mode: args.mode ?? "view" });
      default:
        return Promise.reject(new Error(`Unknown tool: ${name}`));
    }
  }
}

const TOOLS = [
  {
    name: "register_agent",
    description: "Register MCP session; returns agentId, displayName, color for this agent.",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string" },
        displayName: { type: "string" },
        color: { type: "string" },
      },
    },
  },
  {
    name: "get_snapshot",
    description: "Project revision, template id, mapped slot counts, test status.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_history",
    description: "Attributed semantic history timeline.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_activity",
    description: "Latest agent activity highlight + registered agents.",
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
    name: "build_patch_prompt",
    description: "Prompt to produce intehrgrator-suggestions patch undo for history seq.",
    inputSchema: {
      type: "object",
      required: ["targetSeq"],
      properties: { targetSeq: { type: "number" } },
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
  {
    name: "restore_at",
    description: "View or destructive rollback to history seq.",
    inputSchema: {
      type: "object",
      required: ["seq"],
      properties: { seq: { type: "number" }, mode: { enum: ["view", "destructive"] } },
    },
  },
  { name: "undo", description: "Undo (scope: global|user|agent).", inputSchema: { type: "object", properties: { scope: { type: "string" } } } },
  { name: "redo", description: "Redo.", inputSchema: { type: "object", properties: {} } },
];

function createClient(): AgentClient {
  const base = Deno.env.get("INTEHR_AGENT_URL");
  if (base) return new HttpAgentClient(base.replace(/\/$/, ""));
  return new LocalAgentClient(getSharedWorkbenchService());
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
        serverInfo: { name: "intehrgrator", version: APP_VERSION },
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
