/**
 * Headless workbench operations for IDE agents and MCP — Blockly JSON / Mapping Model,
 * not DOM. Wraps WorkbenchController with a stub host and service-level undo + revision.
 */

import type { AiArtifactDelivery } from "../core/ai/mod.ts";
import type { HostAdapter } from "../host/mod.ts";
import type {
  ImportSuggestionsReport,
  ProjectBundle,
  SourceFormatId,
  TestResult,
} from "../types/mod.ts";
import { bundleRevision } from "../agent/revision.ts";
import type { AgentSnapshot } from "../agent/types.ts";
import { importBundle } from "../core/persistence/mod.ts";
import { WorkbenchController } from "./controller.ts";
import { syncModelToBlocklyState } from "./blockly_sync.ts";

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

export class WorkbenchService {
  private readonly controller = new WorkbenchController(stubHost());
  private undoStack: ProjectBundle[] = [];
  private redoStack: ProjectBundle[] = [];
  private revision = "r0";

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
    };
  }

  loadBundle(bundle: ProjectBundle, options?: { recordUndo?: boolean }): void {
    this.withUndo(options?.recordUndo !== false, () => {
      this.controller.restoreDocumentSnapshot(structuredClone(bundle));
      this.syncBlocklyFromModel();
      this.bumpRevision();
    });
  }

  loadBundleFile(bytes: Uint8Array): void {
    this.loadBundle(importBundle(bytes));
  }

  loadTemplateContent(filename: string, content: string): void {
    this.withUndo(() => {
      this.controller.loadTemplateContent(filename, content);
      this.syncBlocklyFromModel();
      this.bumpRevision();
    });
  }

  loadSchemaContent(filename: string, content: string): void {
    this.withUndo(() => {
      this.controller.loadSchemaContent(filename, content);
      this.bumpRevision();
    });
  }

  addExampleContent(filename: string, content: string): void {
    this.withUndo(() => {
      this.controller.addExampleContent(filename, content);
      this.bumpRevision();
    });
  }

  buildAgentPrompt(
    delivery: AiArtifactDelivery = "inline",
    scope: "full" | "slot" = "full",
    slotId?: string,
  ): string {
    return this.controller.buildAiPromptText(delivery, scope, slotId);
  }

  importSuggestions(text: string, expectedRevision?: string): ImportSuggestionsReport {
    this.assertRevision(expectedRevision);
    let report!: ImportSuggestionsReport;
    this.withUndo(() => {
      report = this.controller.importAiSuggestions(text);
      this.syncBlocklyFromModel();
      this.bumpRevision();
    });
    return report;
  }

  mapNodeToSlot(
    slotId: string,
    path: string,
    format: SourceFormatId = "json",
    expectedRevision?: string,
  ): void {
    this.assertRevision(expectedRevision);
    this.withUndo(() => {
      this.controller.mapNodeToSlot(slotId, path, format);
      this.syncBlocklyFromModel();
      this.bumpRevision();
    });
  }

  loadBlocklyState(blocklyState: unknown, expectedRevision?: string): void {
    this.assertRevision(expectedRevision);
    this.withUndo(() => {
      this.controller.loadBlocklyDefinition("agent.blockly.json", JSON.stringify(blocklyState));
      this.bumpRevision();
    });
  }

  addOptionalRm(parentSlotId: string, rmType: string, attributeName: string, expectedRevision?: string): void {
    this.assertRevision(expectedRevision);
    this.withUndo(() => {
      this.controller.addOptionalRm(parentSlotId, rmType, attributeName);
      this.syncBlocklyFromModel();
      this.bumpRevision();
    });
  }

  removeOptionalRm(parentSlotId: string, attributeName: string, expectedRevision?: string): void {
    this.assertRevision(expectedRevision);
    this.withUndo(() => {
      this.controller.removeOptionalRm(parentSlotId, attributeName);
      this.syncBlocklyFromModel();
      this.bumpRevision();
    });
  }

  runTest(): TestResult {
    this.controller.runTestNow();
    return this.controller.getState().testResult ?? { ok: false, error: "No test result", warnings: [] };
  }

  undo(): boolean {
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.redoStack.push(this.exportBundle());
    this.controller.restoreDocumentSnapshot(structuredClone(prev));
    this.bumpRevision();
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.exportBundle());
    this.controller.restoreDocumentSnapshot(structuredClone(next));
    this.bumpRevision();
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
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

  private withUndo(recordOrFn: boolean | (() => void), maybeFn?: () => void): void {
    const record = typeof recordOrFn === "function" ? true : recordOrFn;
    const fn = typeof recordOrFn === "function" ? recordOrFn : maybeFn!;
    const before = record ? this.exportBundle() : null;
    fn();
    if (record && before) {
      const after = this.exportBundle();
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        this.undoStack.push(before);
        this.redoStack = [];
      }
    }
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
