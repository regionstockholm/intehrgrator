import * as Blockly from "blockly/core";
import { WebHostAdapter } from "../src/host/web_adapter.ts";
import { WorkbenchController } from "../src/workbench/controller.ts";
import { renderSchemaTree, renderInstanceTree, renderSkeletonList, applyTreeHighlights } from "../src/workbench/tree_views.ts";
import type { TreeHighlightState } from "../src/workbench/tree_views.ts";
import { canonicalSyncPath } from "../src/core/source/schema_loader.ts";
import {
  createReadonlyEditor,
  createSpecEditor,
  setEditorDoc,
} from "../src/workbench/codemirror_setup.ts";
import {
  initBlocklyGenerators,
  loadSkeletonIntoWorkspace,
  applyModelExpressions,
  highlightListeningSlot,
  slotIdFromBlock,
  createModestTheme,
  buildDemoToolbox,
  setOptionalRmPickHandler,
} from "../src/blockly/mod.ts";
import {
  changeLocaleAndReload,
  detectLocale,
  loadBlocklyLocale,
  msg,
  SUPPORTED_LOCALES,
  takeLoadOnceBlocks,
  type IntehrLocale,
} from "../src/blockly/i18n/locale.ts";
import { BUILD_ID, BUILD_TIMESTAMP } from "./build_info.ts";
import { initSplitPanes } from "../src/ui/split_pane.ts";
import { formatSaveTime } from "../src/core/persistence/mod.ts";
import { collectValueSlots } from "../src/core/skeleton/generate_skeleton.ts";
import {
  isTestMode,
  type IntehrgratorTestApi,
  type WorkbenchTestSnapshot,
} from "../src/ui_test/test_api.ts";

const host = new WebHostAdapter();
const controller = new WorkbenchController(host);
const testMode = isTestMode();
let workbenchReadyResolve!: () => void;
const workbenchReady = new Promise<void>((resolve) => {
  workbenchReadyResolve = resolve;
});

const schemaTreeEl = document.getElementById("schema-tree")!;
const exampleTabsEl = document.getElementById("example-tabs")!;
const exampleValidationEl = document.getElementById("example-validation")!;
const testOutputTabsEl = document.getElementById("test-output-tabs")!;
const exampleTreeEl = document.getElementById("example-tree")!;
const skeletonSlotsEl = document.getElementById("skeleton-slots")!;
const blocklyMount = document.getElementById("blockly-mount")!;
const statusMain = document.getElementById("status-main")!;
const statusSave = document.getElementById("status-save")!;
const statusBuild = document.getElementById("status-build")!;

const dialogSaveAs = document.getElementById("dialog-save-as") as HTMLDialogElement;
const saveAsNameInput = document.getElementById("save-as-name") as HTMLInputElement;
const dialogLoadProject = document.getElementById("dialog-load-project") as HTMLDialogElement;
const loadProjectList = document.getElementById("load-project-list")!;

const specEditor = createSpecEditor(
  document.getElementById("spec-editor")!,
  (line, text) => {
    const state = controller.getState();
    const specLine = state.specText.split("\n")[line];
    if (!specLine?.includes("= ")) return;
    const slotMatch = state.specText.split("\n").slice(0, line + 1).reverse()
      .find((l) => l.includes("# slotId:"));
    const slotId = slotMatch?.match(/slotId:\s*(\S+)/)?.[1];
    if (slotId) controller.applySpecExpression(slotId, text.replace(/^=\s*/, ""));
  },
);

const exportEditor = createReadonlyEditor(document.getElementById("export-editor")!);
const testOutputEditor = createReadonlyEditor(document.getElementById("test-output")!);

/** Set in boot() after locale + inject. */
let workspace!: Blockly.WorkspaceSvg;

let blocklySkeletonKey = "";
let blocklySlotSignature = "";
let ephemeralTreeHighlight: TreeHighlightState | null = null;
let lastActiveExampleId: string | null = null;

function setupLanguageMenu(locale: IntehrLocale): void {
  const labelEl = document.getElementById("language-label");
  const select = document.getElementById("language-dropdown") as HTMLSelectElement | null;
  if (!select) return;
  if (labelEl) labelEl.textContent = msg(locale).LANGUAGE_LABEL;
  select.replaceChildren();
  for (const { code, name } of SUPPORTED_LOCALES) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = name;
    if (code === locale) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => {
    const next = select.value as IntehrLocale;
    changeLocaleAndReload(next, Blockly.serialization.workspaces.save(workspace));
  });
}

