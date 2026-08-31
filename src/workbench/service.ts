/**
 * Headless workbench operations for IDE agents and MCP — Blockly JSON / Mapping Model,
 * not DOM. Wraps WorkbenchController with a stub host, attributed history, and revision.
 */

import type { AiArtifactDelivery } from "../core/ai/mod.ts";
import type { HostAdapter } from "../host/mod.ts";
import type {
  ImportSuggestionsReport,
  ProjectBundle,
  SourceFormatId,
  TestResult,
} from "../types/mod.ts";
import { actorFromHeaders, type HistoryActor, USER_ACTOR } from "../agent/actor.ts";
import { AgentRegistry } from "../agent/registry.ts";
import { bundleRevision } from "../agent/revision.ts";
import type { AgentSnapshot } from "../agent/types.ts";
import { importBundle } from "../core/persistence/mod.ts";
import { WorkbenchController } from "./controller.ts";
import { syncModelToBlocklyState } from "./blockly_sync.ts";
import {
  HistoryLog,
  type HistoryEntry,
  type HistoryKind,
  type RestoreAtResult,
} from "./history.ts";

function stubHost(): HostAdapter {
  return {
    pickTextFile: async () => null,
    pickTextFilesFromDirectory: async () => null,
    pickBinaryFile: async () => null,
    downloadText: () => {},
    downloadBytes: () => {},
    copyToClipboard: async () => {},
    readClipboard: async () => "",
    saveAutosave: async () => {},
    saveManualSave: async () => {},
    loadStoredProjectRecord: async () => null,
    listLoadableProjects: async () => [],
    resolveAppUrl: (path) => path.startsWith("http") ? path : `https://example.test/${path}`,
    fetchTextUrl: () => Promise.reject(new Error("fetchTextUrl not available in WorkbenchService")),
  };
}

export interface MutationContext {
  actor?: HistoryActor;
  summary?: string;
  kind?: HistoryKind;
  affectedSlotIds?: string[];
  recordHistory?: boolean;
}

export class WorkbenchService {
  private readonly controller = new WorkbenchController(stubHost());
  readonly registry = new AgentRegistry();
  readonly history: HistoryLog;
  private revision = "r0";
  private currentActor: HistoryActor = USER_ACTOR;

  constructor(options?: { historyPath?: string }) {
    this.history = new HistoryLog({ persistPath: options?.historyPath });
  }

  getRevision(): string {
    return this.revision;
  }

  exportBundle(): ProjectBundle {
    return this.controller.exportDocumentSnapshot();
  }

  getSnapshot(): AgentSnapshot {
    const s = this.controller.getState();
    return {
      revision: this.revision,
      templateId: s.templateId,
      projectId: s.projectId,
      appliedSlots: s.model.slots.filter((slot) => slot.expression).length,
      loops: s.model.loops?.length ?? 0,
      unmappedMandatory: s.unmappedMandatory,
      statusMessage: s.statusMessage,
      testOk: s.testResult?.ok ?? null,
      activeAgents: this.registry.list().length,
    };
  }

  registerAgent(options?: { agentId?: string; displayName?: string; color?: string }) {
    return this.registry.register(options);
  }

  setActorFromHeaders(headers: Headers): HistoryActor {
    const raw = actorFromHeaders(headers);
    if (raw.kind === "agent") {
      const reg = this.registry.get(raw.id);
      if (reg) {
        this.currentActor = {
          kind: "agent",
          id: reg.agentId,
          displayName: reg.displayName,
          color: reg.color,
        };
        return this.currentActor;
      }
    }
    this.currentActor = raw;
    return raw;
  }

  /** UI pushes a semantic canvas commit into the shared session. */
  commitFromUi(bundle: ProjectBundle, summary: string, kind: HistoryKind = "expression"): string {
    const before = this.exportBundle();
    this.controller.restoreDocumentSnapshot(structuredClone(bundle));
    this.recordMutation(before, {
      actor: USER_ACTOR,
      summary,
      kind,
      recordHistory: true,
    });
    return this.revision;
  }

  loadBundle(bundle: ProjectBundle, ctx?: MutationContext & { expectedRevision?: string }): void {
    this.assertRevision(ctx?.expectedRevision);
    this.mutate(() => {
      this.controller.restoreDocumentSnapshot(structuredClone(bundle));
      this.syncBlocklyFromModel();
    }, { ...ctx, kind: ctx?.kind ?? "load_bundle", summary: ctx?.summary ?? "Load project bundle" });
  }

  loadBundleFile(bytes: Uint8Array, ctx?: MutationContext): void {
    this.loadBundle(importBundle(bytes), ctx);
  }

  loadTemplateContent(filename: string, content: string, ctx?: MutationContext): void {
    this.mutate(() => {
      this.controller.loadTemplateContent(filename, content);
      this.syncBlocklyFromModel();
    }, { ...ctx, kind: "load_bundle", summary: ctx?.summary ?? `Load template ${filename}` });
  }

  loadSchemaContent(filename: string, content: string, ctx?: MutationContext): void {
    this.mutate(() => {
      this.controller.loadSchemaContent(filename, content);
    }, { ...ctx, kind: "load_bundle", summary: ctx?.summary ?? `Load schema ${filename}` });
  }

  addExampleContent(filename: string, content: string, ctx?: MutationContext): void {
    this.mutate(() => {
      this.controller.addExampleContent(filename, content);
    }, { ...ctx, summary: ctx?.summary ?? `Load example ${filename}` });
  }

