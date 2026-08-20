import * as Blockly from "blockly/core";
import { createHostAdapter } from "../src/host/create_host.ts";
import { WorkbenchController } from "../src/workbench/controller.ts";
import {
  renderSchemaTree,
  renderInstanceTree,
  renderSkeletonList,
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
  setEditorDoc,
} from "../src/workbench/codemirror_setup.ts";
import {
  createMappingSpecEditor,
  setMappingSpecFromBlockly,
} from "../src/workbench/mapping_spec/mod.ts";
import {
  initBlocklyGenerators,
  loadSkeletonIntoWorkspace,
  lockWorkspaceRootsExpanded,
  setAllBlocksCollapsed,
  applyModelExpressions,
  attachOptionalRmChild,
  highlightListeningSlot,
  slotIdFromBlock,
  createModestTheme,
  buildDemoToolbox,
  setOptionalRmPickHandler,
  workspaceToModelJson,
  placeSourceQueryBlock,
  sourceReturnTypeFromSchemaType,
  workspacePositionFromClient,
  registerCompactThrasosRenderer,
  openWorkspaceSnapshotWindow,
} from "../src/blockly/mod.ts";
import {
  presentAttributeNames,
  rmTypeOfBlock,
} from "../src/blockly/blocks/rm_blocks.ts";
import type { AttachmentOption } from "../src/types/mod.ts";
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
import { installInfoTips } from "../src/ui/info_tip.ts";
import { installUrlLoadUi } from "../src/ui/url_load.ts";
import { DEFAULT_GITHUB_TEMPLATE_URL } from "../src/core/clinical_model/github_template.ts";
import { DEFAULT_GITHUB_EXAMPLES_URL } from "../src/core/source/github_examples.ts";
import { formatSaveTime } from "../src/core/persistence/mod.ts";
import { collectValueSlots } from "../src/core/skeleton/generate_skeleton.ts";
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
const skeletonSlotsEl = document.getElementById("skeleton-slots")!;
const blocklyMount = document.getElementById("blockly-mount")!;
const statusMain = document.getElementById("status-main")!;
const statusSave = document.getElementById("status-save")!;
const statusBuild = document.getElementById("status-build")!;
const targetFormatBadge = document.getElementById("target-format-badge")!;
const exportTargetSelect = document.getElementById("export-target") as HTMLSelectElement;
const mappingJsonTab = document.getElementById("tab-mapping-json") as HTMLButtonElement;
const handlebarsTab = document.getElementById("tab-handlebars") as HTMLButtonElement;
const downloadSpecBtn = document.getElementById("btn-download-spec") as HTMLButtonElement;
const mappingJsonHost = document.getElementById("spec-editor")!;
const handlebarsHost = document.getElementById("handlebars-editor")!;

const dialogSaveAs = document.getElementById("dialog-save-as") as HTMLDialogElement;
const saveAsNameInput = document.getElementById("save-as-name") as HTMLInputElement;
const dialogLoadProject = document.getElementById("dialog-load-project") as HTMLDialogElement;
const loadProjectList = document.getElementById("load-project-list")!;
const dialogOptionalRm = document.getElementById("dialog-optional-rm") as HTMLDialogElement;
const optionalRmList = document.getElementById("optional-rm-list")!;
const optionalRmTitle = document.getElementById("optional-rm-title")!;

const specEditor = createMappingSpecEditor(mappingJsonHost, {
  onFieldEdit: (blockId, field, value) => {
    const block = workspace?.getBlockById(blockId);
    if (!block) return;
    block.setFieldValue(value, field);
    // Workspace change listener runs syncFromBlockly → Spec refresh.
  },
});
let updatingHandlebarsEditor = false;
const handlebarsEditor = createTextEditor(handlebarsHost, (text) => {
  if (!updatingHandlebarsEditor) controller.setHandlebarsTemplate(text);
});
let activeTextView: "mapping-json" | "handlebars" = "mapping-json";
type HandlebarsInsertMode = "flat" | "tree";
const handlebarsInsertToolbar = document.getElementById("handlebars-insert-toolbar");

function currentHandlebarsInsertMode(): HandlebarsInsertMode {
  const selected = document.querySelector(
    'input[name="hbs-insert-mode"]:checked',
  ) as HTMLInputElement | null;
  return selected?.value === "tree" ? "tree" : "flat";
}

const exportEditor = createReadonlyEditor(document.getElementById("export-editor")!);
const testOutputEditor = createReadonlyEditor(document.getElementById("test-output")!);

/** Set in boot() after locale + inject. */
let workspace!: Blockly.WorkspaceSvg;
let blocklyLocale = detectLocale();
let blocklySkeletonKey = "";
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
}

