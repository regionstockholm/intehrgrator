/**
 * ZipEHR RM-type emojis on Blockly connection points.
 *
 * Block output (left/top puzzle): first field of HEADER, next to the tab.
 * Value slots (right sockets): last field on the input, tightly left of the plug.
 * Statement slots (C / downward mouths): last field on the input, next to the notch.
 */
import type { Field, Input } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import { zipehrEmojiForRmType } from "../core/rm_emoji.ts";
import {
  attributesFor,
  baseRmTypeName,
  isAbstractType,
  resolveGenericSlotType,
  subtypesOf,
} from "../core/rm_meta.ts";

export const BLOCK_OUT_EMOJI_FIELD = "RM_OUT_EMOJI";
export const SLOT_EMOJI_FIELD_PREFIX = "SLOT_EMOJI_";
/**
 * Encircled question mark (U+003F + combining enclosing circle U+20DD).
 * On the canvas this is drawn as "?" inside an SVG ring so the circle is crisp.
 */
export const ABSTRACT_SLOT_GLYPH = "?\u20DD";

/** Theme body text is 12px; connection glyphs are ~50% larger. */
export const RM_EMOJI_FONT_PX = 18;
/** Document-like ZipEHR glyphs that stay illegible at 18px. */
export const RM_EMOJI_LARGE_FONT_PX = 24;

const HARD_TO_READ_RM_TYPES = new Set(["DV_TEXT", "DV_CODED_TEXT", "DV_PARAGRAPH"]);
const EMOJI_FONT =
  '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Google Sans", sans-serif';

export function slotEmojiFieldName(inputName: string): string {
  return `${SLOT_EMOJI_FIELD_PREFIX}${inputName}`;
}

/** RM class allowed in an attribute slot (unwraps List<> / generics). */
export function slotRmTypeForAttr(
  parentRmType: string,
  attrName: string,
  check?: string | string[] | null,
): string | undefined {
  const meta = attributesFor(parentRmType).find((a) => a.name === attrName);
  if (meta) return resolveGenericSlotType(parentRmType, meta.typeName);
  if (typeof check === "string") return check;
  if (Array.isArray(check)) {
    for (const t of check) {
      if (zipehrEmojiForRmType(t)) return t;
    }
    return check[0];
  }
  return undefined;
}

export function isHardToReadRmEmoji(rmType: string): boolean {
  return HARD_TO_READ_RM_TYPES.has(baseRmTypeName(rmType));
}

export function rmEmojiFontPx(rmType: string): number {
  return isHardToReadRmEmoji(rmType) ? RM_EMOJI_LARGE_FONT_PX : RM_EMOJI_FONT_PX;
}

/**
 * Glyph shown at a connection.
 * Slots of abstract types (PARTY_PROXY, CONTENT_ITEM, …) use the encircled ?
 * even when ZipEHR also has an emoji — the popup lists allowed subclasses.
 * Block output still prefers the ZipEHR emoji so the block keeps its identity.
 */
export function connectionPointGlyph(
  rmType: string | undefined,
  forSlot = false,
): string | undefined {
  if (!rmType) return undefined;
  if (forSlot && isAbstractPlaceholderType(rmType)) return ABSTRACT_SLOT_GLYPH;
  const emoji = zipehrEmojiForRmType(rmType);
  if (emoji) return emoji;
  if (isAbstractPlaceholderType(rmType)) return ABSTRACT_SLOT_GLYPH;
  return undefined;
}

export function isAbstractPlaceholderType(rmType: string): boolean {
  if (isAbstractType(rmType)) return true;
  if (zipehrEmojiForRmType(rmType)) return false;
  return subtypesOf(rmType, { concreteOnly: true }).length > 0;
}

/** Hover/click text: class name, or abstract type plus allowed concrete subclasses. */
export function rmTypeConnectionTooltip(rmType: string): string {
  if (!isAbstractPlaceholderType(rmType)) return rmType;
  const subs = subtypesOf(rmType, { concreteOnly: true }).slice().sort();
  const lines = [`${rmType} (abstract)`, "", "Allowed:"];
  for (const sub of subs) {
    lines.push(`${zipehrEmojiForRmType(sub) ?? ABSTRACT_SLOT_GLYPH} ${sub}`);
  }
  if (!subs.length) lines.push("(no concrete subclasses)");
  return lines.join("\n");
}

