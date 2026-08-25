/**
 * FieldDropdown that sizes to the currently selected label.
 *
 * Stock Blockly `renderSelectedText` uses `getFastTextWidth(..., size + "pt")`,
 * which over-measures CSS-px fonts and leaves a blank gap after the arrow.
 * Option lists such as ISO_639-1 make that gap especially obvious.
 */
import { Blockly } from "./blockly_core.ts";

const TEXT_FONT =
  '"Google Sans", "Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

// deno-lint-ignore no-explicit-any
const FieldDropdownBase = Blockly.FieldDropdown as any;

export class FieldDropdownHug extends FieldDropdownBase {
  constructor(menuGenerator?: unknown, optValidator?: unknown, optConfig?: unknown) {
    super(menuGenerator, optValidator, optConfig);
  }

  renderSelectedText(): void {
    const content = this.getTextContent?.();
    if (content) content.nodeValue = this.getDisplayText_?.() ?? this.getText?.() ?? "";

    const textEl = this.getTextElement?.();
    const addClass = Blockly.utils?.dom?.addClass;
    if (textEl && addClass) addClass(textEl, "blocklyDropdownText");
    textEl?.setAttribute("text-anchor", "start");

    const constants = this.getConstants?.() ?? {};
    const hasBorder = Boolean(this.borderRect_);
    const height = Math.max(
      hasBorder ? Number(constants.FIELD_DROPDOWN_BORDER_RECT_HEIGHT ?? 0) : 0,
      Number(constants.FIELD_TEXT_HEIGHT ?? 16),
    );
    const textWidth = measureDropdownText(
      String(this.getDisplayText_?.() ?? this.getText?.() ?? ""),
      Number(constants.FIELD_TEXT_FONTSIZE ?? 12),
      String(constants.FIELD_TEXT_FONTWEIGHT ?? "normal"),
      String(constants.FIELD_TEXT_FONTFAMILY ?? TEXT_FONT),
    );
    const xPad = hasBorder ? Number(constants.FIELD_BORDER_RECT_X_PADDING ?? 2) : 0;
    const arrowSize = Number(constants.FIELD_DROPDOWN_SVG_ARROW_SIZE ?? 12);
    let arrow = 0;
    if (this.svgArrow && typeof this.positionSVGArrow === "function") {
      arrow = Number(this.positionSVGArrow(textWidth + xPad, height / 2 - arrowSize / 2) ?? 0);
    }
    this.size_.width = textWidth + arrow + 2 * xPad;
    this.size_.height = height;
    this.positionTextElement_?.(xPad, textWidth);
  }
}

let measureCanvas: HTMLCanvasElement | null = null;

function measureDropdownText(
  text: string,
  fontPx: number,
  fontWeight: string,
  fontFamily: string,
): number {
  if (!text) return 0;
  if (typeof document !== "undefined") {
    try {
      measureCanvas ??= document.createElement("canvas");
      const ctx = measureCanvas.getContext("2d");
      if (ctx) {
        ctx.font = `${fontWeight} ${fontPx}px ${fontFamily}`;
        const w = ctx.measureText(text.replace(/\u00a0/g, " ")).width;
        if (w > 0) return Math.ceil(w);
      }
    } catch {
      // Headless / canvas-less runtimes fall through.
    }
  }
  return Math.ceil(fontPx * 0.55 * text.length);
}
