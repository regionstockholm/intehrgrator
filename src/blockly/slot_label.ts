/**
 * Single left-of-socket caption: `attr [min..max] glyph` with spaces only.
 * Attribute name is hover-underlined / clickable when ehrtslib `spec` (or
 * schema documentation) has help text for that RM attribute.
 */
import type { Field, Input } from "blockly/core";
import { Blockly } from "./blockly_core.ts";
import { anchorFloating, stopAnchoring } from "../ui/floating.ts";
import { documentationHelp, rmAttributeHelp } from "../core/spec_help.ts";
import { dismissSpecHelpPopup, showSpecHelpPopup } from "../ui/spec_help_popup.ts";
import {
  connectionPointGlyph,
  isAbstractPlaceholderType,
  isHardToReadRmEmoji,
  rmEmojiFontPx,
  rmTypeConnectionTooltip,
  RM_EMOJI_FONT_PX,
} from "./rm_type_emoji.ts";
import {
  formatSlotCardinality,
  type SlotCardinality,
} from "./slot_cardinality.ts";

export const SLOT_LABEL_FIELD_PREFIX = "SLOT_LABEL_";

/** Which overlay field-level showEditor_ should open when both could apply. */
export type SlotLabelOverlay = "abstract-tip" | "help" | null;

/**
 * Abstract ⁇ tip wins over attribute/spec help so concrete-implementation
 * lists stay reachable on RM slots that also have BMM documentation.
 */
export function slotLabelOverlayForEditor(options: {
  isAbstractSlot: boolean;
  hasAttrHelp: boolean;
}): SlotLabelOverlay {
  if (options.isAbstractSlot) return "abstract-tip";
  if (options.hasAttrHelp) return "help";
  return null;
}

// deno-lint-ignore no-explicit-any
const FieldLabelBase = Blockly.FieldLabel as any;

let pinSeq = 0;

export class FieldSlotLabel extends FieldLabelBase {
  readonly isSlotLabelField = true;
  EDITABLE = false;
  SERIALIZABLE = false;
  CURSOR = "default";

  attrLabel = "";
  min = 0;
  max: number | null = 1;
  hasCard = false;
  unmet = false;
  private rmType_ = "";
  /** Schema property docs when not using openEHR RM attribute tables. */
  private documentation_ = "";
  private attrTspan_: SVGTSpanElement | null = null;
  readonly pinId = `slot-label-${++pinSeq}`;

  /** Lets block_constraints refresh unmet cardinality on this caption. */
  get isSlotCardinalityField(): boolean {
    return this.hasCard;
  }

  constructor(
    attrLabel: string,
    options: {
      card?: SlotCardinality;
      rmType?: string;
      documentation?: string;
    } = {},
  ) {
    super("", cssClass(false, false));
    this.attrLabel = attrLabel;
    if (options.card) {
      this.hasCard = true;
      this.min = options.card.min;
      this.max = options.card.max;
    }
    this.rmType_ = options.rmType ?? "";
    this.documentation_ = (options.documentation ?? "").trim();
    this.refreshText_();
  }

  rmType(): string {
    return this.rmType_;
  }

  setCardinality(card: SlotCardinality | undefined): void {
    if (!card) {
      this.hasCard = false;
    } else {
      this.hasCard = true;
      this.min = card.min;
      this.max = card.max;
    }
    this.refreshText_();
  }

  setRmType(rmType: string | undefined): void {
    this.rmType_ = rmType ?? "";
    this.refreshText_();
  }

  setDocumentation(documentation: string | undefined): void {
    this.documentation_ = (documentation ?? "").trim();
    this.refreshText_();
  }

  documentation(): string {
    return this.documentation_;
  }

  setUnmet(unmet: boolean): void {
    if (this.unmet === unmet) return;
    this.unmet = unmet;
    this.syncClass_();
  }

  showEditor_(): void {
    // Blockly opens the editor from field-group mousedown. Prefer the
    // abstract ⁇ tip over attribute help so concrete-implementation lists
    // are not swallowed when both apply (common for RM slots).
    const action = slotLabelOverlayForEditor({
      isAbstractSlot: this.isAbstractSlot_(),
      hasAttrHelp: this.hasAttrHelp_(),
    });
    if (action === "abstract-tip") {
      dismissSpecHelpPopup();
      pinSlotLabelTip(this);
      return;
    }
    if (action !== "help") return;
    dismissSlotLabelTip();
    const help = this.attributeHelp_();
    if (!help) return;
    const anchor = this.attrTspan_ ??
      this.getClickTarget_?.() ??
      this.fieldGroup_;
    if (anchor && "getBoundingClientRect" in anchor) {
      showSpecHelpPopup(anchor as Element, help);
    }
  }

  isClickableInFlyout(): boolean {
    return this.hasAttrHelp_() || this.isAbstractSlot_();
  }

  private isAbstractSlot_(): boolean {
    return Boolean(this.rmType_ && isAbstractPlaceholderType(this.rmType_));
  }

