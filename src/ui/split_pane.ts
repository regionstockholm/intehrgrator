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
}

const HANDLE_SIZE = 6;
const DEFAULT_MIN = 80;

function axisSize(el: HTMLElement, axis: SplitAxis): number {
  return axis === "row" ? el.clientWidth : el.clientHeight;
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

function clampSizes(sizes: number[], minPx: number, totalPx: number): number[] {
  if (totalPx <= 0) return sizes;
  const minFrac = minPx / totalPx;
  const next = [...sizes];
  for (let i = 0; i < next.length; i++) {
    next[i] = Math.max(minFrac, next[i] ?? 0);
  }
  const sum = next.reduce((a, b) => a + b, 0);
  return next.map((n) => n / sum);
}

function applySizes(panes: HTMLElement[], sizes: number[], _axis: SplitAxis): void {
  for (let i = 0; i < panes.length; i++) {
    const pct = (sizes[i]! * 100).toFixed(4);
    panes[i]!.style.flex = `0 0 ${pct}%`;
    panes[i]!.style.flexBasis = `${pct}%`;
    panes[i]!.style.minWidth = "0";
    panes[i]!.style.minHeight = "0";
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
    const total = axisSize(container, axis);
    sizes = clampSizes(sizes, minSize, total);
    applySizes(panes, sizes, axis);
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

      const start = axis === "row" ? ev.clientX : ev.clientY;
      const startSizes = [...sizes];
      const total = axisSize(container, axis);
      const minFrac = minSize / Math.max(total, 1);

      const onMove = (moveEv: PointerEvent): void => {
        const pos = axis === "row" ? moveEv.clientX : moveEv.clientY;
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
        applySizes(panes, sizes, axis);
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

function normalize(sizes: number[]): number[] {
  const sum = sizes.reduce((a, b) => a + b, 0);
  if (sum <= 0) return equalSizes(sizes.length);
  return sizes.map((n) => n / sum);
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
  return {
    sizes,
    minSize: Number.isFinite(minSize) ? minSize : undefined,
    storageKey: el.dataset.splitStorage,
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
