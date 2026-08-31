/**
 * Poll desktop Agent API and sync ProjectBundle into the open UI session.
 */

import type { WorkbenchController } from "../workbench/controller.ts";
import type { ProjectBundle } from "../types/mod.ts";

export function installAgentBridge(controller: WorkbenchController): void {
  if (typeof globalThis.fetch !== "function") return;
  const host = globalThis.location?.hostname ?? "";
  if (host !== "127.0.0.1" && host !== "localhost") return;

  let lastRevision = "";
  let syncing = false;

  const poll = async () => {
    if (syncing) return;
    try {
      const snapRes = await fetch("/api/v1/snapshot");
      if (!snapRes.ok) return;
      const snap = await snapRes.json() as { revision: string; templateId?: string };
      const isFirstPoll = !lastRevision;
      const revisionChanged = !isFirstPoll && snap.revision !== lastRevision;
      const agentHasProject = Boolean(snap.templateId);
      const uiEmpty = !controller.getState().templateId;
      const shouldSync = revisionChanged || (isFirstPoll && agentHasProject && uiEmpty);
      if (!shouldSync) {
        if (isFirstPoll) lastRevision = snap.revision;
        return;
      }
      syncing = true;
      const bundleRes = await fetch("/api/v1/bundle");
      if (!bundleRes.ok) return;
      const payload = await bundleRes.json() as { revision: string; bundle: ProjectBundle };
      controller.restoreDocumentSnapshot(payload.bundle);
      lastRevision = payload.revision;
    } catch {
      // Agent API not enabled
    } finally {
      syncing = false;
    }
  };

  globalThis.setInterval(() => void poll(), 1500);
}
