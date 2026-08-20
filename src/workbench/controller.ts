import type {
  ExportTarget,
  MappingModel,
  ProjectBundle,
  ProjectSettings,
  SchemaTreeNode,
  SkeletonNode,
  SourceFormatId,
  TargetFormatId,
  TestResult,
} from "../types/mod.ts";
import {
  APP_VERSION,
  AUTOSAVE_STORAGE_KEY,
  BUNDLE_VERSION,
  bundleFilename,
  exportBundle,
  formatSaveTime,
  importBundle,
} from "../core/persistence/mod.ts";
import { DEFAULT_SETTINGS } from "../types/mod.ts";
import { collectValueSlots } from "../core/skeleton/generate_skeleton.ts";
import {
  applyExpressionEdit,
  countUnmappedMandatory,
  createEmptyModel,
  validateModel,
} from "../core/mapping_model/mod.ts";
import { generate, getExportTargetAdapter } from "../core/codegen/mod.ts";
import { runTest } from "../core/test_runner/mod.ts";
import {
  canonicalSyncPath,
  detectSourceFormat,
  ExampleInstanceManager,
  findNodeBySyncPath,
  getSourceFormatHandler,
  type InstanceValidationIssue,
  validateInstanceAgainstSchema,
} from "../core/source/mod.ts";
import { buildSourceQueryExpression } from "../core/expression/mod.ts";
import { returnTypeForDv } from "../core/rm_mandatory.ts";
import {
  type AiArtifactDelivery,
  type AiPromptArtifact,
  buildPrompt,
  importSuggestions,
  parseSuggestionsPayload,
} from "../core/ai/mod.ts";
import type { HostAdapter, PickedTextFile } from "../host/mod.ts";
import { getValidAttachments } from "../core/rm_attachment_catalog.ts";
import {
  detectTargetFormat,
  getTargetFormatHandler,
  type TargetDefinition,
} from "../core/target/mod.ts";
import {
  isGitHubClinicalModelUrl,
  loadGitHubClinicalModel,
  type GitHubClinicalModelLoadResult,
} from "../core/clinical_model/github_template.ts";
import { loadGitHubExampleDirectory } from "../core/source/github_examples.ts";
import { projectBlocklyState } from "./mapping_spec/project.ts";
import { isTemplateJson } from "ehrtslib/parser/mod.ts";
import {
  snapshotUrlHistory,
  restoreUrlHistory,
  rememberUrl,
  type UrlHistoryKind,
} from "../host/url_history.ts";

export type WorkbenchListener = () => void;

export const AUTOSAVE_DEBOUNCE_MS = 10_000;

export interface WorkbenchControllerOptions {
  urlStorage?: Storage;
  autosaveDebounceMs?: number;
  githubFetch?: typeof fetch;
}

export class WorkbenchController {
  private listeners = new Set<WorkbenchListener>();
  private readonly urlStorage: Storage | undefined;
  private readonly autosaveDebounceMs: number;
  private readonly githubFetch: typeof fetch | undefined;
  private projectId: string = crypto.randomUUID();
  private templateFilename = "";
  private templateContent = "";
  private templateId = "";
  private skeleton: SkeletonNode[] = [];
  private schemaTree: SchemaTreeNode | null = null;
  private schemaFilename = "";
  private schemaContent = "";
  private schemaFormat: SourceFormatId = "json";
  private schemaError: string | null = null;
  /** Origin URI when schema was loaded from URL (session). */
  private schemaOriginUrl: string | null = null;
  /** Origin URI when target was loaded from URL (session). */
  private targetOriginUrl: string | null = null;
  /** Example id → origin URI when loaded from URL (session). */
  private exampleOriginUrls = new Map<string, string>();
  private target: TargetDefinition | null = null;
  private model: MappingModel = createEmptyModel("");
  private settings: ProjectSettings = { ...DEFAULT_SETTINGS };
  private examples = new ExampleInstanceManager();
  private specText = "";
  private handlebarsTemplate = "";
  private generatedCode = "";
  private testResult: TestResult | null = null;
  private listeningSlotId: string | null = null;
  private treeHighlight: { syncPath: string | null; origin: "schema" | "instance" | null } = {
    syncPath: null,
    origin: null,
  };
  private blocklyState: unknown = null;
  private getBlocklyState: (() => unknown) | null = null;
  private debounceTimer: number | null = null;
  private autosaveTimer: number | null = null;
  private dirty = false;
  private lastAutosaveAt: string | null = null;
  private statusMessage = "Ready";

  constructor(
    private host: HostAdapter,
    options: WorkbenchControllerOptions = {},
  ) {
    this.urlStorage = options.urlStorage;
    this.autosaveDebounceMs = options.autosaveDebounceMs ?? AUTOSAVE_DEBOUNCE_MS;
    this.githubFetch = options.githubFetch;
  }

