import * as Blockly from "blockly/core";
import { WebHostAdapter } from "../src/host/web_adapter.ts";
import { WorkbenchController } from "../src/workbench/controller.ts";
import { renderSchemaTree, renderSkeletonList } from "../src/workbench/tree_views.ts";
import {
  createReadonlyEditor,
  createSpecEditor,
  setEditorDoc,
} from "../src/workbench/codemirror_setup.ts";
import { initBlocklyGenerators, loadSkeletonIntoWorkspace, applyModelExpressions, highlightListeningSlot, slotIdFromBlock } from "../src/blockly/mod.ts";
import { BUILD_ID, BUILD_TIMESTAMP } from "./build_info.ts";
import * as En from "blockly/msg/en";

Blockly.setLocale(En);

const host = new WebHostAdapter();
const controller = new WorkbenchController(host);

const schemaTreeEl = document.getElementById("schema-tree")!;
const exampleTabsEl = document.getElementById("example-tabs")!;
const exampleTreeEl = document.getElementById("example-tree")!;
const skeletonSlotsEl = document.getElementById("skeleton-slots")!;
const blocklyMount = document.getElementById("blockly-mount")!;
const statusMain = document.getElementById("status-main")!;
const statusBuild = document.getElementById("status-build")!;

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

initBlocklyGenerators();
const workspace = Blockly.inject(blocklyMount, {
  toolbox: {
    kind: "categoryToolbox",
    contents: [
      { kind: "category", name: "Source", colour: "#E87722", contents: [{ kind: "block", type: "source_query" }] },
      { kind: "category", name: "Logic", colour: "#20", contents: [
        { kind: "block", type: "trim" },
        { kind: "block", type: "if_then_else" },
        { kind: "block", type: "math_arithmetic" },
      ]},
    ],
  },
  grid: { spacing: 20, length: 3, colour: "#D9D9D9" },
  zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 1.5, minScale: 0.5 },
  move: { scrollbars: true, drag: true, wheel: true },
  renderer: "zelos",
});

workspace.addChangeListener((event) => {
  if (event.type === Blockly.Events.CLICK && "blockId" in event && event.blockId) {
    const slotId = slotIdFromBlock(workspace.getBlockById(event.blockId));
    if (slotId) controller.armSlot(slotId);
  }
  if (event.type !== Blockly.Events.FINISHED_LOADING) {
    controller.notifyChange();
  }
});

let blocklySkeletonKey = "";
let blocklySlotSignature = "";

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
bind("btn-save-project", () => controller.saveProject());
bind("btn-export-project", () => controller.exportProject());
bind("btn-import-project", () => controller.importProject());
bind("btn-copy-ai", () => controller.copyAiPrompt());
bind("btn-import-ai", () => controller.importAiSuggestionsFromClipboard());

controller.subscribe(render);

function render(): void {
  const s = controller.getState();

  statusMain.textContent = [
    s.templateId ? `Template: ${s.templateId}` : "No template",
    `Target: ${s.settings.exportTarget.toUpperCase()}`,
    s.activeExample ? `Example: ${s.activeExample.filename}` : "No example",
    `${s.unmappedMandatory} unmapped mandatory`,
    s.statusMessage,
  ].join(" · ");

  statusBuild.textContent = `${BUILD_ID} · ${BUILD_TIMESTAMP}`;

  if (s.schemaTree) {
    renderSchemaTree(schemaTreeEl, s.schemaTree, (path) => controller.bindFromNode(path, "json"));
  } else {
    schemaTreeEl.textContent = "Load a JSON schema file.";
  }

  renderExampleTabs(s);

  if (s.exampleTree && s.activeExample) {
    renderSchemaTree(exampleTreeEl, s.exampleTree, (path) => {
      controller.bindFromNode(path, s.activeExample!.format);
    });
  } else {
    exampleTreeEl.textContent = s.examples.length
      ? "Select an example tab."
      : "Add an example instance to enable Test Run.";
  }
  syncBlocklyWorkspace(s);
  renderSkeletonList(
    skeletonSlotsEl,
    s.skeleton,
    (slotId) => controller.armSlot(slotId),
    s.listeningSlotId,
    new Set(s.model.slots.filter((x) => x.expression).map((x) => x.slotId)),
  );

  setEditorDoc(specEditor, s.specText || "# Mapping Specification appears after loading a template");
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
    const tab = document.createElement("button");
    tab.className = "example-tab" + (s.activeExample?.id === ex.id ? " active" : "");
    tab.textContent = ex.filename;
    tab.addEventListener("click", () => controller.setActiveExample(ex.id));
    exampleTabsEl.appendChild(tab);
  }
}

render();
