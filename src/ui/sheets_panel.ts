/**
 * jspreadsheet-ce host for project-owned Sheet JSON.
 * The widget is a view; persistence and Test Run read the JSON store.
 */
import jspreadsheet from "jspreadsheet-ce";
import type { Workspace } from "blockly/core";
import {
  cloneSheets,
  emptySheet,
  findSheet,
  normalizeSheet,
  parseSpreadsheetText,
  sheetsEqual,
  sheetToCsv,
  type SheetDocument,
} from "../core/sheets/mod.ts";
import { fireSheetChange } from "../workbench/sheet_undo.ts";
import { jspreadsheetDictionary, sheetsChrome } from "./sheets_i18n.ts";

type WorksheetInstance = {
  getData: () => unknown[][];
  setData: (data?: unknown[][]) => void;
  getHeaders: (asArray?: boolean) => string | string[];
  setHeader: (column: number, value: string) => void;
  download: (includeHeaders?: boolean) => void;
  ignoreHistory: boolean;
  options?: { rows?: Array<{ title?: string }> | Record<number, { title?: string }> };
  parent: { fullscreen: (activate?: boolean) => void };
};

export interface SheetsPanelHost {
  getSheets: () => SheetDocument[];
  replaceSheets: (sheets: SheetDocument[], options?: { silent?: boolean }) => void;
  markDirty: () => void;
}

