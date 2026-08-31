/**
 * Live multi-agent observer — extends Open canvas with activity legend + history timeline.
 */

import {
  buildCanvasSnapshotHtml,
  openWorkspaceSnapshotWindow,
  type WorkspaceSvgLike,
} from "../blockly/workspace_snapshot.ts";
import type { AgentActivityPayload } from "./agent_bridge.ts";

const OBSERVER_WINDOW_NAME = "intehrgrator-agent-observer";

export interface AgentObserverState {
  agents: Array<{ agentId: string; displayName: string; color: string; lastSummary?: string }>;
  lastActivity: AgentActivityPayload | null;
}

interface HistoryRow {
  seq: number;
  revisionAfter: string;
  actor: { kind: string; displayName: string; color?: string };
  kind: string;
  summary: string;
  timestamp: string;
  afterBundle?: unknown;
}

let observerWindow: Window | null = null;
const observerState: AgentObserverState = { agents: [], lastActivity: null };
let timelinePollTimer: number | undefined;
let selectedSeq = 0;

export function updateAgentObserverActivity(activity: AgentActivityPayload | null): void {
  if (!activity) return;
  observerState.lastActivity = activity;
  const existing = observerState.agents.find((a) => a.agentId === activity.agentId);
  if (existing) {
    existing.lastSummary = activity.summary;
  } else {
    observerState.agents.push({
      agentId: activity.agentId,
      displayName: activity.displayName,
      color: activity.color,
      lastSummary: activity.summary,
    });
  }
  renderObserverLegend();
}

export function openAgentObserver(
  workspace: WorkspaceSvgLike,
  options: { title?: string; filenameBase?: string },
): Window | null {
  const popup = openWorkspaceSnapshotWindow(workspace, {
    title: options.title ?? "intEHRgrator — Agent observer",
    filenameBase: options.filenameBase ?? "mapping-observer",
    onBlocked: () => {},
  });
  if (popup) {
    observerWindow = popup;
    popup.name = OBSERVER_WINDOW_NAME;
    globalThis.setTimeout(() => {
      renderObserverLegend();
      installTimelinePanel(popup);
    }, 300);
  }
  return popup;
}

function installTimelinePanel(win: Window): void {
  const doc = win.document;
  if (doc.getElementById("agent-timeline-panel")) return;

  const panel = doc.createElement("aside");
  panel.id = "agent-timeline-panel";
  panel.style.cssText =
    "position:fixed;top:0;left:0;bottom:0;width:300px;background:#fafafa;border-right:1px solid #ccc;padding:12px;overflow:auto;font:13px sans-serif;z-index:9998;box-shadow:2px 0 8px rgba(0,0,0,.06)";
  panel.innerHTML = `
    <div style="font-weight:600;margin-bottom:8px">History timeline</div>
    <p style="color:#555;font-size:12px;margin:0 0 10px">Scrub to preview; rollback truncates later entries. Patch undo returns <code>intehrgrator-suggestions</code> v2 JSON.</p>
    <label style="display:block;margin-bottom:6px;font-size:12px">Seq <span id="timeline-seq-label">—</span></label>
    <input id="timeline-scrubber" type="range" min="0" max="0" value="0" style="width:100%;margin-bottom:10px" disabled />
    <div id="timeline-detail" style="font-size:12px;color:#444;margin-bottom:10px;min-height:48px"></div>
    <div id="timeline-list" style="max-height:220px;overflow:auto;border:1px solid #ddd;border-radius:4px;margin-bottom:10px;background:#fff"></div>
    <button id="timeline-preview-btn" type="button" style="width:100%;margin-bottom:6px;padding:6px" disabled>Preview at seq</button>
    <button id="timeline-rollback-btn" type="button" style="width:100%;margin-bottom:6px;padding:6px" disabled>Rollback here (destructive)</button>
    <button id="timeline-patch-btn" type="button" style="width:100%;margin-bottom:6px;padding:6px" disabled>Copy patch-undo prompt</button>
    <div id="timeline-status" style="font-size:11px;color:#666;margin-top:8px"></div>
  `;
  doc.body.appendChild(panel);
  doc.body.style.marginLeft = "300px";

  const scrubber = doc.getElementById("timeline-scrubber") as HTMLInputElement;
  const previewBtn = doc.getElementById("timeline-preview-btn") as HTMLButtonElement;
  const rollbackBtn = doc.getElementById("timeline-rollback-btn") as HTMLButtonElement;
  const patchBtn = doc.getElementById("timeline-patch-btn") as HTMLButtonElement;

  scrubber.addEventListener("input", () => {
    selectedSeq = Number(scrubber.value);
    renderTimelineDetail(selectedSeq);
  });
  previewBtn.addEventListener("click", () => void previewAtSeq(selectedSeq));
  rollbackBtn.addEventListener("click", () => void destructiveRollback(selectedSeq));
  patchBtn.addEventListener("click", () => void copyPatchPrompt(selectedSeq));

  void refreshTimeline();
  if (timelinePollTimer) globalThis.clearInterval(timelinePollTimer);
  timelinePollTimer = globalThis.setInterval(() => void refreshTimeline(), 3000);
  win.addEventListener("beforeunload", () => {
    if (timelinePollTimer) globalThis.clearInterval(timelinePollTimer);
  });
}