  setBlocklyStateGetter(fn: () => unknown): void {
    this.getBlocklyState = fn;
  }

  markDirty(): void {
    this.dirty = true;
    this.scheduleAutosave();
    this.notifyChange();
  }

  subscribe(fn: WorkbenchListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notifyChange(): void {
    for (const fn of this.listeners) fn();
  }

  getState() {
    return {
      projectId: this.projectId,
      templateFilename: this.templateFilename,
      templateId: this.templateId,
      skeleton: this.skeleton,
      target: this.target,
      schemaTree: this.schemaTree,
      schemaFilename: this.schemaFilename,
      schemaFormat: this.schemaFormat,
      schemaError: this.schemaError,
      exampleTree: this.buildExampleTree(),
      model: this.model,
      settings: this.settings,
      examples: this.examples.list(),
      activeExample: this.examples.getActive(),
      exampleValidations: this.buildExampleValidations(),
      activeExampleValidation: this.buildActiveExampleValidation(),
      specText: formatBlocklyState(this.getBlocklyState?.() ?? this.blocklyState),
      blocklyState: this.blocklyState,
      handlebarsTemplate: this.handlebarsTemplate,
      generatedCode: this.generatedCode,
      testResult: this.testResult,
      listeningSlotId: this.listeningSlotId,
      treeHighlight: this.treeHighlight,
      statusMessage: this.statusMessage,
      saveStatus: this.getSaveStatus(),
      validationIssues: validateModel(this.model, this.skeleton),
      unmappedMandatory: countUnmappedMandatory(this.model, this.skeleton),
      urlHistory: this.captureUrlHistory(),
    };
  }

  async openTemplate(): Promise<void> {
    const file = await this.host.pickTextFile(
      ".opt,.opt2,.json,.xsd,.xml,.adl,.adls,.hbs,.handlebars,.txt,.md,.html,.csv",
      "target",
    );
    if (!file) return;
    try {
      this.loadTargetContent(file.name, file.text);
    } catch (err) {
      this.statusMessage = `Target load failed: ${err instanceof Error ? err.message : String(err)}`;
      this.notifyChange();
    }
  }

  async openTemplateFromUrl(url: string): Promise<void> {
    try {
      if (isGitHubClinicalModelUrl(url)) {
        const loaded = await this.loadGitHubModel(url);
        this.applyGitHubTarget(loaded);
        this.targetOriginUrl = url;
        this.rememberLoadUrl("target", url);
        return;
      }
      const file = await this.host.fetchTextUrl(url);
      this.loadTargetContent(file.name, file.text);
      this.targetOriginUrl = url;
      this.rememberLoadUrl("target", url);
    } catch (err) {
      this.statusMessage = `Target load failed: ${err instanceof Error ? err.message : String(err)}`;
      this.notifyChange();
      throw err;
    }
  }

  /** Backwards-compatible alias used by the Workbench Test API. */
  loadTemplateContent(filename: string, content: string): void {
    this.loadTargetContent(filename, content);
  }

  /** Load an openEHR Template, JSON Schema, XML Schema, or free-form target. */
  loadTargetContent(
    filename: string,
    content: string,
    format: TargetFormatId = detectTargetFormat(filename, content),
  ): void {
    if (isTemplateJson(content)) {
      throw new Error(
        "Better .t.json templates need a GitHub blob/raw URL so dependent archetypes can be fetched. Use ▾ → From GitHub template…",
      );
    }
    const target = getTargetFormatHandler(format).load(filename, content);
    this.target = target;
    this.templateContent = target.content;
    this.templateFilename = target.filename;
    this.templateId = target.targetId;
    this.skeleton = target.skeleton;
    this.targetOriginUrl = null;
    this.model = createEmptyModel(this.templateId);
    this.model.targetFormat = target.format;
    if (format === "free-form") {
      this.settings.exportTarget = "handlebars";
      this.handlebarsTemplate = content;
    }
    this.blocklyState = null;
    this.refreshDerived();
    this.statusMessage = `Loaded ${format} target ${this.templateId}`;
    this.markDirty();
  }

  async loadSchema(): Promise<void> {
    try {
      const file = await this.host.pickTextFile(
        ".json,.xml,.xsd,application/json,application/xml",
        "schema",
      );
      if (!file) return;
      this.loadSchemaContent(file.name, file.text);
    } catch (err) {
      this.setSchemaError(
        `Schema load failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async loadSchemaFromUrl(url: string): Promise<void> {
    try {
      if (isGitHubClinicalModelUrl(url)) {
        const loaded = await this.loadGitHubModel(url);
        this.applyGitHubSchema(loaded);
        this.schemaOriginUrl = url;
        this.rememberLoadUrl("schema", url);
        if (this.schemaError) throw new Error(this.schemaError);
        return;
      }
      const file = await this.host.fetchTextUrl(url);
      this.loadSchemaContent(file.name, file.text);
      this.schemaOriginUrl = url;
      this.rememberLoadUrl("schema", url);
    } catch (err) {
      this.setSchemaError(
        `Schema load failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
    if (this.schemaError) throw new Error(this.schemaError);
  }

  /** Load Source Schema from in-memory content — used by Workbench Test API and hosts. */
  loadSchemaContent(filename: string, content: string): void {
    this.tryApplySchemaFile(filename, content);
  }

  async loadSchemaFromDrop(file: PickedTextFile): Promise<void> {
    if (!/\.(json|xml|xsd)$/i.test(file.name)) {
      this.setSchemaError("Schema drop: JSON, XML, or XSD files only");
      return;
    }
    this.tryApplySchemaFile(file.name, file.text);
  }

  /** Visible schema-pane error when a drop had no usable File (or the wrong type). */
  reportSchemaDropRejected(message: string): void {
    this.setSchemaError(message);
  }

  async addExample(): Promise<void> {
    const file = await this.host.pickTextFile(".json,.xml", "example");
    if (!file) return;
    this.addExampleContent(file.name, file.text);
  }

  async addExampleFromUrl(url: string): Promise<void> {
    try {
      const file = await this.host.fetchTextUrl(url);
      const id = this.applyExampleFile(file.name, file.text);
      this.exampleOriginUrls.set(id, url);
      this.rememberLoadUrl("example", url);
      this.statusMessage = this.exampleLoadStatus(file.name);
      this.markDirty();
      if (this.settings.autoplay) this.scheduleTestRun();
    } catch (err) {
      this.statusMessage = `Example load failed: ${err instanceof Error ? err.message : String(err)}`;
      this.notifyChange();
      throw err;
    }
  }

  async addExamplesFromLocalDirectory(): Promise<void> {
    const files = await this.host.pickTextFilesFromDirectory(".json,.xml", "example");
    if (!files?.length) return;
    for (const file of files) {
      this.applyExampleFile(file.name, file.text);
    }
    this.statusMessage = this.examplesLoadStatus(files.length);
    this.markDirty();
    if (this.settings.autoplay) this.scheduleTestRun();
  }

  async addExamplesFromGitHubDirectory(url: string): Promise<void> {
    try {
      const loaded = await loadGitHubExampleDirectory(url, { fetch: this.githubFetch });
      if (!loaded.files.length) {
        throw new Error("No JSON or XML example files found in that folder.");
      }
      for (const file of loaded.files) {
        this.applyExampleFile(file.name, file.text);
      }
      this.rememberLoadUrl("example", url);
      const warnNote = loaded.warnings.length ? ` (${loaded.warnings.length} warnings)` : "";
      this.statusMessage = `${this.examplesLoadStatus(loaded.files.length)}${warnNote}`;
      this.markDirty();
      if (this.settings.autoplay) this.scheduleTestRun();
    } catch (err) {
      this.statusMessage = `Example folder load failed: ${
        err instanceof Error ? err.message : String(err)
      }`;
      this.notifyChange();
      throw err;
    }
  }

  /** Add an Example Instance from in-memory content — used by Workbench Test API and hosts. */
  addExampleContent(filename: string, content: string): void {
    this.applyExampleFile(filename, content);
    this.statusMessage = this.exampleLoadStatus(filename);
    this.markDirty();
    if (this.settings.autoplay) this.scheduleTestRun();
  }

  async addExamplesFromDrop(files: PickedTextFile[]): Promise<void> {
    const supported = files.filter((file) => /\.(json|xml)$/i.test(file.name));
    if (!supported.length) {
      this.statusMessage = "Example drop: JSON or XML files only";
      this.notifyChange();
      return;
    }
    for (const file of supported) {
      this.applyExampleFile(file.name, file.text);
    }
    this.statusMessage = supported.length === 1
      ? this.exampleLoadStatus(supported[0].name)
      : this.examplesLoadStatus(supported.length);
    this.markDirty();
    if (this.settings.autoplay) this.scheduleTestRun();
  }

  setActiveExample(id: string): void {
    this.examples.setActive(id);
    this.clearTreeHighlight();
    const cached = this.examples.getCachedResult(id);
    this.testResult = cached
      ? { ok: true, composition: cached, warnings: [] }
      : null;
    this.markDirty();
  }

  removeExample(id: string): void {
    this.examples.removeExample(id);
    if (!this.examples.hasExamples()) {
      this.settings.autoplay = false;
      this.testResult = null;
    } else {
      const active = this.examples.getActive();
      const cached = active ? this.examples.getCachedResult(active.id) : undefined;
      this.testResult = cached
        ? { ok: true, composition: cached, warnings: [] }
        : null;
    }
    this.markDirty();
  }

  armSlot(slotId: string): void {
    this.listeningSlotId = slotId;
    this.statusMessage = `Listening for source path → ${slotId}`;
    this.notifyChange();
  }

  setTreeHighlight(
    syncPath: string,
    origin: "schema" | "instance",
  ): void {
    this.treeHighlight = { syncPath, origin };
  }

  clearTreeHighlight(): void {
    this.treeHighlight = { syncPath: null, origin: null };
  }

  bindFromNode(path: string, format: SourceFormatId): void {
    if (!this.listeningSlotId) return;
    this.mapNodeToSlot(this.listeningSlotId, path, format);
  }

  /**
   * Bind a source tree path to a Target value slot (Click-to-Map after Listening Mode,
   * or drag-and-drop which skips Listening Mode).
   */
  mapNodeToSlot(slotId: string, path: string, format: SourceFormatId): void {
    const slot = collectValueSlots(this.skeleton).find((s) => s.slotId === slotId);
    if (!slot) return;
    const xpath = getSourceFormatHandler(format).pathToExpression(path);
    const expr = buildSourceQueryExpression(xpath, returnTypeForTarget(slot.rmType));
    this.model = applyExpressionEdit(this.model, slot.slotId, expr, {
      rmType: slot.rmType,
      returnType: returnTypeForTarget(slot.rmType),
      label: slot.label,
      mandatory: slot.mandatory,
    });
    this.listeningSlotId = null;
    this.refreshDerived();
    this.statusMessage = `Mapped ${slot.label}`;
    this.markDirty();
    if (this.settings.autoplay) this.scheduleTestRun();
  }

  /**
   * JSON Schema / inferred type for a source path, when a Source Schema is loaded.
   * Used to pick a typed `source_query*` block on canvas drop.
   */
  lookupSourceSchemaType(path: string): string | null {
    if (!this.schemaTree) return null;
    const node = findNodeBySyncPath(this.schemaTree, canonicalSyncPath(path));
    return node?.type ?? null;
  }

  setStatusMessage(message: string): void {
    this.statusMessage = message;
    this.notifyChange();
  }

  /** Patch a Mapping Model slot expression (AI import / derived-index edits). */
  applySlotExpression(slotId: string, expression: string): void {
    const slot = collectValueSlots(this.skeleton).find((s) => s.slotId === slotId);
    this.model = applyExpressionEdit(this.model, slotId, expression, slot
      ? {
        rmType: slot.rmType,
        returnType: returnTypeForTarget(slot.rmType),
        label: slot.label,
        mandatory: slot.mandatory,
      }
      : undefined);
    this.refreshDerived();
    this.markDirty();
    if (this.settings.autoplay) this.scheduleTestRun();
  }

  /** @deprecated Use applySlotExpression — kept for Workbench Test API callers. */
  applySpecExpression(slotId: string, expression: string): void {
    this.applySlotExpression(slotId, expression);
  }

  /** Replace the derived Mapping Model from the canonical Blockly workspace JSON. */
  syncFromBlockly(
    blocklyState: unknown,
    slots: Array<{ slotId: string; rmType: string; expression: string }>,
  ): void {
    if (!this.templateId) return;
    let next = createEmptyModel(this.templateId);
    next.targetFormat = this.target?.format;
    next.optionalRm = [...this.model.optionalRm];
    const targetSlots = new Map(collectValueSlots(this.skeleton).map((slot) => [slot.slotId, slot]));
    for (const item of slots) {
      const targetSlot = targetSlots.get(item.slotId);
      next = applyExpressionEdit(next, item.slotId, item.expression, {
        rmType: targetSlot?.rmType ?? item.rmType,
        returnType: targetSlot ? returnTypeForTarget(targetSlot.rmType) : "string",
        label: targetSlot?.label,
        mandatory: targetSlot?.mandatory,
      });
    }
    this.blocklyState = blocklyState;
    this.model = next;
    this.refreshDerived();
    this.markDirty();
    if (this.settings.autoplay) this.scheduleTestRun();
  }

  toggleAutoplay(): void {
    if (!this.examples.hasExamples()) return;
    this.settings.autoplay = !this.settings.autoplay;
    if (this.settings.autoplay) this.scheduleTestRun();
    this.markDirty();
  }

  runTestNow(): void {
    const active = this.examples.getActive();
    if (!active) {
      this.testResult = { ok: false, error: "No active example", warnings: [] };
      this.notifyChange();
      return;
    }
    this.testResult = runTest(this.model, active.content, active.format, {
      target: this.target,
      exportTarget: this.settings.exportTarget,
      handlebarsTemplate: this.handlebarsTemplate,
    });
    if (this.testResult.composition) {
      this.examples.setCachedResult(active.id, this.testResult.composition);
    }
    this.notifyChange();
  }

  exportTypeScript(): void {
    const adapter = getExportTargetAdapter(this.settings.exportTarget);
    const code = generate(this.model, this.settings.exportTarget, {
      handlebarsTemplate: this.handlebarsTemplate,
    });
    void this.host.downloadText(
      `conversion-${safeFilename(this.templateId)}.${adapter.extension}`,
      code,
      adapter.mime,
    );
  }

  exportMappingSpec(): void {
    const state = this.getBlocklyState?.() ?? this.blocklyState;
    const text = projectBlocklyState(state).text;
    const base = safeFilename(this.templateId || this.projectId || "mapping");
    void this.host.downloadText(`${base}.mapping-spec.txt`, text, "text/plain");
  }

  async saveProjectAs(displayName: string): Promise<void> {
    const name = displayName.trim();
    if (!name) throw new Error("Project name is required");
    const bundle = this.toBundle();
    await this.host.saveManualSave(bundle, name);
    this.dirty = false;
    this.statusMessage = `Saved as "${name}"`;
    this.notifyChange();
  }

  newProject(): void {
    this.resetWorkspaceState();
    this.statusMessage = "New project";
    this.notifyChange();
  }

  hasWorkspaceContent(): boolean {
    return Boolean(
      this.templateId ||
        this.schemaTree ||
        this.examples.hasExamples() ||
        this.model.slots.some((slot) => slot.expression) ||
        this.model.optionalRm.length,
    );
  }

  async listLoadableProjects() {
    return await this.host.listLoadableProjects();
  }

  async loadStoredProject(storageKey: string): Promise<void> {
    const record = await this.host.loadStoredProjectRecord(storageKey);
    if (!record) {
      this.statusMessage = "Project not found";
      this.notifyChange();
      return;
    }
    this.resetWorkspaceState();
    this.loadBundle(record.bundle);
    this.dirty = false;
    this.lastAutosaveAt = record.storageKey === AUTOSAVE_STORAGE_KEY ? record.savedAt : null;
    this.statusMessage = "Project loaded";
    this.notifyChange();
  }

  exportProject(): void {
    const bundle = this.toBundle();
    const bytes = exportBundle(bundle);
    this.host.downloadBytes(bundleFilename(this.projectId), bytes, "application/zip");
  }

  async importProject(): Promise<void> {
    const file = await this.host.pickBinaryFile(".intehrgrator,.zip", "project");
    if (!file) return;
    const bundle = importBundle(file.bytes);
    this.resetWorkspaceState();
    this.loadBundle(bundle);
    this.markDirty();
    this.statusMessage = "Project imported";
    this.notifyChange();
  }

  async copyAiPrompt(
    delivery: AiArtifactDelivery = "inline",
    scope: "full" | "slot" = "full",
    slotId?: string,
  ): Promise<void> {
    const resolvedSlotId = scope === "slot"
      ? (slotId ?? this.listeningSlotId ?? undefined)
      : slotId;
    const prompt = buildPrompt({
      scope,
      slotId: resolvedSlotId,
      targetId: this.templateId,
      targetFormat: this.target?.format ?? this.model.targetFormat ?? "openehr-template",
      targetFilename: this.templateFilename,
      sourceFormat: this.schemaTree ? this.schemaFormat : undefined,
      activeExampleFilename: this.examples.getActive()?.filename,
      skeleton: this.skeleton,
      model: this.model,
      formatDocUrl: this.host.resolveAppUrl("docs/AI_SUGGESTION_FORMAT.md"),
      delivery,
      artifacts: this.collectAiArtifacts(),
    });
    await this.host.copyToClipboard(prompt);
    this.statusMessage = `AI prompt copied (${delivery})`;
    this.notifyChange();
  }

  async importAiSuggestionsFromClipboard(): Promise<void> {
    const text = await this.host.readClipboard();
    const payload = parseSuggestionsPayload(text);
    const valueSlots = collectValueSlots(this.skeleton);
    const known = new Set(collectAllSlotIds(this.skeleton));
    const slotMeta = new Map(
      valueSlots.map((s) => [s.slotId, {
        rmType: s.rmType,
        returnType: returnTypeForTarget(s.rmType),
        label: s.label,
        mandatory: s.mandatory,
      }]),
    );
    const { model, report } = importSuggestions(this.model, payload, known, slotMeta);
    this.model = model;
    this.refreshDerived();
    this.statusMessage =
      `Import: ${report.applied} applied, ${report.loopsAccepted} loops, ${report.skipped} skipped, ${report.errors.length} errors`;
    this.markDirty();
  }

  private collectAiArtifacts(): AiPromptArtifact[] {
    const artifacts: AiPromptArtifact[] = [];
    if (this.target && this.templateContent) {
      artifacts.push({
        role: "target",
        filename: this.templateFilename || this.target.filename,
        format: this.target.format,
        content: this.templateContent,
        originUrl: this.targetOriginUrl ?? this.target.fileset?.sourceUrl,
      });
      const fileset = this.target.fileset;
      if (fileset?.files?.length) {
        for (const file of fileset.files) {
          const base = file.path.split("/").pop() || file.path;
          if (base === this.templateFilename) continue;
          artifacts.push({
            role: "target-fileset",
            filename: file.path,
            format: "openehr-template",
            content: file.content,
            originUrl: fileset.sourceUrl,
          });
        }
      }
    }
    if (this.schemaTree && this.schemaContent) {
      artifacts.push({
        role: "source-schema",
        filename: this.schemaFilename,
        format: this.schemaFormat,
        content: this.schemaContent,
        originUrl: this.schemaOriginUrl ?? undefined,
      });
    }
    for (const ex of this.examples.list()) {
      artifacts.push({
        role: "example",
        filename: ex.filename,
        format: ex.format,
        content: ex.content,
        originUrl: this.exampleOriginUrls.get(ex.id),
      });
    }
    return artifacts;
  }

  setExportTarget(target: ExportTarget): void {
    this.settings.exportTarget = target;
    this.refreshDerived();
    this.markDirty();
  }

  setHandlebarsTemplate(template: string): void {
    this.handlebarsTemplate = template;
    this.refreshDerived();
    this.markDirty();
    if (this.settings.autoplay) this.scheduleTestRun();
  }

  getOptionalAttachments(parentSlotId: string) {
    const node = findSkeletonNode(this.skeleton, parentSlotId);
    if (!node) return [];
    const present = new Set(
      node.children
        .map((c) => c.rmAttribute)
        .filter((a): a is string => Boolean(a)),
    );
    for (const extra of this.model.optionalRm) {
      if (extra.attachmentSlotId === parentSlotId) {
        present.add(extra.attributeName);
      }
    }
    return getValidAttachments(node.rmType, {
      presentAttributes: present,
      templateConstrained: present,
    });
  }

  /** Attachments for a Blockly block — skeleton slot when present, otherwise RM type. */
  getOptionalAttachmentsFor(
    rmType: string,
    slotId: string,
    presentFromBlock: string[] = [],
  ) {
    if (slotId && findSkeletonNode(this.skeleton, slotId)) {
      return this.getOptionalAttachments(slotId);
    }
    return getValidAttachments(rmType, {
      presentAttributes: new Set(presentFromBlock),
      templateConstrained: new Set(),
    });
  }

  addOptionalRm(parentSlotId: string, rmType: string, attributeName: string): void {
    this.model = {
      ...this.model,
      optionalRm: [
        ...this.model.optionalRm,
        { attachmentSlotId: parentSlotId, rmType, attributeName },
      ],
    };
    this.refreshDerived();
    this.markDirty();
  }

  getSaveStatus(): { dirty: boolean; label: string } {
    if (this.dirty) return { dirty: true, label: "unsaved changes" };
    if (this.lastAutosaveAt) {
      return { dirty: false, label: `autosaved at ${formatSaveTime(this.lastAutosaveAt)}` };
    }
    return { dirty: false, label: "" };
  }

  private buildExampleTree(): SchemaTreeNode | null {
    const active = this.examples.getActive();
    if (!active) return null;
    const rootName = active.filename.replace(/\.[^.]+$/, "");
    return getSourceFormatHandler(active.format).loadInstance(active.content, rootName);
  }

  private buildExampleValidations(): Record<string, InstanceValidationIssue[]> {
    if (!this.schemaTree) return {};
    const out: Record<string, InstanceValidationIssue[]> = {};
    for (const example of this.examples.list()) {
      out[example.id] = validateInstanceAgainstSchema(
        example.content,
        example.format,
        this.schemaTree,
        this.schemaContent,
      );
    }
    return out;
  }

  private buildActiveExampleValidation(): InstanceValidationIssue[] {
    const active = this.examples.getActive();
    if (!active || !this.schemaTree) return [];
    return validateInstanceAgainstSchema(
      active.content,
      active.format,
      this.schemaTree,
      this.schemaContent,
    );
  }

  private exampleLoadStatus(filename: string): string {
    const issues = this.buildActiveExampleValidation();
    if (!issues.length) return `Added example ${filename}`;
    const n = issues.length;
    return `Added example ${filename} with ${n} schema mismatch${n === 1 ? "" : "es"}`;
  }

  private examplesLoadStatus(count: number): string {
    const mismatchCount = Object.values(this.buildExampleValidations())
      .reduce((sum, issues) => sum + issues.length, 0);
    if (!mismatchCount) return `Added ${count} examples`;
    return `Added ${count} examples with ${mismatchCount} schema mismatch${
      mismatchCount === 1 ? "" : "es"
    }`;
  }

  private tryApplySchemaFile(filename: string, content: string): void {
    try {
      this.applySchemaFile(filename, content);
    } catch (err) {
      this.schemaTree = null;
      const detail = err instanceof Error ? err.message : String(err);
      this.setSchemaError(`Could not load ${filename}: ${detail}`);
    }
  }

  private setSchemaError(message: string): void {
    this.schemaError = message;
    this.statusMessage = message;
    console.error(message);
    this.notifyChange();
  }

  private applySchemaFile(filename: string, content: string): void {
    this.schemaError = null;
    this.schemaFilename = filename;
    this.schemaContent = content;
    this.schemaOriginUrl = null;
    const format = detectSourceFormat(filename, content);
    this.schemaFormat = format;
    this.schemaTree = getSourceFormatHandler(format).loadSchema(
      content,
      filename.replace(/\.[^.]+$/, ""),
    );
    this.statusMessage = `Loaded schema ${filename}`;
    this.markDirty();
  }

  private applyExampleFile(filename: string, content: string): string {
    const format = detectSourceFormat(filename, content);
    const id = crypto.randomUUID();
    this.examples.addExample({ id, filename, format, content });
    return id;
  }

  private refreshDerived(): void {
    // Spec view is a projected Mapping Spec (widgets); keep pretty JSON for diagnostics/AI copy.
    this.specText = formatBlocklyState(this.getBlocklyState?.() ?? this.blocklyState);
    this.generatedCode = this.model.templateId
      ? generate(this.model, this.settings.exportTarget, {
        handlebarsTemplate: this.handlebarsTemplate,
      })
      : "";
  }

  private scheduleAutosave(): void {
    if (this.autosaveTimer !== null) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null;
      void this.performAutosave();
    }, this.autosaveDebounceMs) as unknown as number;
  }

  /** Flush a pending autosave immediately — used by tests and page-unload hooks. */
  async flushAutosave(): Promise<void> {
    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    await this.performAutosave();
  }

  private async performAutosave(): Promise<void> {
    if (!this.dirty) return;
    try {
      const bundle = this.toBundle();
      await this.host.saveAutosave(bundle);
      this.clearDirtyAfterSave();
      this.notifyChange();
    } catch (err) {
      this.statusMessage = `Autosave failed: ${err instanceof Error ? err.message : String(err)}`;
      this.notifyChange();
    }
  }

  private clearDirtyAfterSave(): void {
    this.dirty = false;
    this.lastAutosaveAt = new Date().toISOString();
  }

  private resetWorkspaceState(): void {
    this.projectId = crypto.randomUUID();
    this.templateFilename = "";
    this.templateContent = "";
    this.templateId = "";
    this.skeleton = [];
    this.schemaTree = null;
    this.schemaFilename = "";
    this.schemaContent = "";
    this.schemaFormat = "json";
    this.schemaError = null;
    this.schemaOriginUrl = null;
    this.targetOriginUrl = null;
    this.exampleOriginUrls = new Map();
    this.target = null;
    this.model = createEmptyModel("");
    this.settings = { ...DEFAULT_SETTINGS };
    this.examples = new ExampleInstanceManager();
    this.specText = "";
    this.handlebarsTemplate = "";
    this.generatedCode = "";
    this.testResult = null;
    this.listeningSlotId = null;
    this.treeHighlight = { syncPath: null, origin: null };
    this.blocklyState = null;
    this.dirty = false;
    this.lastAutosaveAt = null;
    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  private scheduleTestRun(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.runTestNow();
      this.debounceTimer = null;
    }, 500) as unknown as number;
  }