  private parentRmClass_(): string {
    const block = this.getSourceBlock?.();
    if (!block) return "";
    return String(block.getFieldValue("RM_TYPE") || "").trim();
  }

  private hasAttrHelp_(): boolean {
    if (this.documentation_) return true;
    const parent = this.parentRmClass_();
    return Boolean(parent && rmAttributeHelp(parent, this.attrLabel));
  }

  private attributeHelp_() {
    if (this.documentation_) {
      return documentationHelp(this.attrLabel, this.documentation_);
    }
    const parent = this.parentRmClass_();
    return parent ? rmAttributeHelp(parent, this.attrLabel) : null;
  }

  private refreshText_(): void {
    const parts = [this.attrLabel];
    if (this.hasCard) {
      parts.push(formatSlotCardinality({ min: this.min, max: this.max }));
    }
    const glyph = connectionPointGlyph(this.rmType_ || undefined, true);
    // Abstract ⁇ is drawn as an underlined tspan so only the glyph is linked-looking.
    if (glyph && !this.isAbstractSlot_()) parts.push(glyph);
    this.setValue(parts.join(" "));
    this.CURSOR = this.hasAttrHelp_() || this.isAbstractSlot_() ? "pointer" : "default";
    this.syncClass_();
    this.syncTipAttr_();
    this.updateSize_?.();
  }

  private syncClass_(): void {
    // Do not put --abstract on the whole caption — only the ⁇ tspan is underlined.
    this.setClass?.(cssClass(this.unmet, false));
  }

  private syncTipAttr_(): void {
    if (!this.rmType_) {
      this.fieldGroup_?.removeAttribute("data-rm-type-tip");
      return;
    }
    const tip = rmTypeConnectionTooltip(this.rmType_);
    this.fieldGroup_?.setAttribute("data-rm-type-tip", tip);
    const click = this.getClickTarget_?.();
    click?.setAttribute("data-rm-type-tip", tip);
  }

  updateSize_(): void {
    if (!this.size_) return;
    const abstract = this.isAbstractSlot_();
    const glyph = abstract
      ? (connectionPointGlyph(this.rmType_, true) ?? "")
      : "";
    const card = this.hasCard
      ? formatSlotCardinality({ min: this.min, max: this.max })
      : "";
    const concreteGlyph = !abstract
      ? (connectionPointGlyph(this.rmType_ || undefined, true) ?? "")
      : "";
    const fullParts = [this.attrLabel];
    if (card) fullParts.push(card);
    if (abstract && glyph) fullParts.push(glyph);
    else if (concreteGlyph) fullParts.push(concreteGlyph);
    const full = fullParts.join(" ");
    const px = this.rmType_ ? rmEmojiFontPx(this.rmType_) : RM_EMOJI_FONT_PX;
    const fontPx = abstract ? Math.max(12, Math.round(px * 0.75)) : 12;
    this.size_.width = measureCaptionWidth(full, fontPx, abstract);
    this.size_.height = Math.max(14, fontPx);
    const el = this.textElement_ as SVGTextElement | null;
    if (!el) return;
    el.setAttribute("dominant-baseline", "central");
    el.setAttribute("dy", "0");
    el.setAttribute("y", String(this.size_.height / 2));
    el.setAttribute("text-anchor", "start");
    el.setAttribute("x", "0");
    el.style.setProperty("font-size", `${fontPx}px`, "important");
    this.rebuildCaption_(el, card, abstract ? glyph : concreteGlyph, abstract, fontPx);
  }

  private rebuildCaption_(
    el: SVGTextElement,
    card: string,
    glyph: string,
    abstractGlyph: boolean,
    fontPx: number,
  ): void {
    if (typeof document === "undefined") return;
    while (el.firstChild) el.removeChild(el.firstChild);
    this.attrTspan_ = null;

    const attrHelp = this.hasAttrHelp_();
    if (this.attrLabel) {
      const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      tspan.setAttribute(
        "class",
        attrHelp
          ? "blockly-slot-attr-name blockly-spec-help-target"
          : "blockly-slot-attr-name",
      );
      tspan.textContent = this.attrLabel;
      if (attrHelp) {
        tspan.style.cursor = "pointer";
        // Stop Blockly field mousedown→showEditor_ so attr help does not
        // race the abstract ⁇ tip on the same caption.
        tspan.addEventListener("mousedown", (event) => event.stopPropagation());
        tspan.addEventListener("click", (event) => {
          event.stopPropagation();
          dismissSlotLabelTip();
          dismissSpecHelpPopup();
          const help = this.attributeHelp_();
          if (help) showSpecHelpPopup(tspan, help);
        });
      }
      el.appendChild(tspan);
      this.attrTspan_ = tspan;
    }
    if (card) el.appendChild(document.createTextNode(` ${card}`));
    if (glyph) {
      el.appendChild(document.createTextNode(" "));
      if (abstractGlyph) {
        const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan.setAttribute("class", "blockly-slot-abstract-glyph");
        tspan.textContent = glyph;
        tspan.style.cursor = "pointer";
        tspan.addEventListener("mousedown", (event) => event.stopPropagation());
        tspan.addEventListener("click", (event) => {
          event.stopPropagation();
          dismissSpecHelpPopup();
          pinSlotLabelTip(this);
        });
        el.appendChild(tspan);
      } else {
        el.appendChild(document.createTextNode(glyph));
      }
    }
    if (this.rmType_ && isHardToReadRmEmoji(this.rmType_) && !abstractGlyph) {
      el.style.setProperty("font-size", "13px", "important");
    } else {
      el.style.setProperty("font-size", `${fontPx}px`, "important");
    }
  }
}

