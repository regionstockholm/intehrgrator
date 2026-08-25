/**
 * Reposition Blockly dropdowns and tooltips with Floating UI so they stay
 * inside the viewport instead of Blockly's workspace-bounded math.
 */
import { Blockly } from "./blockly_core.ts";
import {
  anchorFloating,
  stopAnchoring,
  type FloatingReference,
} from "../ui/floating.ts";

type FieldLike = {
  getClickTarget_?: () => Element | null;
  fieldGroup_?: Element | null;
};

type DropDownDivLike = {
  show: (...args: unknown[]) => boolean;
  hide: () => void;
  hideWithoutAnimation: () => void;
  getOwner: () => FieldLike | null;
  getContentDiv: () => Element;
};

type TooltipLike = {
  getDiv: () => HTMLDivElement | null;
  isVisible: () => boolean;
  hide: () => void;
};

let installed = false;
let tooltipObserver: MutationObserver | null = null;
let lastPointer: { x: number; y: number } | null = null;
let tooltipAnchored = false;

function fieldReference(field: FieldLike | null): Element | null {
  if (!field) return null;
  return field.getClickTarget_?.() ?? field.fieldGroup_ ?? null;
}

function dropdownRoot(dd: DropDownDivLike): HTMLElement | null {
  const content = dd.getContentDiv() as HTMLElement | null;
  const root = content?.parentElement ?? document.querySelector(".blocklyDropDownDiv");
  return root instanceof HTMLElement ? root : null;
}

function pointerReference(): FloatingReference {
  const x = lastPointer?.x ?? 0;
  const y = lastPointer?.y ?? 0;
  return {
    getBoundingClientRect: () => ({
      x,
      y,
      top: y,
      left: x,
      right: x,
      bottom: y,
      width: 0,
      height: 0,
    }),
  };
}

function patchDropDownDiv(): void {
  const dd = (Blockly as unknown as { DropDownDiv?: DropDownDivLike }).DropDownDiv;
  if (!dd?.show) return;
  const origShow = dd.show.bind(dd);
  const origHide = dd.hide.bind(dd);
  const origHideWithout = dd.hideWithoutAnimation?.bind(dd) ?? origHide;

  const release = () => {
    const root = dropdownRoot(dd);
    if (root) stopAnchoring(root);
  };

  dd.show = (...args: unknown[]) => {
    const result = origShow(...args);
    queueMicrotask(() => {
      const root = dropdownRoot(dd);
      const ref = fieldReference(dd.getOwner());
      if (!root || !ref) return;
      const content = dd.getContentDiv() as HTMLElement | null;
      anchorFloating(ref, root, {
        placement: "bottom-start",
        offset: 4,
        fitSize: true,
        sizeTarget: content && content !== root ? content : undefined,
      });
    });
    return result;
  };
  dd.hide = () => {
    release();
    origHide();
  };
  dd.hideWithoutAnimation = () => {
    release();
    origHideWithout();
  };
}

function patchTooltip(): void {
  const Tooltip = (Blockly as unknown as { Tooltip?: TooltipLike }).Tooltip;
  if (!Tooltip?.getDiv) return;

  const trackPointer = (event: PointerEvent) => {
    lastPointer = { x: event.clientX, y: event.clientY };
  };
  document.addEventListener("pointermove", trackPointer, true);

  const sync = () => {
    const div = Tooltip.getDiv();
    if (!div) return;
    const visible = Tooltip.isVisible();
    if (!visible) {
      if (tooltipAnchored) stopAnchoring(div);
      tooltipAnchored = false;
      return;
    }
    if (tooltipAnchored) return;
    tooltipAnchored = true;
    anchorFloating(pointerReference(), div, {
      placement: "bottom-start",
      offset: 10,
      fitSize: true,
    });
  };

  tooltipObserver?.disconnect();
  tooltipObserver = new MutationObserver(sync);
  const attach = () => {
    const div = Tooltip.getDiv();
    if (!div) return;
    tooltipObserver?.observe(div, { attributes: true, attributeFilter: ["style", "class"] });
    sync();
  };
  attach();
  // Tooltip DOM is created at inject time; retry once if this ran too early.
  if (!Tooltip.getDiv()) queueMicrotask(attach);
}

/** Call once after `Blockly.inject` so overlay divs exist. */
export function installBlocklyFloatingOverlays(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  patchDropDownDiv();
  patchTooltip();
}