  private toBundle(): ProjectBundle {
    const now = new Date().toISOString();
    return {
      version: BUNDLE_VERSION,
      projectId: this.projectId,
      appVersion: APP_VERSION,
      createdAt: now,
      updatedAt: now,
      template: this.target?.format === "openehr-template"
        ? {
          filename: this.templateFilename,
          templateId: this.templateId,
          content: this.templateContent,
          skeleton: this.skeleton,
        }
        : null,
      target: this.target
        ? {
          format: this.target.format,
          filename: this.target.filename,
          targetId: this.target.targetId,
          content: this.target.content,
          skeleton: this.target.skeleton,
          fileset: this.target.fileset,
        }
        : null,
      sourceSchema: this.schemaTree
        ? {
          filename: this.schemaFilename,
          format: this.schemaFormat,
          content: this.schemaContent,
          tree: [this.schemaTree],
        }
        : null,
      examples: this.examples.list(),
      activeExampleId: this.examples.getActive()?.id ?? null,
      mapping: {
        blocklyState: this.getBlocklyState?.() ?? this.blocklyState,
        model: this.model,
        handlebarsTemplate: this.handlebarsTemplate,
      },
      settings: this.settings,
      urlHistory: this.captureUrlHistory(),
    };
  }

  private loadBundle(bundle: ProjectBundle): void {
    this.projectId = bundle.projectId;
    this.settings = { ...DEFAULT_SETTINGS, ...bundle.settings };
    this.model = {
      ...bundle.mapping.model,
      modelVersion: bundle.mapping.model.modelVersion ?? 1,
    };
    this.blocklyState = bundle.mapping.blocklyState;
    this.handlebarsTemplate = bundle.mapping.handlebarsTemplate ?? "";
    this.templateFilename = "";
    this.templateContent = "";
    this.templateId = "";
    this.skeleton = [];
    this.target = null;
    this.schemaTree = null;
    this.schemaFilename = "";
    this.schemaContent = "";
    this.schemaFormat = "json";
    this.schemaError = null;
    const storedTarget = bundle.target ?? (bundle.template
      ? {
        format: "openehr-template" as const,
        filename: bundle.template.filename,
        targetId: bundle.template.templateId,
        content: bundle.template.content,
        skeleton: bundle.template.skeleton,
      }
      : null);
    if (storedTarget) {
      this.target = storedTarget;
      this.templateFilename = storedTarget.filename;
      this.templateContent = storedTarget.content;
      this.templateId = storedTarget.targetId;
      this.skeleton = storedTarget.skeleton;
      this.model.targetFormat = storedTarget.format;
    }
    if (bundle.sourceSchema?.tree?.[0]) {
      this.schemaTree = bundle.sourceSchema.tree[0];
      this.schemaFilename = bundle.sourceSchema.filename;
      this.schemaContent = bundle.sourceSchema.content;
      this.schemaFormat = bundle.sourceSchema.format ??
        detectSourceFormat(bundle.sourceSchema.filename, bundle.sourceSchema.content);
    }
    for (const ex of bundle.examples) this.examples.addExample(ex);
    if (bundle.activeExampleId) this.examples.setActive(bundle.activeExampleId);
    if (this.urlStorage) restoreUrlHistory(bundle.urlHistory, this.urlStorage);
    this.refreshDerived();
  }

