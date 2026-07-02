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
import { initBlocklyGenerators, loadSkeletonIntoWorkspace, applyModelExpressions, highlightListeningSlot, slotIdFromBlock } from "../src/blockly/mod.ts";
import { BUILD_ID, BUILD_TIMESTAMP } from "./build_info.ts";
import { initSplitPanes } from "../src/ui/split_pane.ts";
import * as En from "blockly/msg/en";

Blockly.setLocale(En as unknown as Record<string, string>);

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

const TOOLBOX_COLOURS = {
  source: "#E87722",
  literals: "#5BA68D",
  logic: "#A6745B",
  variables: "#A65B80",
} as const;

function toolboxCategoryRow(className: string): { row: string } {
  return { row: `blocklyToolboxCategory ${className}` };
}

const workspace = Blockly.inject(blocklyMount, {
  toolbox: {
    kind: "categoryToolbox",
    contents: [
      { kind: "category", name: "Source", colour: TOOLBOX_COLOURS.source, cssconfig: toolboxCategoryRow("toolbox-category-source"), contents: [
        { kind: "block", type: "source_query" },
      ]},
      { kind: "category", name: "Literals", colour: TOOLBOX_COLOURS.literals, cssconfig: toolboxCategoryRow("toolbox-category-literals"), contents: [
        { kind: "block", type: "text_literal" },
        { kind: "block", type: "number_literal" },
      ]},
      { kind: "category", name: "Logic", colour: TOOLBOX_COLOURS.logic, cssconfig: toolboxCategoryRow("toolbox-category-logic"), contents: [
        { kind: "block", type: "trim" },
        { kind: "block", type: "concat" },
        { kind: "block", type: "if_then_else" },
        { kind: "block", type: "switch_case" },
        { kind: "block", type: "math_arithmetic" },
      ]},
      { kind: "category", name: "Variables", colour: TOOLBOX_COLOURS.variables, cssconfig: toolboxCategoryRow("toolbox-category-variables"), contents: [
        { kind: "block", type: "mapping_var_get" },
        { kind: "block", type: "mapping_var_set" },
      ]},
    ],
  },
  grid: { spacing: 20, length: 3, colour: "#D9D9D9" },
  zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 1.5, minScale: 0.5 },
  move: { scrollbars: true, drag: true, wheel: true },
  renderer: "zelos",
});

initSplitPanes(document, () => Blockly.svgResize(workspace));

workspace.addChangeListener((event) => {
  if (event.type === Blockly.Events.CLICK && "blockId" in event) {
    const blockId = typeof event.blockId === "string" ? event.blockId : null;
    const slotId = blockId ? slotIdFromBlock(workspace.getBlockById(blockId)) : null;
    if (slotId) controller.armSlot(slotId);
  }
  if (event.type !== Blockly.Events.FINISHED_LOADING) {
    controller.notifyChange();
  }
});

let blocklySkeletonKey = "";
let blocklySlotSignature = "";
let ephemeralTreeHighlight: TreeHighlightState | null = null;
let lastActiveExampleId: string | null = null;

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
bind("btn-save-project", () => controller.saveProject());
bind("btn-export-project", () => controller.exportProject());
bind("btn-import-project", () => controller.importProject());
bind("btn-copy-ai", () => controller.copyAiPrompt());
bind("btn-import-ai", () => controller.importAiSuggestionsFromClipboard());

controller.subscribe(render);

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
    schemaTreeEl.textContent = "Load a JSON schema file.";
  }

  renderExampleTabs(s);

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
