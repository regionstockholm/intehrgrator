/** Drag-to-resize flex split groups for arbitrary pane/section layouts. */

export type SplitAxis = "row" | "column";

export interface SplitGroupOptions {
  /** Initial size ratios per child (must sum to ~1). Default: equal shares. */
  sizes?: number[];
  /** Minimum pane size in pixels. Default: 80 */
  minSize?: number;
  /** Persist ratios in localStorage under this key. */
  storageKey?: string;
  /** Called after a drag resize or container size change. */
  onResize?: () => void;
  /**
   * Pane index that should stay the largest when space is tight
   * (the Blockly mapping canvas).
   */
  preferredIndex?: number;
  /** Minimum fraction of the container the preferred pane should keep. Default 0.5 */
  preferredMinFrac?: number;
}

const HANDLE_SIZE = 6;
const DEFAULT_MIN = 80;

/** Match `web/styles.css` stacked-pane breakpoint. */
export const NARROW_MAIN_PANES_MAX_WIDTH_PX = 1100;

/** Prefer the Mapping Editors (Blockly) pane when the main row stacks. */
export function mappingPaneLeadsOnNarrow(viewportWidth: number): boolean {
  return viewportWidth <= NARROW_MAIN_PANES_MAX_WIDTH_PX;
}

/**
 * When CSS forces `flex-direction` (narrow stacked panes), measure and drag
 * along that visual axis rather than the declared `data-split` axis.
 */
export function visualAxisFromFlexDirection(
  flexDirection: string,
  declared: SplitAxis,
): SplitAxis {
  if (flexDirection === "column" || flexDirection === "column-reverse") return "column";
  if (flexDirection === "row" || flexDirection === "row-reverse") return "row";
  return declared;
}

function axisSize(el: HTMLElement, axis: SplitAxis): number {
  return axis === "row" ? el.clientWidth : el.clientHeight;
}

function resolvedAxis(container: HTMLElement, declared: SplitAxis): SplitAxis {
  if (typeof getComputedStyle !== "function") return declared;
  return visualAxisFromFlexDirection(getComputedStyle(container).flexDirection, declared);
}

function loadSizes(key: string, count: number): number[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as number[];
    if (parsed.length !== count || parsed.some((n) => !Number.isFinite(n) || n <= 0)) return null;
    const sum = parsed.reduce((a, b) => a + b, 0);
    return parsed.map((n) => n / sum);
  } catch {
    return null;
  }
}

function saveSizes(key: string, sizes: number[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(sizes));
  } catch {
    // quota / private mode
  }
}

function equalSizes(count: number): number[] {
  return Array.from({ length: count }, () => 1 / count);
}

function normalize(sizes: number[]): number[] {
  const sum = sizes.reduce((a, b) => a + b, 0);
  if (sum <= 0) return equalSizes(sizes.length);
  return sizes.map((n) => n / sum);
}

/**
 * Clamp flex ratios so every pane meets `minPx`, optionally keeping
 * `preferred.index` at least `preferred.minFrac` of the container when the
 * leftover space allows it.
 */
export function clampSplitSizes(
  sizes: number[],
  minPx: number,
  totalPx: number,
  preferred?: { index: number; minFrac: number },
): number[] {
  if (totalPx <= 0 || sizes.length === 0) return sizes;
  const minFrac = minPx / totalPx;
  let next = normalize(sizes).map((s) => Math.max(minFrac, s));
  next = normalize(next);
  if (
    preferred &&
    preferred.index >= 0 &&
    preferred.index < next.length &&
    Number.isFinite(preferred.minFrac)
  ) {
    const othersMin = minFrac * Math.max(0, next.length - 1);
    const want = Math.min(
      Math.max(preferred.minFrac, minFrac),
      Math.max(minFrac, 1 - othersMin),
    );
    if ((next[preferred.index] ?? 0) < want - 1e-12) {
      const rest = Math.max(0, 1 - want);
      const otherWeight = next.reduce(
        (sum, s, i) => i === preferred.index ? sum : sum + s,
        0,
      );
      next = next.map((s, i) => {
        if (i === preferred.index) return want;
        if (otherWeight <= 0) {
          return rest / Math.max(1, next.length - 1);
        }
        return (s / otherWeight) * rest;
      });
      next = next.map((s) => Math.max(minFrac, s));
      next = normalize(next);
    }
  }
  return next;
}

function applySizes(panes: HTMLElement[], sizes: number[], _axis: SplitAxis): void {
  for (let i = 0; i < panes.length; i++) {
    const pct = (sizes[i]! * 100).toFixed(4);
    panes[i]!.style.flex = `0 0 ${pct}%`;
    panes[i]!.style.flexBasis = `${pct}%`;
    // Do not set minWidth/minHeight here: CSS owns overflow mins, and the
    // narrow stacked layout needs a real min-height on the mapping pane.
  }
}

function childElements(container: HTMLElement): HTMLElement[] {
  return [...container.children].filter((n): n is HTMLElement => n.nodeType === Node.ELEMENT_NODE);
}

/**
 * Make direct children of `container` resizable panes.
 * Inserts drag handles between children. Returns a dispose function.
 */