export function isRmTypeEmojiField(field: Field | null | undefined): field is FieldRmTypeEmoji {
  return Boolean(field && (field as FieldRmTypeEmoji).isRmTypeEmojiField);
}

// deno-lint-ignore no-explicit-any
const FieldLabelBase = Blockly.FieldLabel as any;

let pinSeq = 0;

/** Connection-point ZipEHR glyph with tight layout, scaled typeface, and class-name tooltip. */
export class FieldRmTypeEmoji extends FieldLabelBase {
  readonly isRmTypeEmojiField = true;
  EDITABLE = false;
  SERIALIZABLE = false;
  CURSOR = "help";
  readonly pinId = `rm-emoji-${++pinSeq}`;

  private rmType_ = "";
  private forSlot_ = false;
  private ring_: SVGCircleElement | null = null;

  constructor(rmType: string, forSlot = false) {
    const glyph = connectionPointGlyph(rmType, forSlot) ?? "";
    super(glyph, cssClassFor(rmType), { tooltip: rmTypeConnectionTooltip(rmType) });
    this.rmType_ = rmType;
    this.forSlot_ = forSlot;
    this.setTooltip(rmTypeConnectionTooltip(rmType));
    installRmTypeEmojiTooltips();
  }

  rmType(): string {
    return this.rmType_;
  }

  setRmType(rmType: string): void {
    this.rmType_ = rmType;
    const glyph = connectionPointGlyph(rmType, this.forSlot_) ?? "";
    this.setClass(cssClassFor(rmType));
    this.syncCssClasses_?.();
    this.setTooltip(rmTypeConnectionTooltip(rmType));
    this.setValue(glyph);
    this.syncTipAttr_();
    this.updateSize_?.();
  }

  initView(): void {
    super.initView();
    this.syncCssClasses_();
    this.syncTipAttr_();
    this.updateSize_();
  }

  render_(): void {
    super.render_?.();
    this.updateSize_();
  }

  /** Blockly would otherwise snap the glyph to FIELD_TEXT_BASELINE (12px header). */
  positionTextElement_(_xOffset?: number, _contentWidth?: number): void {
    this.layoutGlyph_();
  }

  applyColour(): void {
    super.applyColour?.();
    this.syncRingStroke_();
  }

  getDisplayText_(): string {
    if (this.showsAbstractPlaceholder_()) return "?";
    return super.getDisplayText_?.() ?? String(this.getText?.() ?? "");
  }

  updateSize_(): void {
    if (!this.size_) return;
    const px = rmEmojiFontPx(this.rmType_);
    const abstract = this.showsAbstractPlaceholder_();
    const text = abstract
      ? "?"
      : String(this.getText?.() ?? this.getValue?.() ?? "");
    this.size_.width = abstract ? px : measureGlyphWidth(text, px);
    this.size_.height = px;
    this.layoutGlyph_();
    this.syncAbstractRing_(px, abstract);
  }

  private showsAbstractPlaceholder_(): boolean {
    return this.forSlot_ && isAbstractPlaceholderType(this.rmType_);
  }

  private layoutGlyph_(): void {
    const px = rmEmojiFontPx(this.rmType_);
    const abstract = this.showsAbstractPlaceholder_();
    const el = this.textElement_ as SVGTextElement | null;
    if (!el) return;
    el.style.setProperty("font-size", abstract ? `${Math.round(px * 0.62)}px` : `${px}px`, "important");
    el.style.setProperty(
      "font-family",
      abstract ? '"Google Sans", "Segoe UI", sans-serif' : EMOJI_FONT,
      "important",
    );
    el.setAttribute("font-size", String(abstract ? Math.round(px * 0.62) : px));
    el.setAttribute("dominant-baseline", "central");
    el.setAttribute("dy", "0");
    el.setAttribute("y", String(px / 2));
    if (abstract) {
      el.textContent = "?";
      el.setAttribute("text-anchor", "middle");
      el.setAttribute("x", String(px / 2));
    } else {
      el.setAttribute("text-anchor", "start");
      el.setAttribute("x", "0");
    }
  }