export function mountSheetsPanel(
  root: HTMLElement,
  host: SheetsPanelHost,
  options: {
    getWorkspace: () => Workspace;
    getLocale: () => string;
  },
): {
  refresh: () => void;
  showSheet: (name: string) => void;
  setLocale: (locale: string) => void;
  setFullscreen: (on: boolean) => void;
  destroy: () => void;
} {
  let locale = options.getLocale();
  applyDictionary(locale);

  root.classList.add("sheets-panel");
  root.innerHTML = "";
  const toolbar = document.createElement("div");
  toolbar.className = "sheets-toolbar";
  const select = document.createElement("select");
  select.className = "sheets-select";
  select.setAttribute("aria-label", "Sheet");
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "pane-btn";
  const renameBtn = document.createElement("button");
  renameBtn.type = "button";
  renameBtn.className = "pane-btn";
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "pane-btn";
  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "pane-btn";
  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "pane-btn";
  const fullBtn = document.createElement("button");
  fullBtn.type = "button";
  fullBtn.className = "pane-btn";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".csv,.tsv,.txt";
  fileInput.hidden = true;
  toolbar.append(select, addBtn, renameBtn, deleteBtn, importBtn, exportBtn, fullBtn, fileInput);

  const emptyEl = document.createElement("p");
  emptyEl.className = "sheets-empty";
  const gridHost = document.createElement("div");
  gridHost.className = "sheets-grid-host";
  const gridEl = document.createElement("div");
  gridEl.className = "sheets-grid";
  gridHost.append(gridEl);
  root.append(toolbar, emptyEl, gridHost);

  let activeName = "";
  let worksheet: WorksheetInstance | null = null;
  let applying = false;
  let fullscreen = false;
  let destroyed = false;

  const paintChrome = (): void => {
    const t = sheetsChrome(locale);
    addBtn.textContent = t.add;
    renameBtn.textContent = t.rename;
    deleteBtn.textContent = t.remove;
    importBtn.textContent = t.importCsv;
    exportBtn.textContent = t.exportCsv;
    fullBtn.textContent = fullscreen ? t.exitFullscreen : t.fullscreen;
    emptyEl.textContent = t.empty;
  };
  paintChrome();

  const destroyGrid = (): void => {
    worksheet = null;
    try {
      jspreadsheet.destroy(gridEl as unknown as Parameters<typeof jspreadsheet.destroy>[0], true);
    } catch {
      // destroyed or never mounted
    }
    gridEl.innerHTML = "";
  };

  const readWorksheet = (name: string): SheetDocument | null => {
    if (!worksheet) return null;
    const headersRaw = worksheet.getHeaders(true);
    const headers = Array.isArray(headersRaw)
      ? headersRaw.map((h) => String(h ?? ""))
      : String(headersRaw).split(",");
    const values = (worksheet.getData() ?? []).map((row) =>
      (Array.isArray(row) ? row : []).map((c) => (c == null ? "" : c as string | number | boolean))
    );
    const trimmed = trimTrailingEmptyRows(values);
    const existing = findSheet(host.getSheets(), name);
    return normalizeSheet({
      name,
      headers,
      values: trimmed,
      columnTypes: existing?.columnTypes,
      rowNames: readRowNames(worksheet, trimmed.length) ?? existing?.rowNames,
    });
  };

  const commitFromWidget = (): void => {
    if (applying || !worksheet || !activeName) return;
    const before = host.getSheets();
    const nextDoc = readWorksheet(activeName);
    if (!nextDoc) return;
    const after = before.map((s) => s.name === activeName ? nextDoc : s);
    if (findSheet(after, activeName) == null) after.push(nextDoc);
    if (sheetsEqual(before, after)) return;
    host.replaceSheets(after);
    fireSheetChange(options.getWorkspace(), before, after, (sheets) => {
      host.replaceSheets(sheets, { silent: true });
      refresh();
    });
  };

  const bindSheet = (sheet: SheetDocument): void => {
    destroyGrid();
    applying = true;
    try {
      const columns = sheet.headers.map((title, i) => ({
        type: (sheet.columnTypes?.[i] ?? "text") as "text" | "numeric" | "dropdown",
        title: title || undefined,
        width: 120,
      }));
      const rowTitles = sheet.rowNames?.length
        ? sheet.rowNames.map((title) => ({ title }))
        : undefined;
      const viewport = gridViewport();
      const created = jspreadsheet(gridEl, {
        worksheets: [{
          data: sheet.values.length ? sheet.values : [[""]],
          columns,
          ...(rowTitles ? { rows: rowTitles } : {}),
          minDimensions: [
            Math.max(sheet.headers.length, viewport.cols),
            Math.max(sheet.values.length, viewport.rows),
          ],
          minSpareRows: 0,
          minSpareCols: 0,
          tableOverflow: true,
          tableWidth: viewport.widthPx,
          tableHeight: viewport.heightPx,
          csvFileName: sheet.name,
          columnSorting: false,
          parseFormulas: false,
        }],
        onafterchanges: () => {
          commitFromWidget();
        },
        onchange: () => {
          commitFromWidget();
        },
        oninsertrow: () => commitFromWidget(),
        oninsertcolumn: () => commitFromWidget(),
        ondeleterow: () => commitFromWidget(),
        ondeletecolumn: () => commitFromWidget(),
        onchangeheader: () => commitFromWidget(),
      }) as unknown as WorksheetInstance[];
      worksheet = created[0] ?? null;
      if (worksheet) worksheet.ignoreHistory = true;
      sizeGrid();
    } finally {
      applying = false;
    }
  };

  const widgetMatches = (sheet: SheetDocument): boolean => {
    if (!worksheet || sheet.name !== activeName) return false;
    const current = readWorksheet(sheet.name);
    return current != null && sheetsEqual([current], [sheet]);
  };

  const fillSelect = (sheets: SheetDocument[]): void => {
    const current = select.value;
    select.innerHTML = "";
    for (const sheet of sheets) {
      const opt = document.createElement("option");
      opt.value = sheet.name;
      opt.textContent = sheet.name;
      select.append(opt);
    }
    if (sheets.some((s) => s.name === current)) select.value = current;
    else if (sheets[0]) select.value = sheets[0].name;
  };

  const refresh = (): void => {
    if (destroyed) return;
    const sheets = host.getSheets();
    const has = sheets.length > 0;
    emptyEl.hidden = has;
    gridHost.hidden = !has;
    renameBtn.disabled = !has;
    deleteBtn.disabled = !has;
    exportBtn.disabled = !has;
    fillSelect(sheets);
    if (!has) {
      destroyGrid();
      activeName = "";
      return;
    }
    const name = select.value || sheets[0]!.name;
    activeName = name;
    const sheet = findSheet(sheets, name) ?? sheets[0]!;
    if (widgetMatches(sheet)) return;
    bindSheet(sheet);
  };

  const showSheet = (name: string): void => {
    let sheets = host.getSheets();
    if (!findSheet(sheets, name)) {
      const before = cloneSheets(sheets);
      const after = [...before, emptySheet(name)];
      host.replaceSheets(after);
      fireSheetChange(options.getWorkspace(), before, after, (next) => {
        host.replaceSheets(next, { silent: true });
        refresh();
      });
      sheets = after;
    }
    select.value = name;
    activeName = name;
    const sheet = findSheet(sheets, name);
    if (sheet) bindSheet(sheet);
  };

  addBtn.addEventListener("click", () => {
    const t = sheetsChrome(locale);
    const name = globalThis.prompt(t.namePrompt, uniqueName(host.getSheets(), "Sheet"));
    if (!name?.trim()) return;
    showSheet(name.trim());
  });
  renameBtn.addEventListener("click", () => {
    if (!activeName) return;
    const t = sheetsChrome(locale);
    const nextName = globalThis.prompt(t.namePrompt, activeName)?.trim();
    if (!nextName || nextName === activeName) return;
    const before = host.getSheets();
    const after = before.map((s) => s.name === activeName ? { ...s, name: nextName } : s);
    host.replaceSheets(after);
    fireSheetChange(options.getWorkspace(), before, after, (sheets) => {
      host.replaceSheets(sheets, { silent: true });
      refresh();
    });
    activeName = nextName;
    refresh();
  });
  deleteBtn.addEventListener("click", () => {
    if (!activeName) return;
    const before = host.getSheets();
    const after = before.filter((s) => s.name !== activeName);
    host.replaceSheets(after);
    fireSheetChange(options.getWorkspace(), before, after, (sheets) => {
      host.replaceSheets(sheets, { silent: true });
      refresh();
    });
    refresh();
  });
  select.addEventListener("change", () => {
    const sheet = findSheet(host.getSheets(), select.value);
    if (sheet) {
      activeName = sheet.name;
      bindSheet(sheet);
    }
  });
  importBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    const text = await file.text();
    const grid = parseSpreadsheetText(text);
    if (!grid.length) return;
    const headers = grid[0]!.map((h) => h);
    const values = grid.slice(1);
    const name = file.name.replace(/\.(csv|tsv|txt)$/i, "") || "Sheet1";
    const doc = normalizeSheet({ name: uniqueName(host.getSheets(), name), headers, values });
    const before = host.getSheets();
    const after = [...before, doc];
    host.replaceSheets(after);
    fireSheetChange(options.getWorkspace(), before, after, (sheets) => {
      host.replaceSheets(sheets, { silent: true });
      refresh();
    });
    showSheet(doc.name);
  });
  exportBtn.addEventListener("click", () => {
    const sheet = findSheet(host.getSheets(), activeName);
    if (!sheet) return;
    if (worksheet) {
      try {
        worksheet.download(true);
        return;
      } catch {
        // fall through to CSV download
      }
    }
    const csv = sheetToCsv(sheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sheet.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const gridViewport = (): { widthPx: number; heightPx: number; cols: number; rows: number } => {
    const widthPx = Math.max(root.clientWidth - 24, gridHost.clientWidth || 200, 200);
    const heightPx = Math.max(
      root.clientHeight - toolbar.offsetHeight - 28,
      gridHost.clientHeight || 120,
      120,
    );
    return {
      widthPx,
      heightPx,
      cols: Math.max(3, Math.floor(widthPx / 120)),
      rows: Math.max(4, Math.floor(heightPx / 26)),
    };
  };

  const sizeGrid = (): void => {
    const content = (worksheet && "content" in worksheet
      ? (worksheet as WorksheetInstance & { content?: HTMLElement }).content
      : null) ?? gridEl.querySelector(".jss_content") as HTMLElement | null;
    if (!content) return;
    const { widthPx, heightPx } = gridViewport();
    content.style.width = `${widthPx}px`;
    content.style.height = `${heightPx}px`;
    content.style.maxHeight = `${heightPx}px`;
  };
  const hostResize = new ResizeObserver(() => sizeGrid());
  hostResize.observe(root);
  hostResize.observe(gridHost);

  const setFullscreen = (on: boolean): void => {
    fullscreen = on;
    root.classList.toggle("sheets-panel--fullscreen", on);
    document.body.classList.toggle("sheets-fullscreen", on);
    paintChrome();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const sheet = findSheet(host.getSheets(), activeName);
        if (sheet) bindSheet(sheet);
        else sizeGrid();
      });
    });
  };
  fullBtn.addEventListener("click", () => setFullscreen(!fullscreen));

  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape" && fullscreen) {
      ev.preventDefault();
      setFullscreen(false);
      return;
    }
    const key = ev.key.toLowerCase();
    const undo = (ev.ctrlKey || ev.metaKey) && key === "z" && !ev.shiftKey;
    const redo = (ev.ctrlKey || ev.metaKey) && (key === "y" || (key === "z" && ev.shiftKey));
    if (!undo && !redo) return;
    const target = ev.target as Node | null;
    const inSheet = !!(target && (root.contains(target) ||
      (target instanceof Element && target.closest(".jss, .jss_worksheet, .jss_container"))));
    if (!inSheet && !fullscreen) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    commitFromWidget();
    options.getWorkspace().undo(redo);
  };
  document.addEventListener("keydown", onKey, true);

  refresh();

  return {
    refresh,
    showSheet,
    setLocale: (next) => {
      locale = next;
      applyDictionary(locale);
      paintChrome();
    },
    setFullscreen,
    destroy: () => {
      destroyed = true;
      document.removeEventListener("keydown", onKey, true);
      hostResize.disconnect();
      setFullscreen(false);
      destroyGrid();
      root.innerHTML = "";
    },
  };
}

function applyDictionary(locale: string): void {
  const dict = jspreadsheetDictionary(locale);
  if (Object.keys(dict).length) jspreadsheet.setDictionary(dict);
}

function uniqueName(sheets: SheetDocument[], base: string): string {
  const names = new Set(sheets.map((s) => s.name));
  if (!names.has(base)) return base;
  let i = 2;
  while (names.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

function readRowNames(
  worksheet: WorksheetInstance,
  rowCount: number,
): string[] | undefined {
  const rows = worksheet.options?.rows;
  if (!rows) return undefined;
  const titles: string[] = [];
  let named = false;
  for (let i = 0; i < rowCount; i++) {
    const title = Array.isArray(rows) ? rows[i]?.title : rows[i]?.title;
    if (title) named = true;
    titles.push(title ?? "");
  }
  return named ? titles : undefined;
}

function trimTrailingEmptyRows(
  values: Array<Array<string | number | boolean>>,
): Array<Array<string | number | boolean>> {
  let end = values.length;
  while (
    end > 1 &&
    (values[end - 1] ?? []).every((cell) => cell === "" || cell == null)
  ) {
    end--;
  }
  return values.slice(0, Math.max(end, 1));
}
