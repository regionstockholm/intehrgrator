/**
 * Collapsed Blockly label: ZipEHR / generic HTML inside a foreignObject (#101).
 */
import type { BlockSvg } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import { collapsedHtmlForBlock } from "./collapsed_preview.ts";

export const FIELD_COLLAPSED_PREVIEW_TYPE = "field_collapsed_preview";
export const COLLAPSED_INPUT_NAME = "_TEMP_COLLAPSED_INPUT";
export const COLLAPSED_FIELD_NAME = "_TEMP_COLLAPSED_FIELD";

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_WIDTH_PX = 1200;
const MIN_HEIGHT_PX = 18;

// deno-lint-ignore no-explicit-any
const FieldBase = Blockly.Field as any;

let tipEl: HTMLDivElement | null = null;
let installed = false;

export class FieldCollapsedPreview extends FieldBase {
  SERIALIZABLE = false;
  EDITABLE = false;

  private foreignObject_: SVGForeignObjectElement | null = null;
  private host_: HTMLDivElement | null = null;

  constructor() {
    super("");
    this.SERIALIZABLE = false;
    this.EDITABLE = false;
    if (this.size_) {
      this.size_.width = 40;
      this.size_.height = MIN_HEIGHT_PX;
    }
  }

  static fromJson(): FieldCollapsedPreview {
    return new FieldCollapsedPreview();
  }

  getText(): string {
    return "";
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
    this.foreignObject_.style.overflow = "hidden";
    this.foreignObject_.style.pointerEvents = "all";
    this.host_ = document.createElement("div");
    this.host_.className = "blockly-collapsed-preview-host";
    this.host_.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    this.foreignObject_.appendChild(this.host_);
    group.appendChild(this.foreignObject_);
    this.host_.addEventListener("pointerover", (event) => this.onHover_(event));
    this.host_.addEventListener("pointerout", (event) => this.onLeave_(event));
    this.paint_();
  }

  render_(): void {
    this.paint_();
    this.updateSize_();
  }

  refresh(): void {
    this.paint_();
    this.forceRerender?.();
  }

  updateSize_(): boolean {
    if (!this.size_) return false;
    const host = this.host_;
    const fo = this.foreignObject_;
    if (!host || !fo) {
      this.size_.width = 40;
      this.size_.height = MIN_HEIGHT_PX;
      return false;
    }
    // Measure unconstrained content, then shrink the foreignObject to it.
    // A block-level host would report the FO's own width (chicken-and-egg).
    fo.setAttribute("width", String(MAX_WIDTH_PX));
    fo.setAttribute("height", String(MIN_HEIGHT_PX));
    const preview = host.querySelector(".collapsed-preview") as HTMLElement | null;
    const rawW = preview?.scrollWidth || host.scrollWidth || host.offsetWidth || 40;
    const rawH = preview?.scrollHeight || host.scrollHeight || host.offsetHeight ||
      MIN_HEIGHT_PX;
    const width = Math.min(MAX_WIDTH_PX, Math.max(24, Math.ceil(rawW)));
    const height = Math.max(MIN_HEIGHT_PX, Math.ceil(rawH));
    const changed = this.size_.width !== width || this.size_.height !== height;
    this.size_.width = width;
    this.size_.height = height;
    fo.setAttribute("width", String(width));
    fo.setAttribute("height", String(height));
    return changed;
  }

  private paint_(): void {
    if (!this.host_) return;
    const block = this.getSourceBlock?.() as BlockSvg | null;
    this.host_.innerHTML = block ? collapsedHtmlForBlock(block) : "";
    this.clearHover_();
    this.updateSize_();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        if (this.updateSize_()) this.forceRerender?.();
      });
    }
  }

  private onHover_(event: PointerEvent): void {
    const host = this.host_;
    if (!host) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const node = target.closest("[data-collapsed-node]");
    if (!node || !host.contains(node)) return;
    this.clearHover_();
    node.classList.add("collapsed-hover");
    showCollapsedTip(node, event);
  }

  private onLeave_(event: PointerEvent): void {
    const related = event.relatedTarget;
    if (related instanceof Node && this.host_?.contains(related)) return;
    this.clearHover_();
    hideCollapsedTip();
  }

  private clearHover_(): void {
    this.host_?.querySelectorAll(".collapsed-hover").forEach((el) => {
      el.classList.remove("collapsed-hover");
    });
  }
}

function showCollapsedTip(node: Element, event: PointerEvent): void {
  if (typeof document === "undefined") return;
  const at = node.getAttribute("data-at-code") ?? "";
  const rm = node.getAttribute("data-rm-type") ?? "";
  const extra = node.getAttribute("data-extra") ?? "";
  const tag = node.getAttribute("data-tag") ?? "";
  const label = node.getAttribute("aria-label") ?? "";
  const lines = [
    at && rm ? `${at} · ${rm}` : at || rm || "",
    extra,
    !rm && tag ? tag : "",
    !at && !rm && !extra && !tag ? label : "",
  ]
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    hideCollapsedTip();
    return;
  }
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.className = "blockly-collapsed-tip";
    document.body.appendChild(tipEl);
  }
  tipEl.textContent = lines.join("\n");
  tipEl.style.display = "block";
  tipEl.style.left = `${event.clientX + 12}px`;
  tipEl.style.top = `${event.clientY + 12}px`;
}

function hideCollapsedTip(): void {
  if (!tipEl) return;
  tipEl.style.display = "none";
}

function applyCollapsedPreviewField(block: BlockSvg): void {
  if (!block.isCollapsed()) {
    hideCollapsedTip();
    return;
  }
  const input = block.getInput(COLLAPSED_INPUT_NAME);
  if (!input) return;
  const existing = block.getField(COLLAPSED_FIELD_NAME);
  if (existing instanceof FieldCollapsedPreview) {
    existing.refresh();
    return;
  }
  if (existing) input.removeField(COLLAPSED_FIELD_NAME);
  input.appendField(new FieldCollapsedPreview(), COLLAPSED_FIELD_NAME);
}

/** Patch BlockSvg.updateCollapsed so collapsed labels use the ZipEHR HTML field. */
export function installCollapsedPreview(): void {
  if (installed) return;
  const proto = Blockly.BlockSvg?.prototype as
    | { updateCollapsed?: () => void }
    | undefined;
  if (!proto?.updateCollapsed) return;
  installed = true;
  registerFieldCollapsedPreview();
  const original = proto.updateCollapsed;
  proto.updateCollapsed = function (this: BlockSvg) {
    original.call(this);
    applyCollapsedPreviewField(this);
  };
}

let registered = false;
export function registerFieldCollapsedPreview(): void {
  if (registered) return;
  registered = true;
  try {
    Blockly.fieldRegistry?.register(FIELD_COLLAPSED_PREVIEW_TYPE, FieldCollapsedPreview);
  } catch {
    // Already registered in this runtime (HMR / repeated init).
  }
}
