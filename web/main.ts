import * as Blockly from "blockly/core";
import { createHostAdapter } from "../src/host/create_host.ts";
import { WorkbenchController } from "../src/workbench/controller.ts";
import {
  renderSchemaTree,
  renderInstanceTree,
  applyTreeHighlights,
  parseSourceDragPayload,
  getActiveSourceDrag,
} from "../src/workbench/tree_views.ts";
import type { TreeHighlightState } from "../src/workbench/tree_views.ts";
import type { BlockSvg } from "blockly/core";
import { canonicalSyncPath } from "../src/core/source/schema_loader.ts";
import { getSourceFormatHandler } from "../src/core/source/mod.ts";
import {
  createReadonlyEditor,
  createTextEditor,
  detectEditorLanguage,
  languageForExportTarget,
  setEditorDoc,
} from "../src/workbench/codemirror_setup.ts";
import {
  createMappingSpecEditor,
  mappingSpecDocumentText,
  setMappingSpecFromBlockly,
  scrollMappingSpecToBlock,
  type SpecChrome,
} from "../src/workbench/mapping_spec/mod.ts";
import {
  initBlocklyGenerators,
  loadSkeletonIntoWorkspace,
  lockWorkspaceRootsExpanded,
  setAllBlocksCollapsed,
  applyModelExpressions,
  applyModelLoops,
  attachOptionalRmChild,
  highlightListeningSlot,
  slotIdFromBlock,
  listeningTargetFromBlock,
  owningValueSlotId,
  warningTextOf,
  createModestTheme,
  buildDemoToolbox,
  setOptionalRmMutatorChangeHandler,
  openBlockMutator,
  composeOptionalRmExtras,
  workspaceToModelJson,
  placeSourceQueryBlock,
  sourceReturnTypeFromSchemaType,
  applyEventRmType,
  isEventFamilyType,
  workspacePositionFromClient,
  registerCompactThrasosRenderer,
  openWorkspaceSnapshotWindow,
  relabelWorkspaceFromSkeleton,
  ensureDefaultsBlock,
  findDefaultsBlock,
  hydrateDefaultsMapArgument,
  serializeDefaultsMapArgument,
  setDefaultsMapPickHandler,
  setDefaultsMapInfoHandler,
} from "../src/blockly/mod.ts";
import { attachWorkspaceMinimap } from "../src/blockly/minimap.ts";
import { installBlocklyFloatingOverlays } from "../src/blockly/floating_overlays.ts";
import { installAnchoredMenu } from "../src/ui/anchored_menu.ts";
import { runWithoutBlocklyEvents } from "../src/blockly/blockly_events.ts";
import { refreshWorkspaceConstraints } from "../src/blockly/block_constraints.ts";
import {
  optionalRmInputName,
  presentAttributeNames,
  rmAttributeInputName,
  rmTypeOfBlock,
} from "../src/blockly/blocks/rm_blocks.ts";
import { slotRmTypeForAttr } from "../src/blockly/rm_type_emoji.ts";
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
import { installInfoTips, openInfoTipAt } from "../src/ui/info_tip.ts";
import { installUrlLoadUi } from "../src/ui/url_load.ts";
import { installImportAiDialog } from "../src/ui/import_ai.ts";
import { DEFAULT_GITHUB_TEMPLATE_URL } from "../src/core/clinical_model/github_template.ts";
import { DEFAULT_GITHUB_EXAMPLES_URL } from "../src/core/source/github_examples.ts";
import {
  EHRTSLIB_EXAMPLE_SETS_CATALOG_URL,
  type ExampleSet,
  type ExampleSetCatalog,
} from "../src/core/example_sets/mod.ts";
import { formatSaveTime } from "../src/core/persistence/mod.ts";
import { collectValueSlots } from "../src/core/skeleton/generate_skeleton.ts";
import { createIndexedDbDefaultsCatalog, mapBlockFromDefaultsJson, migrateMapsCreateWithJson } from "../src/core/defaults/mod.ts";
import {
  buildHandlebarsPath,
  buildHandlebarsTree,
} from "../src/core/output/handlebars_dialect.ts";
import {
  createBetterFormBridge,
  probeBetterRenderer,
  type BetterFormBridge,
} from "../src/core/output/better_form_bridge.ts";
import {
  isTestMode,
  type IntehrgratorTestApi,
  type WorkbenchTestSnapshot,
} from "../src/ui_test/test_api.ts";

const host = createHostAdapter();
const controller = new WorkbenchController(host, { urlStorage: localStorage });
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
const blocklyMount = document.getElementById("blockly-mount")!;
const statusMain = document.getElementById("status-main")!;
const statusSave = document.getElementById("status-save")!;
const statusBuild = document.getElementById("status-build")!;
const targetFormatBadge = document.getElementById("target-format-badge")!;
const exportTargetSelect = document.getElementById("export-target") as HTMLSelectElement;
const mappingJsonTab = document.getElementById("tab-mapping-json") as HTMLButtonElement;
const handlebarsTab = document.getElementById("tab-handlebars") as HTMLButtonElement;
const downloadSpecBtn = document.getElementById("btn-download-spec") as HTMLButtonElement;
const uploadSpecBtn = document.getElementById("btn-upload-spec") as HTMLButtonElement;
const mappingJsonHost = document.getElementById("spec-editor")!;
const handlebarsHost = document.getElementById("handlebars-editor")!;

const dialogSaveAs = document.getElementById("dialog-save-as") as HTMLDialogElement;
const saveAsNameInput = document.getElementById("save-as-name") as HTMLInputElement;
const dialogLoadProject = document.getElementById("dialog-load-project") as HTMLDialogElement;
const loadProjectList = document.getElementById("load-project-list")!;
const dialogDefaultsMap = document.getElementById("dialog-defaults-map") as HTMLDialogElement;
const defaultsMapList = document.getElementById("defaults-map-list")!;
const dialogDefaultsSaveAs = document.getElementById("dialog-defaults-save-as") as HTMLDialogElement;
const defaultsSaveAsNameInput = document.getElementById("defaults-save-as-name") as HTMLInputElement;
const defaultsMapUrlInput = document.getElementById("defaults-map-url-input") as HTMLInputElement;
const defaultsCatalog = createIndexedDbDefaultsCatalog();

const specEditor = createMappingSpecEditor(mappingJsonHost, {
  onFieldEdit: (blockId, field, value) => {
    const block = workspace?.getBlockById(blockId);
    if (!block) return;
    block.setFieldValue(value, field);
    // Workspace change listener runs syncFromBlockly → Spec refresh.
  },
  onSelect: (blockId) => applyBlockSelection(blockId, "spec"),
});
let updatingHandlebarsEditor = false;
const handlebarsEditor = createTextEditor(handlebarsHost, (text) => {
  if (!updatingHandlebarsEditor) controller.setHandlebarsTemplate(text);
}, "handlebars");
let activeTextView: "mapping-json" | "handlebars" = "mapping-json";
type HandlebarsInsertMode = "flat" | "tree";
const handlebarsInsertToolbar = document.getElementById("handlebars-insert-toolbar");

