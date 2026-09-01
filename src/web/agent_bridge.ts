/**
 * Poll desktop Agent API, sync bundle, push UI semantic commits, activity highlights.
 */

import type { WorkbenchController } from "../workbench/controller.ts";
import type { ProjectBundle } from "../types/mod.ts";

export interface AgentBridgeOptions {
  controller: WorkbenchController;
  exportBundle: () => ProjectBundle;
  onActivity?: (activity: AgentActivityPayload | null) => void;
  slotSignature: () => string;
}

export interface AgentActivityPayload {
  agentId: string;
  displayName: string;
  color: string;
  summary: string;
  affectedSlotIds: string[];
}

let lastCommittedSignature = "";

export function isDesktopEnvironment(): boolean {
  return Boolean(
    (globalThis as unknown as { __INTEHR_DESKTOP__?: boolean }).__INTEHR_DESKTOP__,
  );
}

export function installAgentBridge(options: AgentBridgeOptions): void {
  if (typeof globalThis.fetch !== "function") return;
  if (!isDesktopEnvironment()) return;

  const { controller, exportBundle, onActivity, slotSignature } = options;
  let lastRevision = "";
  let syncing = false;
  let lastActivityAt = "";
  let pollTimer: number | null = null;

  const poll = async () => {
    if (syncing) return;
    try {
      const snapRes = await fetch("/api/v1/snapshot");
      if (snapRes.status === 404) {
        if (pollTimer !== null) {
          globalThis.clearInterval(pollTimer);
          pollTimer = null;
        }
        return;
      }
      if (!snapRes.ok) return;
      const snap = await snapRes.json() as { revision: string; templateId?: string };
      const isFirstPoll = !lastRevision;
      const revisionChanged = !isFirstPoll && snap.revision !== lastRevision;
      const agentHasProject = Boolean(snap.templateId);
      const uiEmpty = !controller.getState().templateId;
      const shouldSync = revisionChanged || (isFirstPoll && agentHasProject && uiEmpty);
      if (shouldSync) {
        syncing = true;
        const bundleRes = await fetch("/api/v1/bundle");
        if (bundleRes.ok) {
          const payload = await bundleRes.json() as { revision: string; bundle: ProjectBundle };
          controller.restoreDocumentSnapshot(payload.bundle);
          lastRevision = payload.revision;
          lastCommittedSignature = slotSignature();
        }
        syncing = false;
      } else if (isFirstPoll) {
        lastRevision = snap.revision;
      }

      const actRes = await fetch("/api/v1/activity");
      if (actRes.ok) {
        const { activity } = await actRes.json() as { activity: AgentActivityPayload & { at?: string } | null };
        if (activity && activity.at !== lastActivityAt) {
          lastActivityAt = activity.at ?? "";
          onActivity?.(activity);
        }
      }
    } catch {
      // Agent API not enabled
    } finally {
      syncing = false;
    }
  };

  pollTimer = globalThis.setInterval(() => void poll(), 1500);
}

/** Push semantic UI edit to shared Agent API history. */
export async function commitUiSemanticChange(
  bundle: ProjectBundle,
  summary: string,
  kind: "expression" | "block_graph" = "expression",
): Promise<boolean> {
  if (!isDesktopEnvironment()) return false;
  try {
    const res = await fetch("/api/v1/ui-commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bundle, summary, kind }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function shouldCommitSemanticChange(signature: string): boolean {
  if (signature === lastCommittedSignature) return false;
  lastCommittedSignature = signature;
  return true;
}

export function resetCommittedSignature(signature: string): void {
  lastCommittedSignature = signature;
}
