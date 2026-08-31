/**
 * HTTP Agent API — JSON over localhost for IDE agents and MCP bridge.
 */

import type { ProjectBundle, SourceFormatId } from "../types/mod.ts";
import {
  AgentRevisionConflictError,
  WorkbenchService,
} from "../workbench/service.ts";

export function createAgentApiHandler(service: WorkbenchService): (req: Request) => Promise<Response> {
  return async (req) => {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/v1/")) {
      return json({ error: "Not found" }, 404);
    }

    const path = url.pathname.slice("/api/v1".length) || "/";
    const revisionHeader = req.headers.get("If-Match") ?? undefined;

    try {
      if (req.method === "GET" && path === "/health") {
        return json({ ok: true, agent: "intehrgrator", version: 1 });
      }
      if (req.method === "GET" && path === "/snapshot") {
        return json(service.getSnapshot());
      }
      if (req.method === "GET" && path === "/bundle") {
        return json({ revision: service.getRevision(), bundle: service.exportBundle() });
      }
      if (req.method === "PUT" && path === "/bundle") {
        const body = await req.json() as { bundle: ProjectBundle; revision?: string };
        assertRevision(service, revisionHeader ?? body.revision);
        service.loadBundle(body.bundle);
        return json({ revision: service.getRevision() });
      }
      if (req.method === "POST" && path === "/import-suggestions") {
        const text = await req.text();
        const report = service.importSuggestions(text, revisionHeader);
        return json({ revision: service.getRevision(), report });
      }
      if (req.method === "POST" && path === "/build-prompt") {
        const body = await req.json().catch(() => ({})) as {
          delivery?: "inline" | "attach" | "uri";
          scope?: "full" | "slot";
          slotId?: string;
        };
        const prompt = service.buildAgentPrompt(body.delivery, body.scope, body.slotId);
        return json({ prompt, revision: service.getRevision() });
      }
      if (req.method === "POST" && path === "/run-test") {
        const result = service.runTest();
        return json({ revision: service.getRevision(), testResult: result });
      }
      if (req.method === "POST" && path === "/map-slot") {
        const body = await req.json() as { slotId: string; path: string; format?: string };
        service.mapNodeToSlot(
          body.slotId,
          body.path,
          (body.format ?? "json") as SourceFormatId,
          revisionHeader,
        );
        return json({ revision: service.getRevision() });
      }
      if (req.method === "PUT" && path === "/blockly") {
        const body = await req.json() as { blocklyState: unknown; revision?: string };
        service.loadBlocklyState(body.blocklyState, revisionHeader ?? body.revision);
        return json({ revision: service.getRevision() });
      }
      if (req.method === "POST" && path === "/optional-rm/add") {
        const body = await req.json() as { parentSlotId: string; rmType: string; attributeName: string };
        service.addOptionalRm(body.parentSlotId, body.rmType, body.attributeName, revisionHeader);
        return json({ revision: service.getRevision() });
      }
      if (req.method === "POST" && path === "/optional-rm/remove") {
        const body = await req.json() as { parentSlotId: string; attributeName: string };
        service.removeOptionalRm(body.parentSlotId, body.attributeName, revisionHeader);
        return json({ revision: service.getRevision() });
      }
      if (req.method === "POST" && path === "/undo") {
        return json({ revision: service.getRevision(), ok: service.undo() });
      }
      if (req.method === "POST" && path === "/redo") {
        return json({ revision: service.getRevision(), ok: service.redo() });
      }
      return json({ error: "Not found" }, 404);
    } catch (err) {
      if (err instanceof AgentRevisionConflictError) {
        return json({
          error: err.message,
          revision: err.currentRevision,
          expectedRevision: err.expectedRevision,
        }, 409);
      }
      const message = err instanceof Error ? err.message : String(err);
      return json({ error: message }, 400);
    }
  };
}

function assertRevision(service: WorkbenchService, expected: string | undefined): void {
  if (expected && expected !== service.getRevision()) {
    throw new AgentRevisionConflictError(service.getRevision(), expected);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

let sharedService: WorkbenchService | null = null;

export function getSharedWorkbenchService(): WorkbenchService {
  if (!sharedService) sharedService = new WorkbenchService();
  return sharedService;
}

export function composeWorkbenchHandler(
  staticHandler: (req: Request) => Promise<Response>,
  enableAgentApi: boolean,
): (req: Request) => Promise<Response> {
  const agentHandler = createAgentApiHandler(getSharedWorkbenchService());
  return async (req) => {
    if (enableAgentApi && new URL(req.url).pathname.startsWith("/api/v1/")) {
      return await agentHandler(req);
    }
    return await staticHandler(req);
  };
}