async function bootBlockly(): Promise<void> {
  const locale = detectLocale();
  await loadBlocklyLocale(locale);
  initBlocklyGenerators();
  setupLanguageMenu(locale);

  workspace = Blockly.inject(blocklyMount, {
    theme: createModestTheme(),
    toolbox: buildDemoToolbox(locale),
    grid: { spacing: 20, length: 2, colour: "#E8EAED" },
    zoom: {
      controls: true,
      wheel: true,
      startScale: 1,
      maxScale: 1.8,
      minScale: 0.6,
      scaleSpeed: 1.2,
      pinch: true,
    },
    move: { scrollbars: true, drag: true, wheel: true },
    trashcan: false,
    renderer: "thrasos",
  });

  const loadOnce = takeLoadOnceBlocks();
  if (loadOnce) {
    Blockly.serialization.workspaces.load(loadOnce, workspace);
  }

  setOptionalRmPickHandler((block) => {
    const slotId = block.getFieldValue("SLOT_ID");
    if (!slotId) {
      statusMain.textContent = "Select a skeleton node with a slot before inserting optional RM.";
      return;
    }
    const options = controller.getOptionalAttachments(slotId);
    if (!options.length) {
      statusMain.textContent = "No optional RM structures available here.";
      return;
    }
    const labels = options.map((o, i) => `${i + 1}. ${o.label} (${o.attributeName}: ${o.rmType})`);
    const choice = globalThis.prompt(
      `Add optional RM structure:\n${labels.join("\n")}\n\nEnter number:`,
      "1",
    );
    const idx = Number(choice) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= options.length) return;
    const picked = options[idx]!;
    controller.addOptionalRm(slotId, picked.rmType, picked.attributeName);
    if (typeof block.addInput_ === "function") {
      block.addInput_(picked.attributeName);
    }
    statusMain.textContent = `Added ${picked.label}`;
  });

  initSplitPanes(document, () => Blockly.svgResize(workspace));
  controller.setBlocklyStateGetter(() => Blockly.serialization.workspaces.save(workspace));

  workspace.addChangeListener((event) => {
    if (event.type === Blockly.Events.CLICK && "blockId" in event) {
      const blockId = typeof event.blockId === "string" ? event.blockId : null;
      const slotId = blockId ? slotIdFromBlock(workspace.getBlockById(blockId)) : null;
      if (slotId) controller.armSlot(slotId);
      return;
    }
    if (event.type !== Blockly.Events.FINISHED_LOADING) {
      controller.markDirty();
    }
  });
}

function activeTreeHighlight(s: ReturnType<WorkbenchController["getState"]>): TreeHighlightState {
  return ephemeralTreeHighlight ?? s.treeHighlight;
}

function handleTreeHighlight(
  syncPath: string | null,
  origin: "schema" | "instance",
  persist = false,
): void {
  if (syncPath === null) {
    if (ephemeralTreeHighlight?.origin !== origin) return;
    ephemeralTreeHighlight = null;
  } else if (persist) {
    ephemeralTreeHighlight = null;
    controller.setTreeHighlight(syncPath, origin);
  } else {
    ephemeralTreeHighlight = { syncPath, origin };
  }
  applyTreeHighlights(
    schemaTreeEl,
    exampleTreeEl,
    activeTreeHighlight(controller.getState()),
  );
}

function treeHighlightOptions() {
  return {
    onHighlight: (syncPath: string | null, origin: "schema" | "instance") => {
      handleTreeHighlight(syncPath, origin, false);
    },
  };
}

function syncBlocklyWorkspace(s: ReturnType<WorkbenchController["getState"]>): void {
  if (!s.templateId || !s.skeleton.length) {
    blocklySkeletonKey = "";
    blocklySlotSignature = "";
    return;
  }

  const skeletonKey = `${s.projectId}|${s.templateId}|${s.skeleton.length}`;
  const slotSignature = s.model.slots
    .map((slot) => `${slot.slotId}=${slot.expression}`)
    .join("|");

  if (skeletonKey !== blocklySkeletonKey) {
    loadSkeletonIntoWorkspace(workspace, s.skeleton, s.model, s.listeningSlotId);
    blocklySkeletonKey = skeletonKey;
    blocklySlotSignature = slotSignature;
    return;
  }

  if (slotSignature !== blocklySlotSignature) {
    applyModelExpressions(workspace, s.model);
    blocklySlotSignature = slotSignature;
  }

  highlightListeningSlot(workspace, s.listeningSlotId);
}