function currentHandlebarsInsertMode(): HandlebarsInsertMode {
  const selected = document.querySelector(
    'input[name="hbs-insert-mode"]:checked',
  ) as HTMLInputElement | null;
  return selected?.value === "tree" ? "tree" : "flat";
}

const exportEditor = createReadonlyEditor(
  document.getElementById("export-editor")!,
  "",
  "typescript",
);
const testOutputEditor = createReadonlyEditor(
  document.getElementById("test-output")!,
  "",
  "json",
);

/** Set in boot() after locale + inject. */
let workspace!: Blockly.WorkspaceSvg;
let blocklyLocale = detectLocale();
let selectedBlockId: string | null = null;
let applyingSelection = false;
let blocklySkeletonKey = "";
let blocklyLabelLanguage = "";
let blocklySlotSignature = "";
let toolboxKey = "";
let ephemeralTreeHighlight: TreeHighlightState | null = null;
let lastActiveExampleId: string | null = null;

function showTextView(view: "mapping-json" | "handlebars"): void {
  activeTextView = view;
  const showHandlebars = view === "handlebars";
  mappingJsonHost.hidden = showHandlebars;
  handlebarsHost.hidden = !showHandlebars;
  mappingJsonTab.classList.toggle("active", !showHandlebars);
  handlebarsTab.classList.toggle("active", showHandlebars);
  if (handlebarsInsertToolbar) handlebarsInsertToolbar.hidden = !showHandlebars;
  downloadSpecBtn.hidden = showHandlebars;
  if (uploadSpecBtn) uploadSpecBtn.hidden = showHandlebars;
}

mappingJsonTab.addEventListener("click", () => showTextView("mapping-json"));
handlebarsTab.addEventListener("click", () => showTextView("handlebars"));
downloadSpecBtn.addEventListener("click", () => controller.exportBlocklyDefinition());
uploadSpecBtn?.addEventListener("click", () => void controller.importBlocklyDefinition());
exportTargetSelect.addEventListener("change", () => {
  const target = exportTargetSelect.value as
    | "preview"
    | "typescript"
    | "java"
    | "handlebars"
    | "xquery";
  controller.setExportTarget(target);
  if (target === "handlebars") showTextView("handlebars");
});

