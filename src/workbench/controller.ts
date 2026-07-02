import type {
  ExampleInstance,
  MappingModel,
  ProjectBundle,
  ProjectSettings,
  SchemaTreeNode,
  SkeletonNode,
  TestResult,
} from "../types/mod.ts";
import {
  APP_VERSION,
  BUNDLE_VERSION,
  bundleFilename,
  exportBundle,
  importBundle,
} from "../core/persistence/mod.ts";
import { DEFAULT_SETTINGS } from "../types/mod.ts";
import { generateSkeleton, collectValueSlots } from "../core/skeleton/generate_skeleton.ts";
import {
  applyExpressionEdit,
  countUnmappedMandatory,
  createEmptyModel,
  validateModel,
} from "../core/mapping_model/mod.ts";
import { toSpec } from "../core/spec/mod.ts";
import { generate } from "../core/codegen/mod.ts";
import { runTest } from "../core/test_runner/mod.ts";
import { ExampleInstanceManager } from "../core/source/example_manager.ts";
import {
  inferSchemaFromInstance,
  loadJsonSchema,
  loadXmlSchemaFromInstance,
  pathToFontoxpath,
} from "../core/source/schema_loader.ts";
import { buildSourceQueryExpression } from "../core/expression/mod.ts";
import { returnTypeForDv } from "../core/rm_mandatory.ts";
import { buildPrompt, importSuggestions, parseSuggestionsPayload } from "../core/ai/mod.ts";
import type { HostAdapter } from "../host/web_adapter.ts";
import { getValidAttachments } from "../core/rm_attachment_catalog.ts";

export type WorkbenchListener = () => void;

export class WorkbenchController {
  private listeners = new Set<WorkbenchListener>();
  private projectId = crypto.randomUUID();
  private templateFilename = "";
  private templateContent = "";
  private templateId = "";
  private skeleton: SkeletonNode[] = [];
  private schemaTree: SchemaTreeNode | null = null;
  private schemaFilename = "";
  private model: MappingModel = createEmptyModel("");
  private settings: ProjectSettings = { ...DEFAULT_SETTINGS };
  private examples = new ExampleInstanceManager();
  private specText = "";
  private generatedCode = "";
  private testResult: TestResult | null = null;
  private listeningSlotId: string | null = null;
  private treeHighlight: { syncPath: string | null; origin: "schema" | "instance" | null } = {
    syncPath: null,
    origin: null,
  };
  private blocklyState: unknown = null;
  private debounceTimer: number | null = null;
  private statusMessage = "Ready";

