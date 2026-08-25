/**
 * Compact two-line header for skeleton RM blocks:
 *   **node name**          (bold)
 *   CLASSNAME at0001       (small)
 * Class name and at-code sit under the name so the header uses less width.
 */
import type { Field } from "blockly/core";
import { Blockly } from "./blockly_core.ts";

// deno-lint-ignore no-explicit-any
const FieldLabelBase = Blockly.FieldLabel as any;

const NAME_FONT_PX = 12;
const META_FONT_PX = 9;
const NAME_LINE_PX = 14;
const META_LINE_PX = 10;
const LINE_GAP_PX = 0;
const TEXT_FONT =
  '"Google Sans", "Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

export function isSkeletonTitleField(
  field: Field | null | undefined,
): field is FieldSkeletonTitle {
  return Boolean(field && (field as FieldSkeletonTitle).isSkeletonTitleField);
}

/** `DV_CODED_TEXT` → `Coded Text`; `CODE_PHRASE` → `Code Phrase`. */
export function humanizeRmType(rmType: string): string {
  return (rmType || "")
    .replace(/^DV_/, "")
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export class FieldSkeletonTitle extends FieldLabelBase {
  readonly isSkeletonTitleField = true;
  EDITABLE = false;
  // Persist the node name in Blockly JSON so Mapping Spec download/upload
  // round-trips labels. className/at-code are restored from the skeleton.
  SERIALIZABLE = true;

  private className_ = "";
  private atCode_ = "";
  private nameEl_: SVGTextElement | null = null;
  private metaEl_: SVGTextElement | null = null;

  constructor(className: string, name = "", atCode = "") {
    super(name ?? "", "blockly-skeleton-title");
    this.className_ = className ?? "";
    this.atCode_ = atCode ?? "";
  }

  classNameText(): string {
    return this.className_;
  }

  atCode(): string {
    return this.atCode_;
  }

  setClassName(className: string): void {
    this.className_ = className ?? "";
    this.refresh_();
  }

  setAtCode(atCode: string): void {
    this.atCode_ = atCode ?? "";
    this.refresh_();
  }

  initView(): void {
    const group = this.fieldGroup_ as SVGGElement | null;
    if (!group || typeof document === "undefined") return;

    this.nameEl_ = document.createElementNS("http://www.w3.org/2000/svg", "text");
    this.nameEl_.setAttribute("class", "blocklyText blockly-skeleton-name");
    this.nameEl_.setAttribute("dominant-baseline", "hanging");
    this.nameEl_.setAttribute("text-anchor", "start");
    group.appendChild(this.nameEl_);

    this.metaEl_ = document.createElementNS("http://www.w3.org/2000/svg", "text");
    this.metaEl_.setAttribute("class", "blocklyText blockly-skeleton-meta");
    this.metaEl_.setAttribute("dominant-baseline", "hanging");
    this.metaEl_.setAttribute("text-anchor", "start");
    group.appendChild(this.metaEl_);

    // FieldLabel.applyColour writes fill onto textElement_.
    this.textElement_ = this.nameEl_;
    const add = Blockly.utils?.dom?.addClass;
    if (add) add(group, "blockly-skeleton-title-field");
  }

  render_(): void {
    const name = this.nameText_();
    const meta = this.metaText_();
    if (this.nameEl_) this.nameEl_.textContent = name;
    if (this.metaEl_) {
      this.metaEl_.textContent = meta;
      this.metaEl_.style.display = meta ? "" : "none";
    }
    this.updateSize_();
  }

  /** Blockly would otherwise baseline a single-line label. */
  positionTextElement_(_xOffset?: number, _contentWidth?: number): void {
    this.layout_();
  }

  updateSize_(): void {
    if (!this.size_) return;
    const name = this.nameText_();
    const meta = this.metaText_();
    const nameW = measureTextWidth(name, NAME_FONT_PX, true);
    const metaW = meta ? measureTextWidth(meta, META_FONT_PX, false) : 0;
    this.size_.width = Math.max(nameW, metaW);
    this.size_.height = meta ? NAME_LINE_PX + LINE_GAP_PX + META_LINE_PX : NAME_LINE_PX;
    this.layout_();
  }

  applyColour(): void {
    super.applyColour?.();
    const fill = this.nameEl_?.getAttribute("fill") ||
      (this.textElement_ as SVGTextElement | null)?.getAttribute("fill") ||
      "";
    if (this.metaEl_ && fill) this.metaEl_.setAttribute("fill", fill);
  }

  private nameText_(): string {
    return String(this.getText?.() ?? this.getValue?.() ?? "");
  }

  private metaText_(): string {
    return [this.className_, this.atCode_].filter(Boolean).join(" ");
  }

  private layout_(): void {
    if (this.nameEl_) {
      this.nameEl_.setAttribute("x", "0");
      this.nameEl_.setAttribute("y", "0");
    }
    if (this.metaEl_) {
      this.metaEl_.setAttribute("x", "0");
      this.metaEl_.setAttribute("y", String(NAME_LINE_PX + LINE_GAP_PX));
    }
  }

  private refresh_(): void {
    this.render_?.();
    // deno-lint-ignore no-explicit-any
    const block = this.getSourceBlock?.() as any;
    if (block?.rendered) {
      block.queueRender?.() ?? block.render?.();
    }
  }
}

let measureCanvas: HTMLCanvasElement | null = null;

function measureTextWidth(text: string, fontPx: number, bold: boolean): number {
  if (!text) return 0;
  if (typeof document !== "undefined") {
    try {
      measureCanvas ??= document.createElement("canvas");
      const ctx = measureCanvas.getContext("2d");
      if (ctx) {
        ctx.font = `${bold ? "700" : "400"} ${fontPx}px ${TEXT_FONT}`;
        const w = ctx.measureText(text).width;
        if (w > 0) return Math.ceil(w);
      }
    } catch {
      // Headless / canvas-less runtimes fall through.
    }
  }
  const avg = bold ? 0.62 : 0.55;
  return Math.ceil(fontPx * avg * text.length);
}