function bind(id: string, handler: () => void | Promise<void>): void {
  document.getElementById(id)?.addEventListener("click", () => void handler());
}

bind("btn-open-template", () => controller.openTemplate());
bind("btn-load-schema", () => controller.loadSchema());
bind("btn-add-example", () => controller.addExample());
bind("btn-run-test", () => controller.runTestNow());
bind("btn-autoplay", () => controller.toggleAutoplay());
bind("btn-export-ts", () => controller.exportTypeScript());
bind("btn-new-project", () => void handleNewProject());
bind("btn-load-project", () => void openLoadProjectDialog());
bind("btn-save-project", () => openSaveAsDialog());
bind("btn-export-project", () => controller.exportProject());
bind("btn-import-project", () => controller.importProject());
bind("btn-copy-ai", () => controller.copyAiPrompt());
bind("btn-import-ai", () => controller.importAiSuggestionsFromClipboard());

initFileDropTargets();

function initFileDropTargets(): void {
  initFileDrop(schemaTreeEl, {
    accept: (file) => /\.json$/i.test(file.name),
    multiple: false,
    onDrop: (files) => void controller.loadSchemaFromDrop(files[0]),
  });
  initFileDrop(exampleTreeEl, {
    accept: (file) => /\.(json|xml)$/i.test(file.name),
    multiple: true,
    onDrop: (files) => void controller.addExamplesFromDrop(files),
  });
}

function initFileDrop(
  el: HTMLElement,
  options: {
    accept: (file: File) => boolean;
    multiple: boolean;
    onDrop: (files: File[]) => void;
  },
): void {
  el.classList.add("tree-pane--drop-target");
  el.addEventListener("dragenter", (event) => {
    event.preventDefault();
  });
  el.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    el.classList.add("tree-pane--dragover");
  });
  el.addEventListener("dragleave", (event) => {
    if (event.relatedTarget instanceof Node && el.contains(event.relatedTarget)) return;
    el.classList.remove("tree-pane--dragover");
  });
  el.addEventListener("drop", (event) => {
    event.preventDefault();
    el.classList.remove("tree-pane--dragover");
    const files = [...event.dataTransfer?.files ?? []].filter(options.accept);
    if (!files.length) return;
    options.onDrop(options.multiple ? files : files.slice(0, 1));
  });
}

document.getElementById("save-as-cancel")?.addEventListener("click", () => dialogSaveAs.close());
dialogSaveAs.addEventListener("close", () => {
  if (dialogSaveAs.returnValue !== "confirm") return;
  void (async () => {
    try {
      await controller.saveProjectAs(saveAsNameInput.value);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  })();
});

document.getElementById("load-project-cancel")?.addEventListener("click", () => dialogLoadProject.close());

function resetBlocklyView(): void {
  blocklySkeletonKey = "";
  blocklySlotSignature = "";
  Blockly.Events.disable();
  try {
    workspace.clear();
  } finally {
    Blockly.Events.enable();
  }
}

function handleNewProject(): void {
  const message = controller.hasWorkspaceContent()
    ? "Start a new project? The current workspace will be cleared. Unsaved changes may be lost."
    : "Start a new empty project?";
  if (!confirm(message)) return;
  controller.newProject();
  resetBlocklyView();
  ephemeralTreeHighlight = null;
  lastActiveExampleId = null;
}

function openSaveAsDialog(): void {
  saveAsNameInput.value = controller.getState().templateId || "";
  dialogSaveAs.returnValue = "cancel";
  dialogSaveAs.showModal();
  saveAsNameInput.focus();
  saveAsNameInput.select();
}

async function openLoadProjectDialog(): Promise<void> {
  const entries = await controller.listLoadableProjects();
  loadProjectList.innerHTML = "";
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "load-project-empty";
    empty.textContent = "No saved projects yet. Use Save as or wait for autosave.";
    loadProjectList.appendChild(empty);
  } else {
    for (const entry of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "load-project-item";
      const kind = document.createElement("span");
      kind.className = "load-project-item-kind";
      kind.textContent = entry.kind === "autosave" ? "Last autosave" : "Saved project";
      const name = document.createElement("strong");
      name.textContent = entry.displayName;
      const when = document.createElement("span");
      when.textContent = formatSaveTime(entry.savedAt);
      button.append(kind, name, when);
      button.addEventListener("click", () => {
        dialogLoadProject.close();
        void (async () => {
          if (
            controller.hasWorkspaceContent() &&
            !confirm("Load this project? The current workspace will be replaced.")
          ) {
            return;
          }
          await controller.loadStoredProject(entry.storageKey);
          resetBlocklyView();
          ephemeralTreeHighlight = null;
        })();
      });
      loadProjectList.appendChild(button);
    }
  }
  dialogLoadProject.showModal();
}