function setupUiLanguageMenu(locale: IntehrLocale): void {
  const labelEl = document.getElementById("ui-language-label");
  const select = document.getElementById("ui-language-dropdown") as HTMLSelectElement | null;
  if (!select) return;
  if (labelEl) labelEl.textContent = msg(locale).UI_LANGUAGE_LABEL;
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

function setupModelLanguageMenu(): void {
  const wrap = document.getElementById("model-language-wrap");
  const labelEl = document.getElementById("model-language-label");
  const select = document.getElementById("model-language-dropdown") as HTMLSelectElement | null;
  if (!wrap || !select) return;
  if (labelEl) labelEl.textContent = msg(blocklyLocale).MODEL_LANGUAGE_LABEL;
  select.addEventListener("change", () => {
    controller.setModelLanguage(select.value);
  });
}

function syncModelLanguageMenu(s: ReturnType<WorkbenchController["getState"]>): void {
  const wrap = document.getElementById("model-language-wrap");
  const select = document.getElementById("model-language-dropdown") as HTMLSelectElement | null;
  if (!wrap || !select) return;
  const languages = s.modelLanguages ?? [];
  const multilingual = languages.length > 1;
  wrap.hidden = !multilingual;
  if (!multilingual) return;
  const current = s.modelLanguage ?? languages[0] ?? "";
  const same =
    select.options.length === languages.length &&
    languages.every((lang, i) => select.options[i]?.value === lang) &&
    select.value === current;
  if (same) return;
  select.replaceChildren();
  for (const lang of languages) {
    const opt = document.createElement("option");
    opt.value = lang;
    opt.textContent = displayLanguageName(lang);
    if (lang === current) opt.selected = true;
    select.appendChild(opt);
  }
}

function displayLanguageName(code: string): string {
  try {
    const display = new Intl.DisplayNames([blocklyLocale, "en"], { type: "language" });
    return display.of(code) ?? code;
  } catch {
    return code;
  }
}

async function bootBlockly(): Promise<void> {
  const locale = detectLocale();
  blocklyLocale = locale;
  await loadBlocklyLocale(locale);
  initBlocklyGenerators();
  setupUiLanguageMenu(locale);
  setupModelLanguageMenu();

  workspace = Blockly.inject(blocklyMount, {
    theme: createModestTheme(),
    toolbox: buildDemoToolbox(locale),
    collapse: true,
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
    renderer: registerCompactThrasosRenderer(),
  });
  installBlocklyFloatingOverlays();

  const loadOnce = takeLoadOnceBlocks();
  if (loadOnce) {
    migrateMapsCreateWithJson(loadOnce);
    Blockly.serialization.workspaces.load(loadOnce, workspace);
    lockWorkspaceRootsExpanded(workspace);
  }
  runWithoutBlocklyEvents(() => {
    ensureDefaultsBlock(workspace, blocklyLocale);
  });

  setDefaultsMapPickHandler(() => {
    void openDefaultsMapDialog();
  });
  setDefaultsMapInfoHandler((anchor) => {
    const tip = document.getElementById("defaults-map-block-info");
    if (!(tip instanceof HTMLElement)) return;
    openInfoTipAt(tip, anchor ?? tip.querySelector(".info-tip-btn") ?? tip);
  });

  attachWorkspaceMinimap(workspace, blocklyMount);

  setOptionalRmMutatorChangeHandler((change) => {
    const slotId = change.parent.getFieldValue("SLOT_ID") || "";
    const rmType = rmTypeOfBlock(change.parent);
    for (const name of change.removed) {
      if (slotId) controller.removeOptionalRm(slotId, name);
    }
    for (const name of change.added) {
      const present = presentAttributeNames(change.parent).filter((attr) => attr !== name);
      const options = controller.getOptionalAttachmentsFor(rmType, slotId, present);
      const picked = options.find((option) => option.attributeName === name) ?? {
        attributeName: name,
        rmType: slotRmTypeForAttr(rmType, name) || name,
        label: name,
        cardinality: { min: 0, max: 1 },
      };
      if (slotId) controller.addOptionalRm(slotId, picked.rmType, name);
      const input = change.parent.getInput(optionalRmInputName(name)) ??
        change.parent.getInput(rmAttributeInputName(name));
      if (!input?.connection?.targetBlock()) {
        attachOptionalRmChild(workspace, change.parent, picked);
      }
    }
  });

  workspace.configureContextMenu = (options) => {
    const selected = Blockly.getSelected?.() as { firePlusClick?: () => void } | null;
    if (selected?.firePlusClick) {
      options.push({
        text: "Optional attributes…",
        enabled: true,
        callback: () => openBlockMutator(selected as Blockly.Block),
      });
    }
    options.push({
      text: "Open canvas snapshot…",
      enabled: workspace.getTopBlocks(false).length > 0,
      callback: () => openCanvasSnapshot(),
    });
  };

  initSplitPanes(document, () => Blockly.svgResize(workspace));
  controller.setBlocklyStateGetter(() => Blockly.serialization.workspaces.save(workspace));
  initBlocklySourceDrop();

  workspace.addChangeListener((event) => {
    if (event.type === Blockly.Events.CLICK) {
      const blockId = "blockId" in event && typeof event.blockId === "string"
        ? event.blockId
        : null;
      applyBlockSelection(blockId, "blockly");
      return;
    }
    if (
      event.type === Blockly.Events.BLOCK_CHANGE &&
      "name" in event &&
      event.name === "RM_TYPE" &&
      "blockId" in event &&
      typeof event.blockId === "string"
    ) {
      const block = workspace.getBlockById(event.blockId);
      const next = String((event as { newValue?: unknown }).newValue ?? "");
      if (block && (isEventFamilyType(next) || next === "EVENT")) {
        applyEventRmType(block, next);
      }
    }
    if (event.type !== Blockly.Events.FINISHED_LOADING && !event.isUiEvent) {
      refreshWorkspaceConstraints(workspace);
    }
    if (event.type === Blockly.Events.FINISHED_LOADING || event.isUiEvent) return;
    const derived = workspaceToModelJson(workspace);
    controller.syncFromBlockly(
      Blockly.serialization.workspaces.save(workspace),
      derived.slots,
      derived.loops,
    );
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

function handleSourceSelection(
  path: string,
  format: string,
  event?: { shiftKey?: boolean },
): void {
  const state = controller.getState();
  if (
    activeTextView === "handlebars" &&
    !state.listeningSlotId &&
    !state.listeningSourceBlockId
  ) {
    let mode = currentHandlebarsInsertMode();
    if (event?.shiftKey) mode = mode === "flat" ? "tree" : "flat";
    const snippet = mode === "tree"
      ? buildHandlebarsTree(path)
      : `{{${buildHandlebarsPath(path)}}}`;
    const selection = handlebarsEditor.state.selection.main;
    handlebarsEditor.dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert: snippet,
      },
      selection: { anchor: selection.from + snippet.length },
    });
    handlebarsEditor.focus();
    return;
  }
  if (state.listeningSourceBlockId) {
    fillListeningSourceQuery(state.listeningSourceBlockId, path, format);
    return;
  }
  controller.bindFromNode(path, format);
}

function persistBlocklyCanvas(): void {
  const derived = workspaceToModelJson(workspace);
  controller.syncFromBlockly(
    Blockly.serialization.workspaces.save(workspace),
    derived.slots,
    derived.loops,
  );
}

function collectConstraintWarnings(): Record<string, string> {
  const warnings: Record<string, string> = {};
  if (!workspace) return warnings;
  for (const block of workspace.getAllBlocks(false)) {
    const text = warningTextOf(block);
    if (text) warnings[block.id] = text;
  }
  return warnings;
}

function specChrome(): SpecChrome {
  return {
    warnings: collectConstraintWarnings(),
    selectedBlockId,
  };
}

function panToBlock(block: BlockSvg): void {
  const ws = workspace as Blockly.WorkspaceSvg & {
    centerOnBlock?: (id: string) => void;
  };
  if (typeof ws.centerOnBlock === "function" && block.id) {
    ws.centerOnBlock(block.id);
    return;
  }
  if (typeof block.getRelativeToSurfaceXY === "function" && typeof ws.scroll === "function") {
    const xy = block.getRelativeToSurfaceXY();
    const metrics = typeof ws.getMetrics === "function" ? ws.getMetrics() : null;
    if (metrics) {
      ws.scroll(
        xy.x - metrics.viewWidth / 2 + metrics.absoluteLeft,
        xy.y - metrics.viewHeight / 2 + metrics.absoluteTop,
      );
    }
  }
}

function applyBlockSelection(blockId: string | null, origin: "blockly" | "spec"): void {
  if (applyingSelection) return;
  applyingSelection = true;
  try {
    selectedBlockId = blockId;
    const block = blockId ? workspace.getBlockById(blockId) : null;
    if (origin === "spec" && block) {
      if (typeof (block as BlockSvg).select === "function") {
        (block as BlockSvg).select();
      }
      panToBlock(block as BlockSvg);
    }
    if (origin === "blockly" && blockId) {
      scrollMappingSpecToBlock(specEditor, blockId);
    }
    setMappingSpecFromBlockly(
      specEditor,
      Blockly.serialization.workspaces.save(workspace),
      specChrome(),
    );
    if (block) {
      const target = listeningTargetFromBlock(block);
      if (target?.kind === "slot") controller.armSlot(target.slotId);
      else if (target?.kind === "source_block") {
        controller.armSourceQueryBlock(target.blockId);
      } else if (
        controller.getState().listeningSlotId ||
        controller.getState().listeningSourceBlockId
      ) {
        controller.clearListening();
      }
    } else if (
      controller.getState().listeningSlotId ||
      controller.getState().listeningSourceBlockId
    ) {
      controller.clearListening();
    }
  } finally {
    applyingSelection = false;
  }
}

function fillListeningSourceQuery(blockId: string, path: string, format: string): void {
  const block = workspace.getBlockById(blockId);
  if (!block) {
    controller.clearListening();
    return;
  }
  const xpath = getSourceFormatHandler(format).pathToExpression(path);
  block.setFieldValue(xpath, "EXPRESSION");
  persistBlocklyCanvas();
  controller.clearListening();
  controller.setStatusMessage(`Mapped source query ${xpath}`);
}

function applyPendingDefaultsMap(): void {
  const pending = controller.consumePendingDefaultsMap();
  if (!pending) return;
  runWithoutBlocklyEvents(() => {
    hydrateDefaultsMapArgument(workspace, pending, blocklyLocale);
  });
  persistBlocklyCanvas();
}

function syncToolbox(s: ReturnType<WorkbenchController["getState"]>): void {
  const key = `${s.target?.format ?? ""}|${s.templateId}|${s.skeleton.length}|${s.modelLanguage ?? ""}`;
  if (key === toolboxKey) return;
  toolboxKey = key;
  workspace.updateToolbox(buildDemoToolbox(blocklyLocale, {
    targetFormat: s.target?.format,
    skeleton: s.skeleton,
  }));
}

function syncBlocklyWorkspace(s: ReturnType<WorkbenchController["getState"]>): void {
  if (!workspace) return;
  syncToolbox(s);
  if (!s.templateId && !s.blocklyState) {
    blocklySkeletonKey = "";
    blocklyLabelLanguage = "";
    blocklySlotSignature = "";
    runWithoutBlocklyEvents(() => {
      ensureDefaultsBlock(workspace, blocklyLocale);
    });
    applyPendingDefaultsMap();
    return;
  }
  if (!s.templateId || !s.skeleton.length) {
    if (!(s.blocklyState && typeof s.blocklyState === "object" && s.blocklyReloadToken)) {
      blocklySkeletonKey = "";
      blocklyLabelLanguage = "";
      blocklySlotSignature = "";
      runWithoutBlocklyEvents(() => {
        ensureDefaultsBlock(workspace, blocklyLocale);
      });
      applyPendingDefaultsMap();
      return;
    }
  }

  const skeletonKey = `${s.projectId}|${s.templateId}|${s.skeleton.length}|${s.blocklyReloadToken}`;
  const slotSignature = [
    ...s.model.slots.map((slot) => `${slot.slotId}=${slot.expression}`),
    ...(s.model.loops ?? []).map((loop) =>
      `loop:${loop.attachSlotId}=${loop.varName}@${loop.path}`
    ),
  ].join("|");
  const labelLanguage = s.modelLanguage ?? "";

  if (skeletonKey !== blocklySkeletonKey) {
    if (s.blocklyState && typeof s.blocklyState === "object") {
      const savedState = s.blocklyState;
      runWithoutBlocklyEvents(() => {
        workspace.clear();
        migrateMapsCreateWithJson(savedState);
        Blockly.serialization.workspaces.load(savedState, workspace);
        if (!findDefaultsBlock(workspace)) ensureDefaultsBlock(workspace, blocklyLocale);
        applyModelLoops(workspace, s.model);
        refreshWorkspaceConstraints(workspace);
        relabelWorkspaceFromSkeleton(workspace, s.skeleton);
      });
      lockWorkspaceRootsExpanded(workspace);
      blocklySkeletonKey = skeletonKey;
      blocklyLabelLanguage = labelLanguage;
      blocklySlotSignature = slotSignature;
      const derived = workspaceToModelJson(workspace);
      if (s.blocklyReloadToken > 0) {
        controller.syncFromBlockly(
          Blockly.serialization.workspaces.save(workspace),
          derived.slots,
          derived.loops,
        );
      }
      applyPendingDefaultsMap();
      return;
    } else {
      loadSkeletonIntoWorkspace(workspace, s.skeleton, s.model, s.listeningSlotId, blocklyLocale);
    }
    blocklySkeletonKey = skeletonKey;
    blocklyLabelLanguage = labelLanguage;
    blocklySlotSignature = slotSignature;
    applyPendingDefaultsMap();
    return;
  }

  if (labelLanguage !== blocklyLabelLanguage) {
    runWithoutBlocklyEvents(() => {
      relabelWorkspaceFromSkeleton(workspace, s.skeleton);
    });
    blocklyLabelLanguage = labelLanguage;
    toolboxKey = "";
    syncToolbox(s);
  }

  if (slotSignature !== blocklySlotSignature) {
    applyModelExpressions(workspace, s.model);
    blocklySlotSignature = slotSignature;
    // applyModelExpressions suppresses Blockly events, so the usual
    // change-listener → syncFromBlockly → refreshDerived path never runs.
    // Snapshot the updated canvas so Generated conversion script(s) picks
    // up Import Suggestions / Spec edits that only changed the Mapping Model.
    controller.syncCanvasSnapshot(Blockly.serialization.workspaces.save(workspace));
  }

  highlightListeningSlot(workspace, s.listeningSlotId, s.listeningSourceBlockId);
  applyPendingDefaultsMap();
}

function bind(id: string, handler: () => void | Promise<void>): void {
  document.getElementById(id)?.addEventListener("click", () => void handler());
}

function requireEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

installInfoTips();
installUrlLoadUi({
  dialog: requireEl<HTMLDialogElement>("dialog-load-url"),
  title: requireEl("load-url-title"),
  hint: requireEl("load-url-hint"),
  input: requireEl<HTMLInputElement>("load-url-input"),
  error: requireEl("load-url-error"),
  history: requireEl("load-url-history"),
  historyHeading: requireEl("load-url-history-heading"),
  cancel: requireEl<HTMLButtonElement>("load-url-cancel"),
  storage: localStorage,
  kinds: {
    schema: {
      main: requireEl<HTMLButtonElement>("btn-load-schema"),
      chevron: requireEl<HTMLButtonElement>("btn-load-schema-menu"),
      menu: requireEl("menu-load-schema"),
      fromFile: () => controller.loadSchema(),
      fromUrl: (url) => controller.loadSchemaFromUrl(url),
      title: "Load schema from URL",
      hint: "JSON, XML, XSD, or a GitHub .t.json template (archetypes are fetched from the same repo). GitHub file pages are converted to raw content.",
      placeholder: "https://raw.githubusercontent.com/…/schema.json",
      historyHeading: "Recent schema URLs",
      github: {
        label: "From GitHub template…",
        title: "Load openEHR template from GitHub",
        hint: "Paste a GitHub blob or raw URL to a Better .t.json (or .adl / .opt). Dependent archetypes are pulled from the same repository branch.",
        placeholder: DEFAULT_GITHUB_TEMPLATE_URL,
      },
    },
    example: {
      main: requireEl<HTMLButtonElement>("btn-add-example"),
      chevron: requireEl<HTMLButtonElement>("btn-add-example-menu"),
      menu: requireEl("menu-add-example"),
      fromFile: () => controller.addExample(),
      fromUrl: (url) => controller.addExampleFromUrl(url),
      fromGitHubDirectory: (url) => controller.addExamplesFromGitHubDirectory(url),
      title: "Add example from URL",
      hint: "JSON or XML instance. GitHub file pages are converted to raw content.",
      placeholder: "https://raw.githubusercontent.com/…/example.json",
      historyHeading: "Recent example URLs",
      bulkLocal: {
        label: "From local folder…",
        fromDirectory: () => controller.addExamplesFromLocalDirectory(),
      },
      bulkGitHubDir: {
        label: "From GitHub folder…",
        title: "Add examples from GitHub folder",
        hint: "Paste a GitHub tree URL to a folder. All JSON and XML files under that path are loaded.",
        placeholder: DEFAULT_GITHUB_EXAMPLES_URL,
      },
    },
    target: {
      main: requireEl<HTMLButtonElement>("btn-open-template"),
      chevron: requireEl<HTMLButtonElement>("btn-open-template-menu"),
      menu: requireEl("menu-open-template"),
      fromFile: () => controller.openTemplate(),
      fromUrl: (url) => controller.openTemplateFromUrl(url),
      title: "Open target from URL",
      hint: "OPT, Web Template, JSON Schema, or a GitHub .t.json. GitHub file pages are converted to raw content.",
      placeholder: "https://github.com/Ehrlibs/openEHR-model-examples/blob/main/local/…",
      historyHeading: "Recent target URLs",
      github: {
        label: "From GitHub template…",
        title: "Open openEHR template from GitHub",
        hint: "Paste a GitHub blob or raw URL to a Better .t.json (or .adl / .opt). Dependent archetypes are pulled from the same repository branch.",
        placeholder: DEFAULT_GITHUB_TEMPLATE_URL,
      },
    },
  },
});

bind("btn-expand-all", () => {
  setAllBlocksCollapsed(workspace, false);
  Blockly.svgResize(workspace);
});
bind("btn-collapse-all", () => {
  setAllBlocksCollapsed(workspace, true);
  Blockly.svgResize(workspace);
});
bind("btn-open-canvas", () => openCanvasSnapshot());
bind("btn-download-blockly", () => controller.exportBlocklyDefinition());

function openCanvasSnapshot(): void {
  const state = controller.getState();
  const filenameBase = (state.templateId || "mapping-canvas").replace(/[^A-Za-z0-9._-]+/g, "-");
  const title = state.templateId
    ? `intEHRgrator — ${state.templateId}`
    : "intEHRgrator — Mapping canvas";
  const popup = openWorkspaceSnapshotWindow(workspace, {
    title,
    filenameBase,
    onBlocked: (svgXml, base) => {
      if (svgXml) void host.downloadText(`${base}.svg`, svgXml, "image/svg+xml");
      statusMain.textContent = svgXml
        ? "Popup blocked — downloaded SVG instead."
        : "Popup blocked and the canvas is empty.";
    },
  });
  if (popup) statusMain.textContent = "Opened mapping canvas snapshot.";
}
bind("btn-run-test", () => {
  controller.runTestNow();
  const result = controller.getState().testResult;
  if (result?.ok && result.output !== undefined) {
    betterFormBridge?.pushComposition(result.output);
  }
});
bind("btn-autoplay", () => controller.toggleAutoplay());
bind("btn-export-ts", () => controller.exportTypeScript());
bind("btn-download-test-output", () => controller.exportTestOutput());
bind("btn-better-form", () => {
  if (!betterFormBridge?.available) {
    statusMain.textContent =
      "Better Form Renderer not installed. Run: deno task setup:better-forms";
    return;
  }
  betterFormBridge.openViewer();
  const result = controller.getState().testResult;
  if (result?.output !== undefined) betterFormBridge.pushComposition(result.output);
});
bind("btn-new-project", () => void handleNewProject());
bind("btn-load-project", () => void openLoadProjectDialog());
bind("btn-save-project", () => openSaveAsDialog());
bind("btn-export-project", () => controller.exportProject());
bind("btn-import-project", () => controller.importProject());
bind("btn-copy-ai", () => controller.copyAiPrompt(lastAiDelivery()));
installImportAiDialog({
  dialog: requireEl<HTMLDialogElement>("dialog-import-ai"),
  textarea: requireEl<HTMLTextAreaElement>("import-ai-text"),
  report: requireEl("import-ai-report"),
  cancel: requireEl<HTMLButtonElement>("import-ai-cancel"),
  clipboard: requireEl<HTMLButtonElement>("import-ai-clipboard"),
  copyErrors: requireEl<HTMLButtonElement>("import-ai-copy-errors"),
  openButton: requireEl<HTMLButtonElement>("btn-import-ai"),
  formatDocUrl: host.resolveAppUrl("docs/AI_SUGGESTION_FORMAT.md"),
  readClipboard: () => controller.readClipboardText(),
  copyToClipboard: (text) => host.copyToClipboard(text),
  importText: (text) => controller.importAiSuggestions(text),
});
installCopyAiMenu();
installExampleSetsMenu();

function lastAiDelivery(): "inline" | "attach" | "uri" {
  const raw = localStorage.getItem("intehrgrator.aiDelivery");
  if (raw === "attach" || raw === "uri" || raw === "inline") return raw;
  return "inline";
}

function installCopyAiMenu(): void {
  const chevron = document.getElementById("btn-copy-ai-menu");
  const main = document.getElementById("btn-copy-ai");
  const menu = document.getElementById("menu-copy-ai");
  if (!(chevron instanceof HTMLButtonElement) || !(main instanceof HTMLButtonElement) || !menu) return;

  const handle = installAnchoredMenu({
    menu,
    trigger: chevron,
    roots: [main],
    referenceEls: [main, chevron],
    minWidth: main.parentElement ?? chevron,
  });

  menu.querySelectorAll<HTMLButtonElement>("[data-ai-delivery]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const delivery = btn.dataset.aiDelivery;
      if (delivery !== "inline" && delivery !== "attach" && delivery !== "uri") return;
      localStorage.setItem("intehrgrator.aiDelivery", delivery);
      handle.close();
      void controller.copyAiPrompt(delivery);
    });
  });
}