  private captureUrlHistory() {
    return this.urlStorage
      ? snapshotUrlHistory(this.urlStorage)
      : { schema: [] as string[], example: [] as string[], target: [] as string[] };
  }

  private rememberLoadUrl(kind: UrlHistoryKind, url: string): void {
    if (this.urlStorage) rememberUrl(kind, url, this.urlStorage);
  }

  private async loadGitHubModel(url: string): Promise<GitHubClinicalModelLoadResult> {
    return await loadGitHubClinicalModel(url, { fetch: this.githubFetch });
  }

  private applyGitHubTarget(loaded: GitHubClinicalModelLoadResult): void {
    this.target = {
      format: "openehr-template",
      filename: loaded.filename,
      targetId: loaded.templateId,
      content: loaded.optXml,
      skeleton: loaded.skeleton,
      fileset: loaded.fileset,
    };
    this.templateFilename = loaded.filename;
    this.templateContent = loaded.optXml;
    this.templateId = loaded.templateId;
    this.skeleton = loaded.skeleton;
    this.model = createEmptyModel(this.templateId);
    this.model.targetFormat = "openehr-template";
    this.blocklyState = null;
    this.refreshDerived();
    const extra = loaded.warnings.length ? ` (${loaded.warnings.length} warnings)` : "";
    this.statusMessage =
      `Loaded GitHub template ${loaded.templateId} (${loaded.fetched} files)${extra}`;
    this.markDirty();
  }