  private syncCssClasses_(): void {
    const group = this.fieldGroup_ as Element | null;
    const text = this.textElement_ as Element | null;
    const add = Blockly.utils?.dom?.addClass;
    const remove = Blockly.utils?.dom?.removeClass;
    if (group && add) {
      add(group, "blockly-rm-emoji-field");
      if (isHardToReadRmEmoji(this.rmType_)) add(group, "blockly-rm-emoji-lg");
      else remove?.(group, "blockly-rm-emoji-lg");
    }
    if (text && add) {
      add(text, "blockly-rm-emoji");
      if (isHardToReadRmEmoji(this.rmType_)) add(text, "blockly-rm-emoji-lg");
      else remove?.(text, "blockly-rm-emoji-lg");
    }
  }

  showEditor_(): void {
    pinRmTypeEmojiTip(this);
  }

  isClickableInFlyout(): boolean {
    return true;
  }

  private syncAbstractRing_(px: number, show: boolean): void {
    const group = this.fieldGroup_ as SVGGElement | null;
    if (!group || typeof document === "undefined") {
      this.ring_ = null;
      return;
    }
    if (!show) {
      this.ring_?.remove();
      this.ring_ = null;
      return;
    }
    if (!this.ring_) {
      const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ring.setAttribute("class", "blockly-rm-emoji-qmark-ring");
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke-width", "1.6");
      const text = this.textElement_ as SVGTextElement | null;
      if (text?.parentNode === group) group.insertBefore(ring, text);
      else group.appendChild(ring);
      this.ring_ = ring;
    }
    const r = Math.max(5, px / 2 - 1.1);
    this.ring_.setAttribute("cx", String(px / 2));
    this.ring_.setAttribute("cy", String(px / 2));
    this.ring_.setAttribute("r", String(r));
    this.syncRingStroke_();
  }

  private syncRingStroke_(): void {
    if (!this.ring_) return;
    const el = this.textElement_ as SVGTextElement | null;
    const fill = el?.getAttribute("fill") || el?.style.fill || "";
    this.ring_.setAttribute("stroke", fill || "currentColor");
  }

  private syncTipAttr_(): void {
    const tip = rmTypeConnectionTooltip(this.rmType_);
    this.fieldGroup_?.setAttribute("data-rm-type-tip", tip);
    const click = this.getClickTarget_?.();
    click?.setAttribute("data-rm-type-tip", tip);
  }
}

function cssClassFor(rmType: string): string {
  return isHardToReadRmEmoji(rmType) ? "blockly-rm-emoji blockly-rm-emoji-lg" : "blockly-rm-emoji";
}

let measureCanvas: HTMLCanvasElement | null = null;

function measureGlyphWidth(text: string, fontPx: number): number {
  if (!text) return 0;
  if (typeof document !== "undefined") {
    try {
      measureCanvas ??= document.createElement("canvas");
      const ctx = measureCanvas.getContext("2d");
      if (ctx) {
        ctx.font = `${fontPx}px ${EMOJI_FONT}`;
        const w = ctx.measureText(text).width;
        if (w > 0) return Math.ceil(w);
      }
    } catch {
      // Headless / canvas-less runtimes fall through.
    }
  }
  return Math.ceil(fontPx * 1.05 * Math.max(1, Array.from(text).length));
}

export function createRmTypeEmojiField(
  rmType: string,
  forSlot = false,
): FieldRmTypeEmoji | null {
  if (!connectionPointGlyph(rmType, forSlot)) return null;
  return new FieldRmTypeEmoji(rmType, forSlot);
}