function installExampleSetsMenu(): void {
  const chevron = document.getElementById("btn-example-sets-menu");
  const main = document.getElementById("btn-example-sets");
  const menu = document.getElementById("menu-example-sets");
  if (!(chevron instanceof HTMLButtonElement) || !(main instanceof HTMLButtonElement) || !menu) {
    return;
  }

  let catalog: ExampleSetCatalog | null = null;
  let catalogUrl: string | null = null;
  let loading = false;
  let handle: ReturnType<typeof installAnchoredMenu> | null = null;

  const appendItem = (
    label: string,
    onClick: () => void,
    className = "split-btn-menu-item",
    disabled = false,
  ) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.role = "menuitem";
    btn.textContent = label;
    btn.disabled = disabled;
    if (!disabled) {
      btn.addEventListener("click", () => {
        handle?.close();
        onClick();
      });
    }
    menu.append(btn);
    return btn;
  };

  const confirmReplace = (): boolean => {
    if (!controller.hasWorkspaceContent()) return true;
    return confirm(
      "Load this example set? The current workspace will be replaced. Unsaved changes may be lost.",
    );
  };

  const loadSet = (set: ExampleSet) => {
    if (!confirmReplace()) return;
    void (async () => {
      try {
        await controller.loadExampleSet(set);
      } catch {
        // Status bar already has the error.
      }
    })();
  };

  const renderMenu = () => {
    menu.replaceChildren();
    if (loading) {
      appendItem("Loading catalog…", () => {}, "split-btn-menu-item", true);
      return;
    }
    if (catalog?.sets.length) {
      const heading = document.createElement("div");
      heading.className = "split-btn-menu-heading";
      heading.textContent = "Example sets";
      menu.append(heading);
      for (const set of catalog.sets) {
        const item = appendItem(set.title, () => loadSet(set));
        item.dataset.exampleSetId = set.id;
        if (set.description) item.title = set.description;
      }
    } else {
      appendItem("No example sets in catalog", () => {}, "split-btn-menu-item", true);
    }
    const catalogHeading = document.createElement("div");
    catalogHeading.className = "split-btn-menu-heading";
    catalogHeading.textContent = "Catalog";
    menu.append(catalogHeading);
    appendItem("Bundled dummy catalog", () => {
      void fetchCatalog();
    });
    appendItem("ehrtslib catalog (GitHub)…", () => {
      void fetchCatalog(EHRTSLIB_EXAMPLE_SETS_CATALOG_URL);
    });
    appendItem("Load catalog from URL…", () => {
      const next = prompt(
        "Example-set catalog JSON URL",
        catalogUrl ?? EHRTSLIB_EXAMPLE_SETS_CATALOG_URL,
      );
      if (!next?.trim()) return;
      void fetchCatalog(next.trim());
    });
    handle?.refresh();
  };

  const fetchCatalog = async (url?: string) => {
    loading = true;
    renderMenu();
    try {
      catalog = await controller.loadExampleSetCatalog(url);
      catalogUrl = catalog.catalogUrl;
    } catch {
      // Keep the previous catalog, if any; status bar already has the error.
    } finally {
      loading = false;
      if (handle?.isOpen()) renderMenu();
    }
  };

  handle = installAnchoredMenu({
    menu,
    trigger: chevron,
    roots: [main],
    referenceEls: [main, chevron],
    minWidth: main.parentElement ?? chevron,
    onBeforeOpen: () => {
      renderMenu();
      if (!catalog && !loading) void fetchCatalog();
    },
  });

  main.addEventListener("click", (event) => {
    event.stopPropagation();
    if (handle?.isOpen()) handle.close();
    else handle?.open();
  });
}