let cachedHistory: HistoryRow[] = [];

async function refreshTimeline(): Promise<void> {
  if (!observerWindow || observerWindow.closed) return;
  try {
    const res = await fetch("/api/v1/history");
    if (!res.ok) return;
    const payload = await res.json() as { entries: HistoryRow[] };
    cachedHistory = payload.entries ?? [];
    renderTimelineList(cachedHistory);
    const scrubber = observerWindow.document.getElementById("timeline-scrubber") as HTMLInputElement | null;
    if (!scrubber) return;
    const maxSeq = cachedHistory.at(-1)?.seq ?? 0;
    scrubber.min = "0";
    scrubber.max = String(maxSeq);
    scrubber.disabled = maxSeq === 0;
    if (selectedSeq === 0 || !cachedHistory.some((e) => e.seq === selectedSeq)) {
      selectedSeq = maxSeq;
    }
    scrubber.value = String(selectedSeq);
    renderTimelineDetail(selectedSeq);
    const hasSelection = selectedSeq > 0;
    const previewBtn = observerWindow.document.getElementById("timeline-preview-btn") as HTMLButtonElement | null;
    const rollbackBtn = observerWindow.document.getElementById("timeline-rollback-btn") as HTMLButtonElement | null;
    const patchBtn = observerWindow.document.getElementById("timeline-patch-btn") as HTMLButtonElement | null;
    if (previewBtn) previewBtn.disabled = !hasSelection;
    if (rollbackBtn) rollbackBtn.disabled = !hasSelection || selectedSeq === maxSeq;
    if (patchBtn) patchBtn.disabled = !hasSelection;
  } catch {
    setTimelineStatus("Agent API unavailable — timeline idle.");
  }
}

function renderTimelineList(entries: HistoryRow[]): void {
  if (!observerWindow || observerWindow.closed) return;
  const list = observerWindow.document.getElementById("timeline-list");
  if (!list) return;
  if (!entries.length) {
    list.innerHTML = '<div style="padding:8px;color:#666">No history yet.</div>';
    return;
  }
  list.innerHTML = entries.map((e) =>
    `<button type="button" data-seq="${e.seq}" style="display:block;width:100%;text-align:left;padding:6px 8px;border:none;border-bottom:1px solid #eee;background:${e.seq === selectedSeq ? "#eef7f5" : "#fff"};cursor:pointer">
      <strong>#${e.seq}</strong> ${escapeHtml(e.actor.displayName)} — ${escapeHtml(e.summary)}
    </button>`
  ).join("");
  for (const btn of list.querySelectorAll("button[data-seq]")) {
    btn.addEventListener("click", () => {
      selectedSeq = Number((btn as HTMLButtonElement).dataset.seq);
      const scrubber = observerWindow?.document.getElementById("timeline-scrubber") as HTMLInputElement | null;
      if (scrubber) scrubber.value = String(selectedSeq);
      renderTimelineDetail(selectedSeq);
      renderTimelineList(cachedHistory);
    });
  }
}

function renderTimelineDetail(seq: number): void {
  if (!observerWindow || observerWindow.closed) return;
  const label = observerWindow.document.getElementById("timeline-seq-label");
  const detail = observerWindow.document.getElementById("timeline-detail");
  const entry = cachedHistory.find((e) => e.seq === seq);
  if (label) label.textContent = seq ? String(seq) : "—";
  if (!detail) return;
  if (!entry) {
    detail.textContent = "Select a history point.";
    return;
  }
  detail.innerHTML =
    `<strong>${escapeHtml(entry.actor.displayName)}</strong> (${escapeHtml(entry.kind)})<br>${escapeHtml(entry.summary)}<br><span style="color:#888">${escapeHtml(entry.timestamp)}</span>`;
}