mappingJsonTab.addEventListener("click", () => showTextView("mapping-json"));
handlebarsTab.addEventListener("click", () => showTextView("handlebars"));
downloadSpecBtn.addEventListener("click", () => controller.exportMappingSpec());
exportTargetSelect.addEventListener("change", () => {
  const target = exportTargetSelect.value as
    | "typescript"
    | "java"
    | "handlebars"
    | "xquery";
  controller.setExportTarget(target);
  if (target === "handlebars") showTextView("handlebars");
});

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
  blocklyLocale = locale;
  await loadBlocklyLocale(locale);
  initBlocklyGenerators();
  setupLanguageMenu(locale);

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

  const loadOnce = takeLoadOnceBlocks();
  if (loadOnce) {
    Blockly.serialization.workspaces.load(loadOnce, workspace);
    lockWorkspaceRootsExpanded(workspace);
  }

  setOptionalRmPickHandler((block) => {
    const rmType = rmTypeOfBlock(block);
    const slotId = block.getFieldValue("SLOT_ID") || "";
    const options = controller.getOptionalAttachmentsFor(
      rmType,
      slotId,
      presentAttributeNames(block),
    );
    if (!options.length) {
      statusMain.textContent = `No optional RM structures left on ${rmType}.`;
      return;
    }
    openOptionalRmPicker(rmType, options, (picked) => {
      if (slotId) controller.addOptionalRm(slotId, picked.rmType, picked.attributeName);
      attachOptionalRmChild(workspace, block, picked);
      statusMain.textContent = `Added ${picked.label} (${picked.attributeName}: ${picked.rmType})`;
    });
  });

  workspace.configureContextMenu = (options) => {
    const selected = Blockly.getSelected?.() as { firePlusClick?: () => void } | null;
    if (selected?.firePlusClick) {
      options.push({
        text: "Add optional RM…",
        enabled: true,
        callback: () => selected.firePlusClick?.(),
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
    if (event.type === Blockly.Events.CLICK && "blockId" in event) {
      const blockId = typeof event.blockId === "string" ? event.blockId : null;
      const slotId = blockId ? slotIdFromBlock(workspace.getBlockById(blockId)) : null;
      if (slotId) controller.armSlot(slotId);
      return;
    }
    if (event.type === Blockly.Events.FINISHED_LOADING || event.isUiEvent) return;
    controller.syncFromBlockly(
      Blockly.serialization.workspaces.save(workspace),
      workspaceToModelJson(workspace).slots,
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
    state.settings.exportTarget === "handlebars" &&
    activeTextView === "handlebars" &&
    !state.listeningSlotId
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
  controller.bindFromNode(path, format);
}

function syncToolbox(s: ReturnType<WorkbenchController["getState"]>): void {
  const key = `${s.target?.format ?? ""}|${s.templateId}|${s.skeleton.length}`;
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
    if (s.blocklyState && typeof s.blocklyState === "object") {
      Blockly.Events.disable();
      try {
        workspace.clear();
        Blockly.serialization.workspaces.load(s.blocklyState, workspace);
      } finally {
        Blockly.Events.enable();
      }
      lockWorkspaceRootsExpanded(workspace);
    } else {
      loadSkeletonIntoWorkspace(workspace, s.skeleton, s.model, s.listeningSlotId);
    }
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
bind("btn-copy-ai", () => controller.copyAiPrompt());
bind("btn-import-ai", () => controller.importAiSuggestionsFromClipboard());

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

function openOptionalRmPicker(
  rmType: string,
  options: AttachmentOption[],
  onPick: (option: AttachmentOption) => void,
): void {
  optionalRmTitle.textContent = `Add optional RM on ${rmType}`;
  optionalRmList.replaceChildren();
  for (const option of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "load-project-item";
    btn.textContent = `${option.label}  ·  ${option.attributeName}: ${option.rmType}`;
    btn.addEventListener("click", () => {
      dialogOptionalRm.close();
      onPick(option);
    });
    optionalRmList.appendChild(btn);
  }
  dialogOptionalRm.showModal();
}
document.getElementById("optional-rm-cancel")?.addEventListener("click", () => {
  dialogOptionalRm.close();
});

/** Drop Source Pane paths onto Blockly: value-slot mapping, or a free source block. */
function initBlocklySourceDrop(): void {
  let lastAppliedAt = 0;
  let lastAppliedPath = "";
  const applyPayloadAtPoint = (
    payload: { path: string; format: string; schemaType?: string },
    clientX: number,
    clientY: number,
  ): boolean => {
    const hit = document.elementFromPoint(clientX, clientY);
    if (!hit || !blocklyMount.contains(hit)) return false;
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
    if (block.type !== "element" && block.type !== "target_value") continue;
    const slotId = slotIdFromBlock(block);
    if (!slotId) continue;
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
    const area = rect.width * rect.height;
    // Prefer the smallest containing block (leaf value slot over containers).
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
    s.target ? `Target: ${s.target.targetId}` : "No target",
    `Script: ${s.settings.exportTarget.toUpperCase()}`,
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
      : 'Add example instance(s) to enable "Conversion Test Run(s)" in output previews pane';
  }
  syncBlocklyWorkspace(s);
  renderSkeletonList(
    skeletonSlotsEl,
    s.skeleton,
    (slotId) => controller.armSlot(slotId),
    s.listeningSlotId,
    new Set(s.model.slots.filter((x) => x.expression).map((x) => x.slotId)),
    (slotId, payload) => {
      controller.mapNodeToSlot(slotId, payload.path, payload.format);
    },
  );

  setMappingSpecFromBlockly(
    specEditor,
    s.blocklyState ?? (workspace ? Blockly.serialization.workspaces.save(workspace) : null),
  );
  if (handlebarsEditor.state.doc.toString() !== s.handlebarsTemplate) {
    updatingHandlebarsEditor = true;
    setEditorDoc(handlebarsEditor, s.handlebarsTemplate);
    updatingHandlebarsEditor = false;
  }
  setEditorDoc(exportEditor, s.generatedCode || "// Generated Export");
  setEditorDoc(
    testOutputEditor,
    s.testResult
      ? formatTestOutput(s.testResult.output ?? s.testResult.composition ?? { error: s.testResult.error })
      : "// Test Run output",
  );

  targetFormatBadge.textContent = s.target
    ? `${s.target.format} · ${s.target.targetId}`
    : "No target";
  exportTargetSelect.value = s.settings.exportTarget;
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
        exampleCount: s.examples.length,
        activeExampleFilename: s.activeExample?.filename ?? null,
        model: s.model,
        testResult: s.testResult,
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