let betterFormBridge: BetterFormBridge | null = null;
void probeBetterRenderer((path) => host.resolveAppUrl(path)).then((available) => {
  betterFormBridge = createBetterFormBridge(
    { resolveAppUrl: (path) => host.resolveAppUrl(path) },
    available,
  );
  const btn = document.getElementById("btn-better-form") as HTMLButtonElement | null;
  if (btn) btn.hidden = !available;
});

initFileDropTargets();

/** Drop Source Pane paths onto Blockly: value-slot mapping, or a free source block. */
function initBlocklySourceDrop(): void {
  let lastAppliedAt = 0;
  let lastAppliedPath = "";
  const applyPayloadAtPoint = (
    payload: { path: string; format: string; schemaType?: string },
    clientX: number,
    clientY: number,
  ): boolean => {
    // Prefer the mount's box over elementFromPoint: Blockly SVG / widget
    // layers can sit outside the hit target, and synthetic Playwright drops
    // have no real pointer.
    const mountRect = blocklyMount.getBoundingClientRect();
    const inMount = clientX >= mountRect.left && clientX <= mountRect.right &&
      clientY >= mountRect.top && clientY <= mountRect.bottom;
    if (!inMount) return false;
    const now = Date.now();
    if (payload.path === lastAppliedPath && now - lastAppliedAt < 250) return true;
    lastAppliedPath = payload.path;
    lastAppliedAt = now;
    try {
      const slotId = findSlotIdAtPoint(clientX, clientY);
      if (slotId) {
        controller.mapNodeToSlot(slotId, payload.path, payload.format);
        return true;
      }
      placeSourceBlockFromDrop(payload, clientX, clientY);
      return true;
    } catch (err) {
      statusMain.textContent = err instanceof Error ? err.message : String(err);
      return false;
    }
  };

  const onDragOver = (event: DragEvent) => {
    if (!parseSourceDragPayload(event.dataTransfer) && !getActiveSourceDrag()) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  };
  const onDrop = (event: DragEvent) => {
    const payload = parseSourceDragPayload(event.dataTransfer);
    if (!payload) return;
    event.preventDefault();
    applyPayloadAtPoint(payload, event.clientX, event.clientY);
  };
  // Blockly's SVG does not reliably receive HTML5 drop. dragend still has
  // client coordinates, so finish the gesture from the pointer position.
  document.addEventListener("dragend", (event) => {
    const payload = getActiveSourceDrag();
    if (!payload) return;
    applyPayloadAtPoint(payload, event.clientX, event.clientY);
  }, true);

  const opts = { capture: true };
  blocklyMount.addEventListener("dragenter", onDragOver, opts);
  blocklyMount.addEventListener("dragover", onDragOver, opts);
  blocklyMount.addEventListener("drop", onDrop, opts);
}