  constructor(private host: HostAdapter) {}

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
      schemaTree: this.schemaTree,
      schemaFilename: this.schemaFilename,
      exampleTree: this.buildExampleTree(),
      model: this.model,
      settings: this.settings,
      examples: this.examples.list(),
      activeExample: this.examples.getActive(),
      specText: this.specText,
      generatedCode: this.generatedCode,
      testResult: this.testResult,
      listeningSlotId: this.listeningSlotId,
      treeHighlight: this.treeHighlight,
      statusMessage: this.statusMessage,
      validationIssues: validateModel(this.model, this.skeleton),
      unmappedMandatory: countUnmappedMandatory(this.model, this.skeleton),
    };
  }

  async openTemplate(): Promise<void> {
    const file = await this.host.pickFile(".opt,.opt2,.json,.adl,.adls,.xml");
    if (!file) return;
    this.templateContent = await this.host.readTextFile(file);
    this.templateFilename = file.name;
    const result = generateSkeleton(this.templateContent);
    this.templateId = result.templateId;
    this.skeleton = result.skeleton;
    this.model = createEmptyModel(this.templateId);
    this.refreshDerived();
    this.statusMessage = `Loaded template ${this.templateId}`;
    this.notifyChange();
  }

  async loadSchema(): Promise<void> {
    try {
      const file = await this.host.pickFile(".json,application/json");
      if (!file) return;
      const content = await this.host.readTextFile(file);
      this.schemaFilename = file.name;
      this.schemaTree = loadJsonSchema(content, file.name.replace(/\.[^.]+$/, ""));
      this.statusMessage = `Loaded schema ${file.name}`;
      this.notifyChange();
    } catch (err) {
      this.statusMessage = `Schema load failed: ${err instanceof Error ? err.message : String(err)}`;
      this.notifyChange();
    }
  }

  async addExample(): Promise<void> {
    const file = await this.host.pickFile(".json,.xml");
    if (!file) return;
    const content = await this.host.readTextFile(file);
    const format = file.name.endsWith(".xml") ? "xml" : "json";
    const id = crypto.randomUUID();
    this.examples.addExample({ id, filename: file.name, format, content });
    this.statusMessage = `Added example ${file.name}`;
    this.notifyChange();
    if (this.settings.autoplay) this.scheduleTestRun();
  }

  setActiveExample(id: string): void {
    this.examples.setActive(id);
    this.clearTreeHighlight();
    const cached = this.examples.getCachedResult(id);
    this.testResult = cached
      ? { ok: true, composition: cached, warnings: [] }
      : null;
    this.notifyChange();
  }

  removeExample(id: string): void {
    this.examples.removeExample(id);
    if (!this.examples.hasExamples()) {
      this.settings.autoplay = false;
      this.testResult = null;
    }
    this.notifyChange();
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

  bindFromNode(path: string, format: "json" | "xml"): void {
    if (!this.listeningSlotId) return;
    const slot = collectValueSlots(this.skeleton).find((s) => s.slotId === this.listeningSlotId);
    if (!slot) return;
    const xpath = pathToFontoxpath(path, format);
    const expr = buildSourceQueryExpression(xpath, returnTypeForDv(slot.rmType));
    this.model = applyExpressionEdit(this.model, slot.slotId, expr, {
      rmType: slot.rmType,
      returnType: returnTypeForDv(slot.rmType),
      label: slot.label,
      mandatory: slot.mandatory,
    });
    this.listeningSlotId = null;
    this.refreshDerived();
    this.statusMessage = `Mapped ${slot.label}`;
    this.notifyChange();
    if (this.settings.autoplay) this.scheduleTestRun();
  }

  applySpecExpression(slotId: string, expression: string): void {
    const slot = collectValueSlots(this.skeleton).find((s) => s.slotId === slotId);
    this.model = applyExpressionEdit(this.model, slotId, expression, slot
      ? {
        rmType: slot.rmType,
        returnType: returnTypeForDv(slot.rmType),
        label: slot.label,
        mandatory: slot.mandatory,
      }
      : undefined);
    this.refreshDerived();
    this.notifyChange();
    if (this.settings.autoplay) this.scheduleTestRun();
  }

  toggleAutoplay(): void {
    if (!this.examples.hasExamples()) return;
    this.settings.autoplay = !this.settings.autoplay;
    if (this.settings.autoplay) this.scheduleTestRun();
    this.notifyChange();
  }

  runTestNow(): void {
    const active = this.examples.getActive();
    if (!active) {
      this.testResult = { ok: false, error: "No active example", warnings: [] };
      this.notifyChange();
      return;
    }
    this.testResult = runTest(this.model, active.content, active.format);
    if (this.testResult.composition) {
      this.examples.setCachedResult(active.id, this.testResult.composition);
    }
    this.notifyChange();
  }

  exportTypeScript(): void {
    const code = generate(this.model, "typescript");
    this.host.downloadText(`conversion-${this.templateId}.ts`, code, "text/typescript");
  }

  async saveProject(): Promise<void> {
    const bundle = this.toBundle();
    await this.host.saveProject(bundle);
    this.statusMessage = "Project saved";
    this.notifyChange();
  }

  exportProject(): void {
    const bundle = this.toBundle();
    const bytes = exportBundle(bundle);
    this.host.downloadBytes(bundleFilename(this.projectId), bytes, "application/zip");
  }

  async importProject(): Promise<void> {
    const file = await this.host.pickFile(".intehrgrator,.zip");
    if (!file) return;
    const buf = new Uint8Array(await file.arrayBuffer());
    const bundle = importBundle(buf);
    this.loadBundle(bundle);
    this.statusMessage = "Project imported";
    this.notifyChange();
  }

  async copyAiPrompt(scope: "full" | "slot" = "full", slotId?: string): Promise<void> {
    const prompt = buildPrompt({
      scope,
      slotId,
      templateId: this.templateId,
      templateFilename: this.templateFilename,
      sourceFilename: this.schemaFilename,
      skeleton: this.skeleton,
      model: this.model,
      formatDocUrl: new URL("/docs/AI_SUGGESTION_FORMAT.md", location.href).href,
    });
    await this.host.copyToClipboard(prompt);
    this.statusMessage = "AI prompt copied";
    this.notifyChange();
  }

  async importAiSuggestionsFromClipboard(): Promise<void> {
    const text = await this.host.readClipboard();
    const payload = parseSuggestionsPayload(text);
    const known = new Set(collectValueSlots(this.skeleton).map((s) => s.slotId));
    const { model, report } = importSuggestions(this.model, payload, known);
    this.model = model;
    this.refreshDerived();
    this.statusMessage =
      `Import: ${report.applied} applied, ${report.skipped} skipped, ${report.errors.length} errors`;
    this.notifyChange();
  }

  setExportTarget(target: "typescript" | "java"): void {
    this.settings.exportTarget = target;
    this.refreshDerived();
    this.notifyChange();
  }

  getOptionalAttachments(parentSlotId: string) {
    const node = findSkeletonNode(this.skeleton, parentSlotId);
    if (!node) return [];
    const present = new Set(node.children.map((c) => c.label));
    return getValidAttachments(node.rmType, {
      presentAttributes: present,
      templateConstrained: present,
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
    this.notifyChange();
  }

  private buildExampleTree(): SchemaTreeNode | null {
    const active = this.examples.getActive();
    if (!active) return null;
    const rootName = active.filename.replace(/\.[^.]+$/, "");
    return active.format === "json"
      ? inferSchemaFromInstance(active.content, rootName)
      : loadXmlSchemaFromInstance(active.content, rootName);
  }

  private refreshDerived(): void {
    this.specText = this.skeleton.length ? toSpec(this.model, this.skeleton) : "";
    this.generatedCode = this.model.templateId
      ? generate(this.model, this.settings.exportTarget)
      : "";
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
      template: this.templateId
        ? {
          filename: this.templateFilename,
          templateId: this.templateId,
          content: this.templateContent,
          skeleton: this.skeleton,
        }
        : null,
      sourceSchema: this.schemaTree
        ? {
          filename: this.schemaFilename,
          content: JSON.stringify(this.schemaTree),
          tree: [this.schemaTree],
        }
        : null,
      examples: this.examples.list(),
      activeExampleId: this.examples.getActive()?.id ?? null,
      mapping: { blocklyState: this.blocklyState, model: this.model },
      settings: this.settings,
    };
  }

  private loadBundle(bundle: ProjectBundle): void {
    this.projectId = bundle.projectId;
    this.settings = bundle.settings;
    this.model = bundle.mapping.model;
    this.blocklyState = bundle.mapping.blocklyState;
    if (bundle.template) {
      this.templateFilename = bundle.template.filename;
      this.templateContent = bundle.template.content;
      this.templateId = bundle.template.templateId;
      this.skeleton = bundle.template.skeleton;
    }
    if (bundle.sourceSchema?.tree?.[0]) {
      this.schemaTree = bundle.sourceSchema.tree[0];
      this.schemaFilename = bundle.sourceSchema.filename;
    }
    for (const ex of bundle.examples) this.examples.addExample(ex);
    if (bundle.activeExampleId) this.examples.setActive(bundle.activeExampleId);
    this.refreshDerived();
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