function render(): void {
  const s = controller.getState();
  const activeExampleId = s.activeExample?.id ?? null;
  if (activeExampleId !== lastActiveExampleId) {
    ephemeralTreeHighlight = null;
    lastActiveExampleId = activeExampleId;
  }

  statusMain.textContent = [
    s.templateId ? `Template: ${s.templateId}` : "No template",
    `Target: ${s.settings.exportTarget.toUpperCase()}`,
    s.activeExample ? `Example: ${s.activeExample.filename}` : "No example",
    `${s.unmappedMandatory} unmapped mandatory`,
    s.statusMessage,
  ].join(" · ");

  const saveStatus = s.saveStatus;
  statusSave.textContent = saveStatus.label;
  statusSave.className = "status-save" + (
    saveStatus.dirty ? " unsaved" : saveStatus.label ? " saved" : ""
  );

  statusBuild.textContent = `${BUILD_ID} · ${BUILD_TIMESTAMP}`;

  if (s.schemaTree) {
    renderSchemaTree(
      schemaTreeEl,
      s.schemaTree,
      (path) => {
        handleTreeHighlight(canonicalSyncPath(path), "schema", true);
        controller.bindFromNode(path, "json");
      },
      treeHighlightOptions(),
    );
  } else {
    schemaTreeEl.textContent = "Load a schema file.";
  }

  renderExampleTabs(s);
  renderTestOutputTabs(s);
  renderExampleValidation(s);

  if (s.exampleTree && s.activeExample) {
    const format = s.activeExample.format;
    renderInstanceTree(
      exampleTreeEl,
      s.exampleTree,
      (path) => {
        handleTreeHighlight(canonicalSyncPath(path), "instance", true);
        controller.bindFromNode(path, format);
      },
      treeHighlightOptions(),
    );
    applyTreeHighlights(schemaTreeEl, exampleTreeEl, activeTreeHighlight(s));
  } else {
    exampleTreeEl.textContent = s.examples.length
      ? "Select an example tab."
      : 'Add example instance(s) to enable "Conversion Test Run(s)" in output previews pane';
  }
  syncBlocklyWorkspace(s);
  renderSkeletonList(
    skeletonSlotsEl,
    s.skeleton,
    (slotId) => controller.armSlot(slotId),
    s.listeningSlotId,
    new Set(s.model.slots.filter((x) => x.expression).map((x) => x.slotId)),
  );

  setEditorDoc(specEditor, s.specText || "# Mapping Specification appears after loading a target schema/template");
  setEditorDoc(exportEditor, s.generatedCode || "// Generated Export");
  setEditorDoc(
    testOutputEditor,
    s.testResult
      ? JSON.stringify(s.testResult.composition ?? { error: s.testResult.error }, null, 2)
      : "// Test Run output",
  );

  const autoplayBtn = document.getElementById("btn-autoplay") as HTMLButtonElement;
  autoplayBtn.disabled = !s.examples.length;
  autoplayBtn.textContent = s.settings.autoplay ? "⏸ Pause" : "▶ Autoplay";
}