function placeSourceBlockFromDrop(
  payload: { path: string; format: string; schemaType?: string },
  clientX: number,
  clientY: number,
): void {
  const xpath = getSourceFormatHandler(payload.format).pathToExpression(payload.path);
  const schemaType = controller.lookupSourceSchemaType(payload.path) ?? payload.schemaType;
  const returnType = sourceReturnTypeFromSchemaType(schemaType);
  const { x, y } = workspacePositionFromClient(workspace, clientX, clientY);
  placeSourceQueryBlock(workspace, xpath, returnType, x, y);
  controller.setStatusMessage(`Added source ${xpath}`);
}

function findSlotIdAtPoint(clientX: number, clientY: number): string | null {
  let best: { slotId: string; area: number } | null = null;
  for (const block of workspace.getAllBlocks(false)) {
    const svg = block as BlockSvg;
    const root = typeof svg.getSvgRoot === "function" ? svg.getSvgRoot() : null;
    if (!root) continue;
    const rect = root.getBoundingClientRect();
    if (
      clientX < rect.left || clientX > rect.right ||
      clientY < rect.top || clientY > rect.bottom
    ) {
      continue;
    }
    let slotId = slotIdFromBlock(block);
    if (!slotId) slotId = owningValueSlotId(block);
    if (!slotId) continue;
    const area = rect.width * rect.height;
    if (!best || area < best.area) best = { slotId, area };
  }
  return best?.slotId ?? null;
}

function initFileDropTargets(): void {
  initFileDrop(schemaTreeEl, {
    accept: (file) => /\.(json|xml|xsd)$/i.test(file.name),
    multiple: false,
    onDrop: (files) => void (async () => {
      const loaded = await readDroppedTextFiles(files);
      if (loaded[0]) await controller.loadSchemaFromDrop(loaded[0]);
    })(),
    onReject: (names) => {
      controller.reportSchemaDropRejected(
        names.length
          ? `Unsupported schema file (${names.join(", ")}). Use JSON, XML, or XSD.`
          : "No file found in the drop.",
      );
    },
  });
  initFileDrop(exampleTreeEl, {
    accept: (file) => /\.(json|xml)$/i.test(file.name),
    multiple: true,
    onDrop: (files) => void (async () => {
      await controller.addExamplesFromDrop(await readDroppedTextFiles(files));
    })(),
  });
}