  private applyGitHubSchema(loaded: GitHubClinicalModelLoadResult): void {
    const schemaName = loaded.filename.replace(/\.opt$/i, ".wt.json");
    this.applySchemaFile(schemaName, loaded.webTemplateJson);
    const extra = loaded.warnings.length ? ` (${loaded.warnings.length} warnings)` : "";
    this.statusMessage =
      `Loaded GitHub schema ${loaded.templateId} (${loaded.fetched} files)${extra}`;
  }
}

function findSkeletonNode(nodes: SkeletonNode[], slotId: string): SkeletonNode | null {
  for (const n of nodes) {
    if (n.slotId === slotId) return n;
    const child = findSkeletonNode(n.children, slotId);
    if (child) return child;
  }
  return null;
}

function collectAllSlotIds(nodes: SkeletonNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    out.push(n.slotId);
    out.push(...collectAllSlotIds(n.children));
  }
  return out;
}

function returnTypeForTarget(type: string): string {
  if (type.startsWith("DV_") || type === "CODE_PHRASE") return returnTypeForDv(type);
  if (["number", "integer", "decimal", "float", "double"].includes(type.toLowerCase())) {
    return "number";
  }
  if (type.toLowerCase() === "boolean") return "boolean";
  return "string";
}

function formatBlocklyState(state: unknown): string {
  return state == null ? "" : JSON.stringify(state, null, 2);
}

function safeFilename(value: string): string {
  return (value || "mapping").replace(/[^A-Za-z0-9._-]+/g, "-");
}