function renderExampleTabs(s: ReturnType<WorkbenchController["getState"]>): void {
  exampleTabsEl.innerHTML = "";
  for (const ex of s.examples) {
    const hasIssues = (s.exampleValidations[ex.id]?.length ?? 0) > 0;
    const tab = document.createElement("div");
    tab.className = "example-tab example-tab--with-close" +
      (s.activeExample?.id === ex.id ? " active" : "");
    tab.setAttribute("role", "tab");

    const label = document.createElement("button");
    label.type = "button";
    label.className = "example-tab-label";
    label.textContent = ex.filename;
    label.addEventListener("click", () => controller.setActiveExample(ex.id));

    tab.append(label);
    if (hasIssues) {
      const warn = document.createElement("span");
      warn.className = "example-tab-warn";
      warn.textContent = "⚠";
      warn.title = "Instance does not match schema";
      tab.append(warn);
    }

    const close = document.createElement("button");
    close.type = "button";
    close.className = "example-tab-close";
    close.setAttribute("aria-label", `Close ${ex.filename}`);
    close.textContent = "×";
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      controller.removeExample(ex.id);
    });

    tab.append(close);
    exampleTabsEl.appendChild(tab);
  }
}

function renderTestOutputTabs(s: ReturnType<WorkbenchController["getState"]>): void {
  testOutputTabsEl.innerHTML = "";
  for (const ex of s.examples) {
    const hasIssues = (s.exampleValidations[ex.id]?.length ?? 0) > 0;
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "example-tab" + (s.activeExample?.id === ex.id ? " active" : "");
    tab.append(ex.filename);
    if (hasIssues) {
      const warn = document.createElement("span");
      warn.className = "example-tab-warn";
      warn.textContent = " ⚠";
      warn.title = "Instance does not match schema";
      tab.append(warn);
    }
    tab.addEventListener("click", () => controller.setActiveExample(ex.id));
    testOutputTabsEl.appendChild(tab);
  }
}

function renderExampleValidation(s: ReturnType<WorkbenchController["getState"]>): void {
  const issues = s.activeExampleValidation;
  if (!issues.length) {
    exampleValidationEl.hidden = true;
    exampleValidationEl.replaceChildren();
    return;
  }
  exampleValidationEl.hidden = false;
  exampleValidationEl.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = "Schema mismatch:";
  const list = document.createElement("ul");
  for (const issue of issues) {
    const item = document.createElement("li");
    item.textContent = `${issue.path}: ${issue.message}`;
    list.appendChild(item);
  }
  exampleValidationEl.append(title, list);
}

function installWorkbenchTestApi(): void {
  const api: IntehrgratorTestApi = {
    ready: () => workbenchReady,
    loadTemplate(filename, content) {
      controller.loadTemplateContent(filename, content);
    },
    loadSchema(filename, content) {
      controller.loadSchemaContent(filename, content);
    },
    addExample(filename, content) {
      controller.addExampleContent(filename, content);
    },
    armSlot(slotId) {
      controller.armSlot(slotId);
    },
    bindFromNode(path, format) {
      controller.bindFromNode(path, format);
    },
    runTest() {
      controller.runTestNow();
    },
    setAutoplay(on) {
      const s = controller.getState();
      if (s.settings.autoplay !== on) controller.toggleAutoplay();
    },
    getSnapshot(): WorkbenchTestSnapshot {
      const s = controller.getState();
      const blocklyBlocks = workspace.getAllBlocks(false).map((block) => ({
        id: block.id,
        type: block.type,
        slotId: slotIdFromBlock(block),
      }));
      return {
        templateId: s.templateId,
        listeningSlotId: s.listeningSlotId,
        exampleCount: s.examples.length,
        activeExampleFilename: s.activeExample?.filename ?? null,
        model: s.model,
        testResult: s.testResult,
        statusMessage: s.statusMessage,
        autoplay: s.settings.autoplay,
        unmappedMandatory: s.unmappedMandatory,
        blocklyBlocks,
      };
    },
    findSlotIdBySuffix(suffix) {
      const slots = collectValueSlots(controller.getState().skeleton);
      return slots.find((slot) => slot.slotId.endsWith(suffix))?.slotId ?? null;
    },
  };
  globalThis.window.intehrgratorTestApi = api;
}

async function main(): Promise<void> {
  if (testMode) installWorkbenchTestApi();
  await bootBlockly();
  controller.subscribe(render);
  render();
  workbenchReadyResolve();
}

void main();