async function readDroppedTextFiles(files: File[]) {
  return await Promise.all(files.map(async (file) => ({
    name: file.name,
    text: await file.text(),
  })));
}

function initFileDrop(
  el: HTMLElement,
  options: {
    accept: (file: File) => boolean;
    multiple: boolean;
    onDrop: (files: File[]) => void;
    onReject?: (filenames: string[]) => void;
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
    const dropped = [...event.dataTransfer?.files ?? []];
    const files = dropped.filter(options.accept);
    if (!files.length) {
      options.onReject?.(dropped.map((file) => file.name).filter(Boolean));
      return;
    }
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
  runWithoutBlocklyEvents(() => {
    workspace.clear();
  });
}

async function openDefaultsMapDialog(): Promise<void> {
  defaultsMapList.innerHTML = "";
  if (defaultsMapUrlInput) defaultsMapUrlInput.value = "";
  let entries: Array<{ id: string; displayName: string; savedAt: string }> = [];
  try {
    entries = await defaultsCatalog.list();
  } catch (err) {
    const empty = document.createElement("p");
    empty.className = "load-project-empty";
    empty.textContent = `Defaults catalog unavailable: ${
      err instanceof Error ? err.message : String(err)
    }`;
    defaultsMapList.appendChild(empty);
  }
  if (!entries.length && defaultsMapList.childElementCount === 0) {
    const empty = document.createElement("p");
    empty.className = "load-project-empty";
    empty.textContent = "No saved Defaults Maps yet. Use Save as, Download, Browse file, or a URL.";
    defaultsMapList.appendChild(empty);
  }
  for (const entry of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "load-project-item";
    const kind = document.createElement("span");
    kind.className = "load-project-item-kind";
    kind.textContent = "Saved map";
    const name = document.createElement("strong");
    name.textContent = entry.displayName;
    const when = document.createElement("span");
    when.textContent = formatSaveTime(entry.savedAt);
    button.append(kind, name, when);
    button.addEventListener("click", () => {
      dialogDefaultsMap.close();
      void (async () => {
        const mapBlock = await defaultsCatalog.load(entry.id);
        if (!mapBlock) return;
        hydrateDefaultsMapArgument(workspace, mapBlock, blocklyLocale);
        persistBlocklyCanvas();
      })();
    });
    defaultsMapList.appendChild(button);
  }
  dialogDefaultsMap.showModal();
}

function applyDefaultsMapJson(text: string): void {
  const parsed = JSON.parse(text) as unknown;
  const mapBlock = mapBlockFromDefaultsJson(parsed);
  if (!mapBlock) throw new Error("JSON must be a maps_create_with block or workspace");
  hydrateDefaultsMapArgument(workspace, mapBlock, blocklyLocale);
  persistBlocklyCanvas();
}

document.getElementById("defaults-map-cancel")?.addEventListener("click", () => dialogDefaultsMap.close());
document.getElementById("defaults-map-browse")?.addEventListener("click", () => {
  void (async () => {
    const file = await host.pickTextFile(".json", "defaults");
    if (!file) return;
    dialogDefaultsMap.close();
    try {
      applyDefaultsMapJson(file.text);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  })();
});
document.getElementById("defaults-map-url-load")?.addEventListener("click", () => {
  void (async () => {
    const url = defaultsMapUrlInput?.value.trim() ?? "";
    if (!url) return;
    try {
      const file = await host.fetchTextUrl(url);
      applyDefaultsMapJson(file.text);
      dialogDefaultsMap.close();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  })();
});
document.getElementById("defaults-map-download")?.addEventListener("click", () => {
  try {
    const mapBlock = serializeDefaultsMapArgument(workspace);
    if (!mapBlock) throw new Error("No Defaults Map to download");
    void host.downloadText(
      "defaults.map.json",
      JSON.stringify(mapBlock, null, 2),
      "application/json",
    );
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err));
  }
});
document.getElementById("defaults-map-save-as")?.addEventListener("click", () => {
  defaultsSaveAsNameInput.value = "Defaults";
  dialogDefaultsSaveAs.returnValue = "cancel";
  dialogDefaultsSaveAs.showModal();
  defaultsSaveAsNameInput.focus();
  defaultsSaveAsNameInput.select();
});
document.getElementById("defaults-save-as-cancel")?.addEventListener("click", () =>
  dialogDefaultsSaveAs.close()
);
dialogDefaultsSaveAs.addEventListener("close", () => {
  if (dialogDefaultsSaveAs.returnValue !== "confirm") return;
  void (async () => {
    try {
      const mapBlock = serializeDefaultsMapArgument(workspace);
      if (!mapBlock) throw new Error("No Defaults Map to save");
      await defaultsCatalog.save(defaultsSaveAsNameInput.value, mapBlock);
      dialogDefaultsMap.close();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  })();
});

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
    s.target ? `Target: ${s.target.targetId}` : "No target",
    `Script: ${
      s.settings.exportTarget === "preview"
        ? "Mapping preview"
        : s.settings.exportTarget.toUpperCase()
    }`,
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

  syncModelLanguageMenu(s);

  if (s.schemaTree) {
    renderSchemaTree(
      schemaTreeEl,
      s.schemaTree,
      (path, event) => {
        handleTreeHighlight(canonicalSyncPath(path), "schema", true);
        handleSourceSelection(path, s.schemaFormat, event);
      },
      treeHighlightOptions(),
      s.schemaFormat,
    );
  } else if (s.schemaError) {
    schemaTreeEl.replaceChildren();
    const err = document.createElement("div");
    err.className = "tree-pane-error";
    err.textContent = s.schemaError;
    schemaTreeEl.append(err);
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
      (path, event) => {
        handleTreeHighlight(canonicalSyncPath(path), "instance", true);
        handleSourceSelection(path, format, event);
      },
      {
        ...treeHighlightOptions(),
        invalidByPath: Object.fromEntries(
          s.activeExampleValidation.map((issue) => [issue.path, issue.message]),
        ),
      },
      format,
    );
    applyTreeHighlights(schemaTreeEl, exampleTreeEl, activeTreeHighlight(s));
  } else {
    exampleTreeEl.textContent = s.examples.length
      ? "Select an example tab."
      : 'Add example instance(s) to enable "Conversion Test Run(s)" in Target & Previews';
  }
  syncBlocklyWorkspace(s);
  // Blockly apply may have refreshed generatedCode without a re-render.
  const afterCanvas = controller.getState();
  refreshWorkspaceConstraints(workspace);
  highlightListeningSlot(workspace, afterCanvas.listeningSlotId, afterCanvas.listeningSourceBlockId);

  setMappingSpecFromBlockly(
    specEditor,
    afterCanvas.blocklyState ?? (workspace ? Blockly.serialization.workspaces.save(workspace) : null),
    specChrome(),
  );
  if (handlebarsEditor.state.doc.toString() !== afterCanvas.handlebarsTemplate) {
    updatingHandlebarsEditor = true;
    setEditorDoc(
      handlebarsEditor,
      afterCanvas.handlebarsTemplate,
      detectEditorLanguage(afterCanvas.handlebarsTemplate),
    );
    updatingHandlebarsEditor = false;
  }
  const generated = afterCanvas.generatedCode || "// Generated Export";
  setEditorDoc(exportEditor, generated, languageForExportTarget(s.settings.exportTarget, generated));
  const testOutput = afterCanvas.testResult
    ? formatTestOutput(
      afterCanvas.testResult.output ?? afterCanvas.testResult.composition ??
        { error: afterCanvas.testResult.error },
    )
    : "// Test Run output";
  setEditorDoc(testOutputEditor, testOutput, detectEditorLanguage(testOutput));

  targetFormatBadge.textContent = s.target
    ? `${s.target.format} · ${s.target.targetId}`
    : "No target";
  exportTargetSelect.value = s.settings.exportTarget;
  const exportBtn = document.getElementById("btn-export-ts") as HTMLButtonElement | null;
  if (exportBtn) exportBtn.disabled = s.settings.exportTarget === "preview";
  const testDownload = document.getElementById("btn-download-test-output") as HTMLButtonElement | null;
  if (testDownload) {
    testDownload.disabled = afterCanvas.testResult?.output === undefined &&
      !afterCanvas.testResult?.error;
  }
  const autoplayBtn = document.getElementById("btn-autoplay") as HTMLButtonElement;
  autoplayBtn.disabled = !s.examples.length;
  autoplayBtn.textContent = s.settings.autoplay ? "⏸ Pause" : "▶ Autoplay";
}