async function previewAtSeq(seq: number): Promise<void> {
  setTimelineStatus(`Previewing seq ${seq}…`);
  try {
    const res = await fetch(`/api/v1/history/${seq}/preview`);
    if (!res.ok) throw new Error("Preview failed");
    setTimelineStatus(`Preview loaded for seq ${seq} (read-only; main canvas unchanged).`);
  } catch (e) {
    setTimelineStatus(e instanceof Error ? e.message : String(e));
  }
}

async function destructiveRollback(seq: number): Promise<void> {
  const maxSeq = cachedHistory.at(-1)?.seq ?? 0;
  if (seq >= maxSeq) return;
  const discarded = cachedHistory.filter((e) => e.seq > seq);
  const msg = [
    `Rollback to seq ${seq}?`,
    `${discarded.length} later entries will be discarded.`,
    "Download the discarded branch (.intehrgrator) before continuing?",
  ].join("\n\n");
  const saveFirst = globalThis.confirm(msg);
  if (saveFirst) {
    await downloadDiscardedBranch(discarded);
  }
  if (!globalThis.confirm(`Confirm destructive rollback to seq ${seq}?`)) return;
  try {
    const res = await fetch("/api/v1/restore-at", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seq, mode: "destructive" }),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) throw new Error(json.error ?? "Rollback failed");
    setTimelineStatus(`Rolled back to seq ${seq}. Main canvas will sync.`);
    await refreshTimeline();
  } catch (e) {
    setTimelineStatus(e instanceof Error ? e.message : String(e));
  }
}

async function downloadDiscardedBranch(discarded: HistoryRow[]): Promise<void> {
  if (!discarded.length) return;
  const entries = discarded
    .filter((e) => e.afterBundle)
    .map((e) => ({ afterBundle: e.afterBundle }));
  if (!entries.length) {
    setTimelineStatus("No bundle data to export for discarded branch.");
    return;
  }
  try {
    const res = await fetch("/api/v1/export-discarded", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = observerWindow?.document.createElement("a");
    if (!a) return;
    a.href = url;
    a.download = "discarded-branch.intehrgrator";
    a.click();
    URL.revokeObjectURL(url);
    setTimelineStatus("Downloaded discarded branch.");
  } catch (e) {
    setTimelineStatus(e instanceof Error ? e.message : String(e));
  }
}

async function copyPatchPrompt(seq: number): Promise<void> {
  try {
    const res = await fetch("/api/v1/patch-prompt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetSeq: seq }),
    });
    const json = await res.json() as { prompt?: string; error?: string };
    if (!res.ok || !json.prompt) throw new Error(json.error ?? "No prompt");
    await navigator.clipboard.writeText(json.prompt);
    setTimelineStatus(`Patch prompt copied (intehrgrator-suggestions v2). Apply via import_suggestions.`);
  } catch (e) {
    setTimelineStatus(e instanceof Error ? e.message : String(e));
  }
}

function setTimelineStatus(text: string): void {
  if (!observerWindow || observerWindow.closed) return;
  const el = observerWindow.document.getElementById("timeline-status");
  if (el) el.textContent = text;
}

function renderObserverLegend(): void {
  if (!observerWindow || observerWindow.closed) return;
  const doc = observerWindow.document;
  let panel = doc.getElementById("agent-observer-legend");
  if (!panel) {
    panel = doc.createElement("div");
    panel.id = "agent-observer-legend";
    panel.style.cssText =
      "position:fixed;top:8px;right:8px;background:#fff;border:1px solid #ccc;padding:8px 12px;border-radius:6px;font:13px sans-serif;z-index:9999;max-width:240px;box-shadow:0 2px 8px rgba(0,0,0,.12)";
    doc.body.appendChild(panel);
  }
  const lines = observerState.agents.length
    ? observerState.agents.map((a) =>
      `<div style="margin:4px 0"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${a.color};margin-right:6px"></span><strong>${escapeHtml(a.displayName)}</strong>${a.lastSummary ? `<br><span style="color:#555;font-size:12px">${escapeHtml(a.lastSummary)}</span>` : ""}</div>`
    ).join("")
    : '<div style="color:#666">No agents connected yet.</div>';
  panel.innerHTML = `<div style="font-weight:600;margin-bottom:6px">Agents</div>${lines}`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export { buildCanvasSnapshotHtml };