export function initSplitGroup(
  container: HTMLElement,
  axis: SplitAxis,
  options: SplitGroupOptions = {},
): () => void {
  const minSize = options.minSize ?? DEFAULT_MIN;
  const panes = childElements(container);
  if (panes.length < 2) return () => {};

  container.classList.add("split-group", axis === "row" ? "split-group--row" : "split-group--column");
  for (const pane of panes) pane.classList.add("split-pane");

  let sizes =
    (options.storageKey ? loadSizes(options.storageKey, panes.length) : null) ??
    (options.sizes?.length === panes.length ? normalize(options.sizes) : equalSizes(panes.length));

  const handles: HTMLElement[] = [];
  const cleanups: (() => void)[] = [];

  for (let i = 0; i < panes.length - 1; i++) {
    const handle = document.createElement("div");
    handle.className = `split-handle ${axis === "row" ? "split-handle--col" : "split-handle--row"}`;
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", axis === "row" ? "vertical" : "horizontal");
    handle.tabIndex = 0;
    panes[i]!.after(handle);
    handles.push(handle);
  }

  const refresh = (): void => {
    const liveAxis = resolvedAxis(container, axis);
    const total = axisSize(container, liveAxis);
    const preferred = options.preferredIndex != null
      ? {
        index: options.preferredIndex,
        minFrac: options.preferredMinFrac ?? 0.5,
      }
      : undefined;
    sizes = clampSplitSizes(sizes, minSize, total, preferred);
    applySizes(panes, sizes, liveAxis);
    options.onResize?.();
    container.dispatchEvent(new CustomEvent("split-resize", { bubbles: true }));
  };

  refresh();

  for (let i = 0; i < handles.length; i++) {
    const handle = handles[i]!;
    const leftIdx = i;
    const rightIdx = i + 1;

    const onPointerDown = (ev: PointerEvent): void => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      handle.setPointerCapture(ev.pointerId);
      handle.classList.add("split-handle--active");

      const liveAxis = resolvedAxis(container, axis);
      const start = liveAxis === "row" ? ev.clientX : ev.clientY;
      const startSizes = [...sizes];
      const total = axisSize(container, liveAxis);
      const minFrac = minSize / Math.max(total, 1);

      const onMove = (moveEv: PointerEvent): void => {
        const pos = liveAxis === "row" ? moveEv.clientX : moveEv.clientY;
        const delta = (pos - start) / Math.max(total, 1);
        const next = [...startSizes];
        next[leftIdx] = (startSizes[leftIdx] ?? 0) + delta;
        next[rightIdx] = (startSizes[rightIdx] ?? 0) - delta;
        if (next[leftIdx]! < minFrac) {
          const diff = minFrac - next[leftIdx]!;
          next[leftIdx] = minFrac;
          next[rightIdx] = (next[rightIdx] ?? 0) + diff;
        }
        if (next[rightIdx]! < minFrac) {
          const diff = minFrac - next[rightIdx]!;
          next[rightIdx] = minFrac;
          next[leftIdx] = (next[leftIdx] ?? 0) + diff;
        }
        sizes = normalize(next);
        applySizes(panes, sizes, liveAxis);
        options.onResize?.();
        container.dispatchEvent(new CustomEvent("split-resize", { bubbles: true }));
      };

      const onUp = (): void => {
        handle.classList.remove("split-handle--active");
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        if (options.storageKey) saveSizes(options.storageKey, sizes);
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    };

    handle.addEventListener("pointerdown", onPointerDown);
    cleanups.push(() => handle.removeEventListener("pointerdown", onPointerDown));
  }

  const ro = new ResizeObserver(() => refresh());
  ro.observe(container);
  cleanups.push(() => ro.disconnect());

  return () => {
    for (const fn of cleanups) fn();
    for (const handle of handles) handle.remove();
    container.classList.remove("split-group", "split-group--row", "split-group--column");
    for (const pane of panes) {
      pane.classList.remove("split-pane");
      pane.style.flex = "";
      pane.style.flexBasis = "";
    }
  };
}

function readOptions(el: HTMLElement): SplitGroupOptions {
  const minAttr = el.dataset.splitMin;
  const minSize = minAttr ? Number(minAttr) : undefined;
  const sizesAttr = el.dataset.splitSizes;
  let sizes: number[] | undefined;
  if (sizesAttr) {
    const parts = sizesAttr.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
    if (parts.length) sizes = normalize(parts);
  }
  const preferredAttr = el.dataset.splitPreferred;
  const preferredIndex = preferredAttr != null && preferredAttr !== ""
    ? Number(preferredAttr)
    : undefined;
  return {
    sizes,
    minSize: Number.isFinite(minSize) ? minSize : undefined,
    storageKey: el.dataset.splitStorage,
    preferredIndex: Number.isFinite(preferredIndex) ? preferredIndex : undefined,
  };
}

/** Initialize every `[data-split]` element under `root`. */
export function initSplitPanes(
  root: ParentNode = document,
  onResize?: () => void,
): () => void {
  const disposers: (() => void)[] = [];
  const nodes = root.querySelectorAll<HTMLElement>("[data-split]");
  for (const el of nodes) {
    const axis = el.dataset.split === "column" ? "column" : "row";
    const opts = readOptions(el);
    if (onResize) opts.onResize = onResize;
    disposers.push(initSplitGroup(el, axis, opts));
  }
  return () => {
    for (const d of disposers) d();
  };
}

export { HANDLE_SIZE };