function formatTestOutput(output: unknown): string {
  return typeof output === "string" ? output : JSON.stringify(output, null, 2);
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
    const validation = s.outputValidations[ex.id];
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "example-tab" + (s.activeExample?.id === ex.id ? " active" : "");
    if (validation?.applicable) {
      if (validation.valid) {
        const mark = document.createElement("span");
        mark.className = "output-tab-mark";
        mark.textContent = "✅";
        mark.title = "Passes openEHR template validation";
        tab.append(mark);
      } else {
        const mark = document.createElement("button");
        mark.type = "button";
        mark.className = "output-tab-mark output-tab-mark--warn";
        mark.textContent = "⚠";
        mark.setAttribute("aria-label", `Validation errors for ${ex.filename}`);
        mark.title = validation.messages.map((m) => `${m.path}: ${m.message}`).join("\n");
        mark.addEventListener("click", (event) => {
          event.stopPropagation();
          tab.classList.toggle("output-tab-errors-open");
        });
        tab.append(mark);
        const errors = document.createElement("dl");
        errors.className = "output-tab-errors";
        for (const msg of validation.messages) {
          const dt = document.createElement("dt");
          dt.textContent = msg.path;
          const dd = document.createElement("dd");
          dd.textContent = msg.message;
          errors.append(dt, dd);
        }
        tab.append(errors);
      }
    }
    tab.append(ex.filename);
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
    mapNodeToSlot(slotId, path, format) {
      controller.mapNodeToSlot(slotId, path, format);
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
      const blocklyBlocks = workspace.getAllBlocks(false).map((block) => {
        const fields: Record<string, string> = {};
        for (const input of block.inputList) {
          for (const field of input.fieldRow) {
            const name = field.name;
            if (!name) continue;
            try {
              fields[name] = String(block.getFieldValue(name) ?? "");
            } catch {
              // skip non-serializable fields
            }
          }
        }
        const check = block.outputConnection?.getCheck?.() ?? null;
        return {
          id: block.id,
          type: block.type,
          slotId: slotIdFromBlock(block),
          fields,
          outputCheck: check,
        };
      });
      return {
        templateId: s.templateId,
        listeningSlotId: s.listeningSlotId,
        listeningSourceBlockId: s.listeningSourceBlockId,
        selectedBlockId,
        exampleCount: s.examples.length,
        activeExampleFilename: s.activeExample?.filename ?? null,
        model: s.model,
        testResult: s.testResult,
        generatedCode: s.generatedCode,
        statusMessage: s.statusMessage,
        schemaError: s.schemaError,
        exampleIssueCount: s.activeExampleValidation.length,
        autoplay: s.settings.autoplay,
        unmappedMandatory: s.unmappedMandatory,
        blocklyBlocks,
      };
    },
    findSlotIdBySuffix(suffix) {
      const slots = collectValueSlots(controller.getState().skeleton);
      return slots.find((slot) => slot.slotId.endsWith(suffix))?.slotId ?? null;
    },
    getMappingSpecDocument() {
      return mappingSpecDocumentText(specEditor);
    },
    loadBlocklyJson(filename, content) {
      controller.loadBlocklyDefinition(filename, content);
    },
    getBlockClientRect(blockId) {
      const block = workspace.getBlockById(blockId) as BlockSvg | null;
      const root = block && typeof block.getSvgRoot === "function" ? block.getSvgRoot() : null;
      if (!root) return null;
      const rect = root.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    },
    clickBlock(blockId) {
      applyBlockSelection(blockId, "blockly");
    },
    scrollBlockIntoView(blockId) {
      const block = workspace.getBlockById(blockId) as BlockSvg | null;
      if (block) panToBlock(block);
    },
    listBlockInputs(blockId) {
      const block = workspace.getBlockById(blockId);
      return block ? block.inputList.map((input) => input.name) : [];
    },
    openMutator(blockId) {
      const block = workspace.getBlockById(blockId);
      if (block) openBlockMutator(block);
    },
    setOptionalRmExtras(blockId, names) {
      const block = workspace.getBlockById(blockId);
      if (block) composeOptionalRmExtras(block, names);
    },
  };
  // Some test helpers look for `globalThis.intehrgratorTestApi` rather than
  // `globalThis.window.intehrgratorTestApi`. Expose via both seams.
  (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi }).intehrgratorTestApi = api;
  globalThis.window.intehrgratorTestApi = api;
}

async function main(): Promise<void> {
  // NOTE: `testMode` is intentionally *not* used for gating here.
  // The Web Shell bundle is tree-shaken by esbuild in a way that can cause
  // the `?testMode=1` branch to be dropped, which breaks Playwright tests.
  // Installing this lightweight seam unconditionally keeps the E2E harness stable.
  installWorkbenchTestApi();
  await bootBlockly();
  controller.subscribe(render);
  render();
  workbenchReadyResolve();
}

void main();