export function isSlotLabelField(
  field: Field | null | undefined,
): field is FieldSlotLabel {
  return Boolean(field && (field as FieldSlotLabel).isSlotLabelField);
}

export function slotLabelFieldName(inputName: string): string {
  return `${SLOT_LABEL_FIELD_PREFIX}${inputName}`;
}

/**
 * One caption field left of the socket (name + optional card + type glyph).
 * Updates in place when cardinality or allowed RM type changes.
 */
export function appendSlotLabel(
  input: Input,
  attrLabel: string,
  options: {
    card?: SlotCardinality;
    rmType?: string;
    documentation?: string;
  } = {},
): void {
  const name = slotLabelFieldName(input.name);
  const existing = input.fieldRow.find((field) => field.name === name);
  if (existing && isSlotLabelField(existing)) {
    existing.attrLabel = attrLabel;
    existing.setCardinality(options.card);
    existing.setRmType(options.rmType);
    existing.setDocumentation(options.documentation);
    return;
  }
  // Prefer a clean row: drop legacy split name / card / emoji fields.
  for (const field of [...input.fieldRow]) {
    const fname = String(field.name ?? "");
    if (
      fname.startsWith("SLOT_CARD_") ||
      fname.startsWith("SLOT_EMOJI_") ||
      fname === name
    ) {
      try {
        input.removeField(fname, true);
      } catch {
        // Field already gone.
      }
    }
  }
  input.appendField(new FieldSlotLabel(attrLabel, options), name);
}

function cssClass(unmet: boolean, abstractSlot: boolean): string {
  const parts = ["blockly-slot-label"];
  if (unmet) parts.push("blockly-slot-label--unmet");
  if (abstractSlot) parts.push("blockly-slot-label--abstract");
  return parts.join(" ");
}

let measureCanvas: HTMLCanvasElement | null = null;

function measureCaptionWidth(text: string, fontPx: number, abstract: boolean): number {
  if (!text) return 0;
  const family = abstract
    ? '"Google Sans", "Segoe UI", sans-serif'
    : '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Google Sans", sans-serif';
  if (typeof document !== "undefined") {
    try {
      measureCanvas ??= document.createElement("canvas");
      const ctx = measureCanvas.getContext("2d");
      if (ctx) {
        ctx.font = `${fontPx}px ${family}`;
        const w = ctx.measureText(text).width;
        if (w > 0) return Math.ceil(w) + 2;
      }
    } catch {
      // Headless fallthrough.
    }
  }
  return Math.ceil(fontPx * 0.55 * text.length) + 2;
}

const PIN_ID = "blockly-slot-label-tip";

function dismissSlotLabelTip(): void {
  if (typeof document === "undefined") return;
  const tip = document.getElementById(PIN_ID);
  if (!tip) return;
  const cleanup = (tip as HTMLElement & { _dismiss?: () => void })._dismiss;
  cleanup?.();
  stopAnchoring(tip);
  tip.remove();
}

function pinSlotLabelTip(field: FieldSlotLabel): void {
  if (typeof document === "undefined") return;
  Blockly.Tooltip?.hide?.();
  const target = (field as unknown as { getClickTarget_?: () => Element | null })
    .getClickTarget_?.() ?? field.fieldGroup_;
  if (!target || !("getBoundingClientRect" in target)) return;
  const text = rmTypeConnectionTooltip(field.rmType());
  if (!text) return;

  let tip = document.getElementById(PIN_ID);
  if (tip && tip.dataset.anchor === field.pinId) {
    dismissSlotLabelTip();
    return;
  }
  dismissSlotLabelTip();
  tip = document.createElement("div");
  tip.id = PIN_ID;
  tip.className = "blockly-rm-emoji-tip";
  tip.dataset.anchor = field.pinId;
  tip.textContent = text;
  document.body.appendChild(tip);
  anchorFloating(target as Element, tip, {
    placement: "bottom-start",
    offset: 6,
    fitSize: true,
  });

  const dismiss = (event: Event) => {
    if (event.target instanceof Node && tip?.contains(event.target)) return;
    dismissSlotLabelTip();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") dismiss(event);
  };
  document.addEventListener("pointerdown", dismiss, true);
  document.addEventListener("keydown", onKey, true);
  (tip as HTMLElement & { _dismiss?: () => void })._dismiss = () => {
    document.removeEventListener("pointerdown", dismiss, true);
    document.removeEventListener("keydown", onKey, true);
  };
}