  buildAgentPrompt(
    delivery: AiArtifactDelivery = "inline",
    scope: "full" | "slot" = "full",
    slotId?: string,
  ): string {
    return this.controller.buildAiPromptText(delivery, scope, slotId);
  }

  importSuggestions(text: string, expectedRevision?: string, ctx?: MutationContext): ImportSuggestionsReport {
    this.assertRevision(expectedRevision);
    let report!: ImportSuggestionsReport;
    this.mutate(() => {
      report = this.controller.importAiSuggestions(text);
      this.syncBlocklyFromModel();
    }, {
      ...ctx,
      kind: "import",
      summary: ctx?.summary ?? "Import AI suggestions",
      affectedSlotIds: ctx?.affectedSlotIds,
    });
    return report;
  }

  mapNodeToSlot(
    slotId: string,
    path: string,
    format: SourceFormatId = "json",
    expectedRevision?: string,
    ctx?: MutationContext,
  ): void {
    this.assertRevision(expectedRevision);
    this.mutate(() => {
      this.controller.mapNodeToSlot(slotId, path, format);
      this.syncBlocklyFromModel();
    }, {
      ...ctx,
      kind: "map_slot",
      summary: ctx?.summary ?? `Map ${path} → ${slotId}`,
      affectedSlotIds: [slotId],
    });
  }

  loadBlocklyState(blocklyState: unknown, expectedRevision?: string, ctx?: MutationContext): void {
    this.assertRevision(expectedRevision);
    this.mutate(() => {
      this.controller.loadBlocklyDefinition("agent.blockly.json", JSON.stringify(blocklyState));
    }, { ...ctx, kind: "block_graph", summary: ctx?.summary ?? "Replace Blockly workspace" });
  }

  addOptionalRm(
    parentSlotId: string,
    rmType: string,
    attributeName: string,
    expectedRevision?: string,
    ctx?: MutationContext,
  ): void {
    this.assertRevision(expectedRevision);
    this.mutate(() => {
      this.controller.addOptionalRm(parentSlotId, rmType, attributeName);
      this.syncBlocklyFromModel();
    }, { ...ctx, kind: "optional_rm", summary: ctx?.summary ?? `Add optional RM ${attributeName}` });
  }

  removeOptionalRm(
    parentSlotId: string,
    attributeName: string,
    expectedRevision?: string,
    ctx?: MutationContext,
  ): void {
    this.assertRevision(expectedRevision);
    this.mutate(() => {
      this.controller.removeOptionalRm(parentSlotId, attributeName);
      this.syncBlocklyFromModel();
    }, { ...ctx, kind: "optional_rm", summary: ctx?.summary ?? `Remove optional RM ${attributeName}` });
  }

  runTest(): TestResult {
    this.controller.runTestNow();
    return this.controller.getState().testResult ?? { ok: false, error: "No test result", warnings: [] };
  }

  listHistory(): HistoryEntry[] {
    return this.history.list();
  }

  getActivity() {
    return this.history.getActivity();
  }

  undo(scope: "global" | "user" | "agent" = "global"): boolean {
    const current = this.exportBundle();
    const prev = scope === "user"
      ? this.history.undoByFilter(current, (e) => e.actor.kind === "user")
      : scope === "agent"
      ? this.history.undoByFilter(current, (e) => e.actor.kind === "agent")
      : this.history.undoGlobal(current);
    if (!prev) return false;
    this.controller.restoreDocumentSnapshot(prev);
    this.bumpRevision();
    return true;
  }

  redo(): boolean {
    const next = this.history.redo();
    if (!next) return false;
    this.controller.restoreDocumentSnapshot(next);
    this.bumpRevision();
    return true;
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  canRedo(): boolean {
    return this.history.canRedo();
  }

  restoreAt(seq: number, mode: "view" | "destructive"): RestoreAtResult & { preview?: ProjectBundle } {
    const result = this.history.restoreAt(seq, mode);
    if (result.ok && mode === "destructive" && result.preview) {
      this.controller.restoreDocumentSnapshot(result.preview);
      this.bumpRevision();
      result.revision = this.revision;
    }
    return result;
  }

  buildPatchPrompt(targetSeq: number): string {
    return this.history.buildPatchPrompt(targetSeq, this.exportBundle());
  }

  private syncBlocklyFromModel(): void {
    const s = this.controller.getState();
    if (!s.blocklyState) return;
    const next = syncModelToBlocklyState(s.blocklyState, s.model);
    this.controller.syncCanvasSnapshot(next);
  }

  private bumpRevision(): void {
    this.revision = bundleRevision(this.exportBundle());
  }

  private mutate(fn: () => void, ctx: MutationContext = {}): void {
    const before = this.exportBundle();
    fn();
    this.recordMutation(before, ctx);
  }

  private recordMutation(before: ProjectBundle, ctx: MutationContext): void {
    const after = this.exportBundle();
    if (ctx.recordHistory !== false) {
      this.history.record(
        before,
        after,
        ctx.actor ?? this.currentActor,
        ctx.kind ?? "expression",
        ctx.summary ?? "Edit mapping",
        ctx.affectedSlotIds ?? [],
      );
    }
    this.bumpRevision();
  }

  private assertRevision(expected: string | undefined): void {
    if (expected && expected !== this.revision) {
      throw new AgentRevisionConflictError(this.revision, expected);
    }
  }
}

export class AgentRevisionConflictError extends Error {
  constructor(
    readonly currentRevision: string,
    readonly expectedRevision: string,
  ) {
    super(`Revision conflict: expected ${expectedRevision}, current ${currentRevision}`);
    this.name = "AgentRevisionConflictError";
  }
}