/** First field on HEADER — sits in the upper-left, next to output / previous-statement. */
export function appendBlockOutputEmoji(header: Input, rmType: string): void {
  const field = createRmTypeEmojiField(rmType, false);
  if (field) header.appendField(field, BLOCK_OUT_EMOJI_FIELD);
}

/**
 * Last field on a value or statement input so the glyph sits against the socket.
 * Updates in place when the allowed type changes (e.g. ELEMENT.value).
 */
export function appendSlotTypeEmoji(input: Input, rmType: string | undefined): void {
  const name = slotEmojiFieldName(input.name);
  const existing = input.fieldRow.find((f) => f.name === name);
  if (existing && isRmTypeEmojiField(existing)) {
    if (!rmType || !connectionPointGlyph(rmType, true)) {
      existing.setValue("");
      existing.setTooltip("");
      return;
    }
    existing.setRmType(rmType);
    return;
  }
  if (existing) {
    const glyph = connectionPointGlyph(rmType, true);
    existing.setValue(glyph ?? "");
    existing.setTooltip(rmType ? rmTypeConnectionTooltip(rmType) : "");
    return;
  }
  if (!rmType) return;
  const field = createRmTypeEmojiField(rmType, true);
  if (field) input.appendField(field, name);
}

let tooltipsInstalled = false;

function installRmTypeEmojiTooltips(): void {
  const Tooltip = Blockly.Tooltip as
    | {
      LIMIT?: number;
      setCustomTooltip?: (fn: (div: Element, el: Element) => void) => void;
      getTooltipOfObject?: (el: Element) => string;
      hide?: () => void;
    }
    | undefined;
  if (!Tooltip || tooltipsInstalled) return;
  tooltipsInstalled = true;
  try {
    Tooltip.LIMIT = 4000;
  } catch {
    // Some builds export LIMIT as a const.
  }
  Tooltip.setCustomTooltip?.((div, el) => {
    const host = el as Element;
    const full = host.closest?.(".blockly-rm-emoji-field")?.getAttribute("data-rm-type-tip") ??
      host.getAttribute("data-rm-type-tip") ??
      Tooltip.getTooltipOfObject?.(el) ??
      "";
    const box = div as HTMLElement;
    box.style.whiteSpace = full.includes("\n") ? "pre-line" : "";
    box.textContent = full;
  });
}

const PIN_ID = "blockly-rm-emoji-tip";

function pinRmTypeEmojiTip(field: FieldRmTypeEmoji): void {
  if (typeof document === "undefined") return;
  Blockly.Tooltip?.hide?.();
  const target = (field as unknown as { getClickTarget_?: () => Element | null })
    .getClickTarget_?.() ?? field.fieldGroup_;
  if (!target || !("getBoundingClientRect" in target)) return;
  const text = rmTypeConnectionTooltip(field.rmType());
  if (!text) return;

  let tip = document.getElementById(PIN_ID);
  if (tip && tip.dataset.anchor === field.pinId) {
    tip.remove();
    return;
  }
  tip?.remove();
  tip = document.createElement("div");
  tip.id = PIN_ID;
  tip.className = "blockly-rm-emoji-tip";
  tip.dataset.anchor = field.pinId;
  tip.textContent = text;
  document.body.appendChild(tip);

  const rect = (target as Element).getBoundingClientRect();
  const pad = 8;
  const tw = Math.min(tip.offsetWidth, globalThis.innerWidth - pad * 2);
  let left = rect.left;
  left = Math.min(Math.max(pad, left), globalThis.innerWidth - tw - pad);
  let top = rect.bottom + 6;
  if (top + tip.offsetHeight > globalThis.innerHeight - pad) {
    top = Math.max(pad, rect.top - tip.offsetHeight - 6);
  }
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;

  const dismiss = (event: Event) => {
    if (event.target instanceof Node && tip?.contains(event.target)) return;
    tip?.remove();
    document.removeEventListener("pointerdown", dismiss, true);
    document.removeEventListener("keydown", onKey, true);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") dismiss(event);
  };
  document.addEventListener("pointerdown", dismiss, true);
  document.addEventListener("keydown", onKey, true);
}
