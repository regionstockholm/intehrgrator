/**
 * Functions dialog: save/load disk, GitHub library, Contribute (GitHub issue).
 */

import { Blockly } from "../blockly/blockly_core.ts";
import {
  extractFunctionBundle,
  listWorkspaceFunctions,
  mergeFunctionBundle,
} from "../blockly/function_bundle.ts";
import {
  DEFAULT_GITHUB_FUNCTION_LIBRARY_URL,
  GITHUB_LOGIN_URL,
  GITHUB_SIGNUP_URL,
  functionBundleClashes,
  functionBundleFilename,
  submitFunctionContribution,
  type FunctionBundle,
  type FunctionClashPolicy,
  type FunctionLibraryCatalog,
  type FunctionLibraryEntry,
} from "../core/function_library/mod.ts";
import type { WorkbenchController } from "../workbench/controller.ts";

export interface FunctionLibraryDialogOptions {
  dialog: HTMLDialogElement;
  clashDialog: HTMLDialogElement;
  contributeDialog: HTMLDialogElement;
  getWorkspace: () => Blockly.Workspace | null;
  controller: WorkbenchController;
  persistCanvas: () => void;
}

export function mountFunctionLibraryDialog(options: FunctionLibraryDialogOptions): {
  open: () => void;
  refresh: () => void;
  saveNamed: (name: string) => void;
  contributeNamed: (name: string) => void;
} {
  const { dialog, clashDialog, contributeDialog, getWorkspace, controller, persistCanvas } =
    options;
  const canvasList = requireEl(dialog, "function-canvas-list");
  const libraryList = requireEl(dialog, "function-library-list");
  const catalogInput = requireEl<HTMLInputElement>(dialog, "function-library-catalog-url");
  const statusEl = requireEl(dialog, "function-library-status");
  const clashMessage = requireEl(clashDialog, "function-clash-message");
  const contributeName = requireEl(contributeDialog, "function-contribute-name");
  const contributeDescription = requireEl<HTMLTextAreaElement>(
    contributeDialog,
    "function-contribute-description",
  );
  const contributeError = requireEl(contributeDialog, "function-contribute-error");
  const signupLink = requireEl<HTMLAnchorElement>(contributeDialog, "function-contribute-signup");
  const loginLink = requireEl<HTMLAnchorElement>(contributeDialog, "function-contribute-login");
  signupLink.href = GITHUB_SIGNUP_URL;
  loginLink.href = GITHUB_LOGIN_URL;

  let catalog: FunctionLibraryCatalog | null = null;
  let pendingContribute: FunctionBundle | null = null;
  catalogInput.placeholder = DEFAULT_GITHUB_FUNCTION_LIBRARY_URL;


  dialog.querySelector("#function-library-close")?.addEventListener("click", () => dialog.close());
  dialog.querySelector("#function-library-load-disk")?.addEventListener("click", () => {
    void loadFromDisk();
  });
  dialog.querySelector("#function-library-refresh")?.addEventListener("click", () => {
    void loadCatalog(catalogInput.value);
  });
  clashDialog.querySelector("#function-clash-cancel")?.addEventListener("click", () => {
    clashDialog.close();
  });
  contributeDialog.querySelector("#function-contribute-cancel")?.addEventListener("click", () => {
    contributeDialog.close();
  });
  contributeDialog.querySelector("#function-contribute-submit")?.addEventListener("click", () => {
    void submitContribute();
  });

  function refresh(): void {
    renderCanvas();
    renderLibrary();
  }

  function open(): void {
    refresh();
    dialog.showModal();
    if (!catalog) void loadCatalog(catalogInput.value.trim() || undefined);
  }

  function renderCanvas(): void {
    const workspace = getWorkspace();
    canvasList.replaceChildren();
    if (!workspace) {
      canvasList.append(emptyRow("No Blockly workspace"));
      return;
    }
    const fns = listWorkspaceFunctions(workspace);
    if (!fns.length) {
      canvasList.append(
        emptyRow("No Functions on the canvas. Extract to function, or load from the library."),
      );
      return;
    }
    for (const fn of fns) {
      const row = document.createElement("div");
      row.className = "function-library-row";
      const label = document.createElement("div");
      label.className = "function-library-row-text";
      label.textContent = `${fn.name}(${fn.parameters.join(", ")})`;
      const actions = document.createElement("div");
      actions.className = "function-library-row-actions";
      actions.append(
        actionButton("Save", () => saveNamed(fn.name)),
        actionButton("Contribute", () => contributeNamed(fn.name)),
      );
      row.append(label, actions);
      canvasList.append(row);
    }
  }

  function renderLibrary(): void {
    libraryList.replaceChildren();
    if (!catalog) {
      libraryList.append(emptyRow("Load the catalog to browse curated Functions."));
      return;
    }
    if (!catalog.functions.length) {
      libraryList.append(emptyRow("Catalog has no Functions."));
      return;
    }
    for (const entry of catalog.functions) {
      const row = document.createElement("div");
      row.className = "function-library-row";
      row.dataset.functionId = entry.id;
      const text = document.createElement("div");
      text.className = "function-library-row-text";
      const title = document.createElement("strong");
      title.textContent = entry.title;
      const desc = document.createElement("p");
      desc.textContent = summarizeEntry(entry);
      text.append(title, desc);
      const actions = document.createElement("div");
      actions.className = "function-library-row-actions";
      actions.append(actionButton("Load", () => {
        void loadLibraryEntry(entry.id);
      }));
      row.append(text, actions);
      libraryList.append(row);
    }
  }

  async function loadCatalog(url?: string): Promise<void> {
    statusEl.textContent = "Loading Function library…";
    try {
      catalog = await controller.loadFunctionLibraryCatalog(url);
      catalogInput.value = catalog.catalogUrl;
      statusEl.textContent = `Function library: ${catalog.functions.length} Function${
        catalog.functions.length === 1 ? "" : "s"
      }`;
      renderLibrary();
    } catch (err) {
      catalog = null;
      statusEl.textContent = err instanceof Error ? err.message : String(err);
      renderLibrary();
    }
  }

  async function loadLibraryEntry(id: string): Promise<void> {
    if (!catalog) return;
    try {
      const bundle = await controller.loadFunctionLibraryEntry(catalog, id);
      await applyBundle(bundle);
    } catch (err) {
      statusEl.textContent = err instanceof Error ? err.message : String(err);
    }
  }

  async function loadFromDisk(): Promise<void> {
    try {
      const bundle = await controller.importFunctionBundleFile();
      if (!bundle) return;
      await applyBundle(bundle);
    } catch (err) {
      statusEl.textContent = err instanceof Error ? err.message : String(err);
    }
  }

  async function applyBundle(bundle: FunctionBundle): Promise<void> {
    const workspace = getWorkspace();
    const clash = workspace
      ? await resolveClash(workspace, bundle)
      : "rename" as FunctionClashPolicy;
    if (!clash) return;
    if (workspace) {
      const result = mergeFunctionBundle(workspace, bundle, {
        clash,
        sheets: controller.getSheets(),
      });
      controller.replaceSheets(result.sheets);
      persistCanvas();
      controller.notifyChange();
      const renamed = result.renamedFrom ? ` (renamed from ${result.renamedFrom})` : "";
      statusEl.textContent = `Loaded Function ${result.name}${renamed}`;
    } else {
      const result = controller.applyFunctionBundle(bundle, clash);
      const renamed = result.renamedFrom ? ` (renamed from ${result.renamedFrom})` : "";
      statusEl.textContent = `Loaded Function ${result.name}${renamed}`;
    }
    refresh();
  }

  async function resolveClash(
    workspace: Blockly.Workspace,
    bundle: FunctionBundle,
  ): Promise<FunctionClashPolicy | null> {
    const clashes = functionBundleClashes(
      Blockly.serialization.workspaces.save(workspace),
      controller.getSheets(),
      bundle,
    );
    if (!clashes.functions.length && !clashes.sheets.length) return "rename";
    const bits = [
      ...clashes.functions.map((name) => `Function "${name}"`),
      ...clashes.sheets.map((name) => `Decision table "${name}"`),
    ];
    clashMessage.textContent =
      `${bits.join(" and ")} already exist. Rename keeps both (default). Replace overwrites the existing definition.`;
    clashDialog.returnValue = "";
    clashDialog.showModal();
    return await new Promise((resolve) => {
      const onClose = () => {
        clashDialog.removeEventListener("close", onClose);
        const value = clashDialog.returnValue;
        if (value === "replace") resolve("replace");
        else if (value === "rename") resolve("rename");
        else resolve(null);
      };
      clashDialog.addEventListener("close", onClose);
    });
  }

  function saveNamed(name: string): void {
    const workspace = getWorkspace();
    if (!workspace) return;
    try {
      const description = window.prompt(`Description for Function "${name}" (optional):`) ?? "";
      const bundle = extractFunctionBundle(workspace, name, controller.getSheets(), {
        description,
      });
      controller.downloadFunctionBundle(bundle);
      statusEl.textContent = `Saved ${functionBundleFilename(bundle.name)}`;
    } catch (err) {
      statusEl.textContent = err instanceof Error ? err.message : String(err);
    }
  }

  function contributeNamed(name: string): void {
    const workspace = getWorkspace();
    if (!workspace) return;
    try {
      pendingContribute = extractFunctionBundle(workspace, name, controller.getSheets());
      contributeName.textContent = pendingContribute.name;
      contributeDescription.value = pendingContribute.description;
      contributeError.hidden = true;
      contributeError.textContent = "";
      contributeDialog.showModal();
    } catch (err) {
      statusEl.textContent = err instanceof Error ? err.message : String(err);
    }
  }

  async function submitContribute(): Promise<void> {
    if (!pendingContribute) return;
    const description = contributeDescription.value;
    contributeError.hidden = true;
    try {
      const githubToken = typeof Deno !== "undefined"
        ? Deno.env.get("GITHUB_TOKEN") ?? undefined
        : undefined;
      const result = await submitFunctionContribution(pendingContribute, description, {
        githubToken,
      });
      if (result.truncated) {
        controller.downloadFunctionBundle(pendingContribute);
      }
      contributeDialog.close();
      globalThis.open(result.htmlUrl, "_blank", "noopener,noreferrer");
      statusEl.textContent = result.via === "api"
        ? `Opened contribution issue for ${pendingContribute.name}`
        : `Opened GitHub new-issue form for ${pendingContribute.name}`;
    } catch (err) {
      contributeError.hidden = false;
      contributeError.textContent = err instanceof Error ? err.message : String(err);
    }
  }

  return { open, refresh, saveNamed, contributeNamed };
}

function summarizeEntry(entry: FunctionLibraryEntry): string {
  const params = entry.parameters?.length ? entry.parameters.join(", ") : "—";
  const tables = entry.decisionTables?.length ? entry.decisionTables.join(", ") : "—";
  return `${entry.description} Parameters: ${params}. Decision tables: ${tables}.`;
}

function actionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function emptyRow(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "function-library-empty";
  p.textContent = text;
  return p;
}

function requireEl<T extends HTMLElement = HTMLElement>(root: ParentNode, id: string): T {
  const el = root.querySelector(`#${id}`);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}
