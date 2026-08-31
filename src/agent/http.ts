/**
 * HTTP Agent API — JSON over localhost for IDE agents and MCP bridge.
 */

import { exportBundle } from "../core/persistence/mod.ts";
import type { ProjectBundle, SourceFormatId } from "../types/mod.ts";
import type { HistoryKind } from "../workbench/history.ts";
import {
  AgentRevisionConflictError,
  WorkbenchService,
} from "../workbench/service.ts";

function actorHeaders(req: Request, service: WorkbenchService): void {
  service.setActorFromHeaders(req.headers);
}

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
        return json({ ok: true, agent: "intehrgrator", version: 2 });
      }
      if (req.method === "GET" && path === "/snapshot") {
        return json(service.getSnapshot());
      }
      if (req.method === "GET" && path === "/bundle") {
        return json({ revision: service.getRevision(), bundle: service.exportBundle() });
      }
      if (req.method === "GET" && path === "/history") {
        return json({ revision: service.getRevision(), entries: service.listHistory() });
      }
      if (req.method === "GET" && path === "/activity") {
        return json({ activity: service.getActivity(), agents: service.registry.list() });
      }
      if (req.method === "GET" && path.startsWith("/history/") && path.endsWith("/preview")) {
        const seq = Number(path.split("/")[2]);
        const preview = service.history.previewAt(seq);
        if (!preview) return json({ error: "Unknown seq" }, 404);
        return json({ seq, bundle: preview });
      }
      if (req.method === "POST" && path === "/register-agent") {
        const body = await req.json().catch(() => ({})) as {
          agentId?: string;
          displayName?: string;
          color?: string;
        };
        const reg = service.registerAgent(body);
        return json({
          agentId: reg.agentId,
          displayName: reg.displayName,
          color: reg.color,
          message: `Registered as ${reg.displayName}. Pass X-Agent-Id and X-Agent-Name on mutations.`,
        });
      }
      if (req.method === "PUT" && path === "/bundle") {
        actorHeaders(req, service);
        const body = await req.json() as { bundle: ProjectBundle; revision?: string };
        assertRevision(service, revisionHeader ?? body.revision);
        service.loadBundle(body.bundle);
        return json({ revision: service.getRevision() });
      }
      if (req.method === "POST" && path === "/ui-commit") {
        const body = await req.json() as {
          bundle: ProjectBundle;
          summary: string;
          kind?: HistoryKind;
        };
        const revision = service.commitFromUi(body.bundle, body.summary, body.kind ?? "expression");
        return json({ revision });
      }
      if (req.method === "POST" && path === "/import-suggestions") {
        actorHeaders(req, service);
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
        actorHeaders(req, service);
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
        actorHeaders(req, service);
        const body = await req.json() as { blocklyState: unknown; revision?: string };
        service.loadBlocklyState(body.blocklyState, revisionHeader ?? body.revision);
        return json({ revision: service.getRevision() });
      }
      if (req.method === "POST" && path === "/optional-rm/add") {
        actorHeaders(req, service);
        const body = await req.json() as { parentSlotId: string; rmType: string; attributeName: string };
        service.addOptionalRm(body.parentSlotId, body.rmType, body.attributeName, revisionHeader);
        return json({ revision: service.getRevision() });
      }
      if (req.method === "POST" && path === "/optional-rm/remove") {
        actorHeaders(req, service);
        const body = await req.json() as { parentSlotId: string; attributeName: string };
        service.removeOptionalRm(body.parentSlotId, body.attributeName, revisionHeader);
        return json({ revision: service.getRevision() });
      }
      if (req.method === "POST" && path === "/undo") {
        const body = await req.json().catch(() => ({})) as { scope?: "global" | "user" | "agent" };
        return json({ revision: service.getRevision(), ok: service.undo(body.scope ?? "global") });
      }
      if (req.method === "POST" && path === "/redo") {
        return json({ revision: service.getRevision(), ok: service.redo() });
      }
      if (req.method === "POST" && path === "/restore-at") {
        const body = await req.json() as { seq: number; mode?: "view" | "destructive" };
        const result = service.restoreAt(body.seq, body.mode ?? "view");
        return json({ ...result, revision: service.getRevision() });
      }
      if (req.method === "POST" && path === "/export-discarded") {
        const body = await req.json() as { entries: Array<{ afterBundle: ProjectBundle }> };
        const bundles = body.entries?.map((e) => e.afterBundle) ?? [];
        if (!bundles.length) return json({ error: "No entries" }, 400);
        const last = bundles[bundles.length - 1]!;
        const bytes = exportBundle(last);
        return new Response(new Uint8Array(bytes), {
          headers: {
            "content-type": "application/zip",
            "content-disposition": 'attachment; filename="discarded-branch.intehrgrator"',
          },
        });
      }
      if (req.method === "POST" && path === "/patch-prompt") {
        const body = await req.json() as { targetSeq: number };
        const prompt = service.buildPatchPrompt(body.targetSeq);
        return json({ prompt, format: "intehrgrator-suggestions-v2" });
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
  if (!sharedService) {
    const historyPath = Deno.env.get("INTEHR_HISTORY_PATH");
    sharedService = new WorkbenchService({ historyPath: historyPath ?? undefined });
  }
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
