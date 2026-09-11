/**
 * Readonly miniature of a Sheet / Decision table on the declaration chip.
 * Click focuses the Sheets tab and highlights the live grid.
 */
import { Blockly } from "./blockly_core.ts";
import { previewGrid } from "../core/sheets/decision_table.ts";
import { workspaceSheet } from "./sheets_bridge.ts";

export const FIELD_GRID_PREVIEW_TYPE = "field_grid_preview";

const SVG_NS = "http://www.w3.org/2000/svg";
const PREVIEW_W = 118;
const PREVIEW_H = 52;

// deno-lint-ignore no-explicit-any
const FieldBase = Blockly.Field as any;

type PreviewActivate = (blockType: string, name: string) => void;
let previewActivate: PreviewActivate | null = null;

/** Workbench: open the Sheets tab, select this document, flash the grid. */
export function setGridPreviewActivateHandler(handler: PreviewActivate | null): void {
  previewActivate = handler;
}

export class FieldGridPreview extends FieldBase {
  SERIALIZABLE = false;
  EDITABLE = false;
  CURSOR = "pointer";

  private foreignObject_: SVGForeignObjectElement | null = null;
  private host_: HTMLDivElement | null = null;

  constructor() {
    super("");
    this.SERIALIZABLE = false;
    this.EDITABLE = false;
    if (this.size_) {
      this.size_.width = PREVIEW_W;
      this.size_.height = PREVIEW_H;
    }
  }

  static fromJson(): FieldGridPreview {
    return new FieldGridPreview();
  }

  initView(): void {
    const group = this.fieldGroup_ as SVGGElement | null;
    if (!group || typeof document === "undefined") {
      this.updateSize_();
      return;
    }
    this.foreignObject_ = document.createElementNS(SVG_NS, "foreignObject");
    this.foreignObject_.setAttribute("x", "0");
    this.foreignObject_.setAttribute("y", "0");
    this.foreignObject_.setAttribute("width", String(PREVIEW_W));
    this.foreignObject_.setAttribute("height", String(PREVIEW_H));
    this.foreignObject_.style.pointerEvents = "all";
    this.host_ = document.createElement("div");
    this.host_.className = "blockly-grid-preview";
    this.host_.setAttribute("role", "button");
    this.host_.tabIndex = 0;
    this.host_.title = "Open in Sheets";
    this.foreignObject_.appendChild(this.host_);
    group.appendChild(this.foreignObject_);
    const activate = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      this.activate();
    };
    // pointerdown only — a paired click listener would flash the Sheets pane twice.
    this.host_.addEventListener("pointerdown", activate);
    this.host_.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") activate(event);
    });
    this.paint_();
    this.updateSize_();
  }

  render_(): void {
    this.paint_();
    this.updateSize_();
  }

  refresh(): void {
    this.paint_();
    this.forceRerender?.();
  }

  updateSize_(): void {
    if (!this.size_) return;
    this.size_.width = PREVIEW_W;
    this.size_.height = PREVIEW_H;
  }

  private sheetName_(): string {
    const block = this.getSourceBlock?.();
    return String(block?.getFieldValue?.("NAME") ?? "");
  }

  private paint_(): void {
    if (!this.host_) return;
    const name = this.sheetName_();
    const sheet = name ? workspaceSheet(name) : undefined;
    const preview = sheet
      ? previewGrid(sheet)
      : { headers: ["", "", ""], rows: [] as Array<Array<string | number | boolean | null>> };
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    for (const h of preview.headers) {
      const th = document.createElement("th");
      th.textContent = h;
      hr.append(th);
    }
    thead.append(hr);
    const tbody = document.createElement("tbody");
    const rows = preview.rows.length ? preview.rows : [["", "", ""]];
    for (const row of rows) {
      const tr = document.createElement("tr");
      for (let i = 0; i < preview.headers.length; i++) {
        const td = document.createElement("td");
        const cell = row[i];
        td.textContent = cell == null ? "" : String(cell);
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(thead, tbody);
    this.host_.replaceChildren(table);
  }

  /** Open the named document in the Sheets tab and flash the lower pane. */
  activate(): void {
    const block = this.getSourceBlock?.();
    if (!block) return;
    const fallback = block.type === "decision_table_decl" ? "Decision1" : "Sheet1";
    previewActivate?.(block.type, this.sheetName_() || fallback);
  }
}

export function refreshGridPreviewFields(
  workspace: { getAllBlocks: (ordered: boolean) => Array<{ getField: (n: string) => unknown }> },
): void {
  for (const block of workspace.getAllBlocks(false)) {
    const field = block.getField("GRID_PREVIEW") as FieldGridPreview | null;
    field?.refresh?.();
  }
}

let registered = false;
export function registerFieldGridPreview(): void {
  if (registered) return;
  registered = true;
  try {
    Blockly.fieldRegistry?.register(FIELD_GRID_PREVIEW_TYPE, FieldGridPreview);
  } catch {
    // Already registered in this runtime (HMR / repeated init).
  }
}
