/**
 * Viewport-safe overlay positioning via Floating UI (`@floating-ui/dom`).
 * All app popups, tooltips, and dropdowns should go through this helper
 * instead of hand-rolled `getBoundingClientRect` math.
 */
import {
  autoUpdate,
  computePosition,
  flip,
  hide,
  offset,
  shift,
  size,
  type Middleware,
  type Placement,
  type VirtualElement,
} from "@floating-ui/dom";

export type FloatingPlacement = Placement;
export type FloatingReference = Element | VirtualElement;

export interface Box {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface AnchorFloatingOptions {
  placement?: Placement;
  /** Gap between reference and floating element, in px. Default 6. */
  offset?: number;
  /** Viewport padding, in px. Default 8. */
  padding?: number;
  /** Keep the floating element at least this wide (capped by available space). */
  minWidth?: number | Element;
  /** Constrain max width/height to remaining viewport space. Default true. */
  fitSize?: boolean;
  /** Apply max-height to this inner scroller instead of the floating root. */
  sizeTarget?: HTMLElement | (() => HTMLElement | null);
}

const EDGE = 8;
const GAP = 6;
const cleanups = new WeakMap<HTMLElement, () => void>();
const refreshers = new WeakMap<HTMLElement, () => void>();

export function unionBoxes(
  boxes: Array<{ top: number; left: number; right: number; bottom: number }>,
): Box {
  const top = Math.min(...boxes.map((b) => b.top));
  const left = Math.min(...boxes.map((b) => b.left));
  const right = Math.max(...boxes.map((b) => b.right));
  const bottom = Math.max(...boxes.map((b) => b.bottom));
  return {
    top,
    left,
    right,
    bottom,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

/** Virtual reference spanning one or more DOM elements (e.g. a split button). */
export function virtualFromElements(elements: Element[]): VirtualElement {
  const first = elements[0];
  return {
    contextElement: first,
    getBoundingClientRect: () => {
      const box = unionBoxes(elements.map((el) => el.getBoundingClientRect()));
      return {
        x: box.x,
        y: box.y,
        top: box.top,
        left: box.left,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    },
  };
}

function resolveMinWidth(minWidth: number | Element | undefined): number {
  if (minWidth == null) return 0;
  if (typeof minWidth === "number") return minWidth;
  return minWidth.getBoundingClientRect().width;
}

function sizeApplyTarget(
  floating: HTMLElement,
  sizeTarget: AnchorFloatingOptions["sizeTarget"],
): HTMLElement {
  if (typeof sizeTarget === "function") return sizeTarget() ?? floating;
  return sizeTarget ?? floating;
}

function middlewareFor(
  floating: HTMLElement,
  options: AnchorFloatingOptions,
): Middleware[] {
  const padding = options.padding ?? EDGE;
  const list: Middleware[] = [
    offset(options.offset ?? GAP),
    flip({ padding, fallbackStrategy: "bestFit" }),
    shift({ padding }),
  ];
  if (options.fitSize !== false) {
    list.push(
      size({
        padding,
        apply({ availableWidth, availableHeight }) {
          const target = sizeApplyTarget(floating, options.sizeTarget);
          const minW = resolveMinWidth(options.minWidth);
          const maxW = Math.max(0, availableWidth);
          const maxH = Math.max(0, availableHeight);
          if (minW > 0) target.style.minWidth = `${Math.min(minW, maxW)}px`;
          target.style.maxWidth = `${maxW}px`;
          target.style.maxHeight = `${maxH}px`;
          target.style.overflowY = "auto";
        },
      }),
    );
  }
  list.push(hide());
  return list;
}

function prepareFloating(floating: HTMLElement): void {
  floating.style.position = "fixed";
  floating.style.top = "0";
  floating.style.left = "0";
  floating.style.right = "auto";
  floating.style.bottom = "auto";
  floating.style.margin = "0";
}

async function placeOnce(
  reference: FloatingReference,
  floating: HTMLElement,
  options: AnchorFloatingOptions,
): Promise<void> {
  prepareFloating(floating);
  const { x, y, middlewareData } = await computePosition(reference, floating, {
    placement: options.placement ?? "bottom-start",
    strategy: "fixed",
    middleware: middlewareFor(floating, options),
  });
  const hidden = Boolean(middlewareData.hide?.referenceHidden);
  Object.assign(floating.style, {
    left: `${x}px`,
    top: `${y}px`,
    visibility: hidden ? "hidden" : "visible",
  });
}

/**
 * Keep `floating` anchored to `reference` (flip / shift / size to the viewport).
 * Returns a cleanup that must be called when the overlay is hidden or removed.
 */
export function anchorFloating(
  reference: FloatingReference,
  floating: HTMLElement,
  options: AnchorFloatingOptions = {},
): () => void {
  stopAnchoring(floating);
  prepareFloating(floating);
  floating.style.visibility = "hidden";

  const update = () => {
    void placeOnce(reference, floating, options);
  };
  const stop = autoUpdate(reference, floating, update);
  refreshers.set(floating, update);
  const cleanup = () => {
    stop();
    refreshers.delete(floating);
    if (cleanups.get(floating) === cleanup) cleanups.delete(floating);
  };
  cleanups.set(floating, cleanup);
  update();
  return cleanup;
}

/** Re-run placement for an already-anchored overlay (e.g. after menu contents change). */
export function refreshFloating(floating: HTMLElement): void {
  refreshers.get(floating)?.();
}

export function stopAnchoring(floating: HTMLElement): void {
  const cleanup = cleanups.get(floating);
  if (!cleanup) return;
  cleanup();
  floating.style.visibility = "";
}
