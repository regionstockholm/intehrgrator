/** Hover/focus/click balloons for pane info (i) buttons.
 * Balloons are portaled to document.body so overflow:hidden panes cannot clip them.
 */

const LAYER_ID = "info-tip-layer";
const GAP = 6;
const MARGIN = 8;

export interface Box {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface BalloonPosition {
  top: number;
  left: number;
}

/** Viewport-clamped fixed coordinates for a balloon relative to its (i) button. */
export function computeBalloonPosition(
  button: Box,
  balloon: { width: number; height: number },
  viewport: { width: number; height: number },
  preferEnd: boolean,
  gap = GAP,
  margin = MARGIN,
): BalloonPosition {
  const bw = Math.min(balloon.width, Math.max(0, viewport.width - margin * 2));
  const bh = balloon.height;
  let left = preferEnd ? button.right - bw : button.left;
  left = Math.min(Math.max(margin, left), viewport.width - bw - margin);

  const below = button.bottom + gap;
  const above = button.top - gap - bh;
  const fitsBelow = below + bh <= viewport.height - margin;
  const fitsAbove = above >= margin;
  const top = !fitsBelow && fitsAbove ? above : Math.max(margin, below);

  return { top, left };
}

function setOpen(tip: Element, open: boolean): void {
  tip.classList.toggle("is-open", open);
  tip.querySelector(".info-tip-btn")?.setAttribute("aria-expanded", String(open));
}

function closeAll(except?: Element): void {
  document.querySelectorAll<HTMLElement>(".info-tip.is-open, .info-tip.is-hover").forEach((tip) => {
    if (tip === except) return;
    setOpen(tip, false);
    tip.classList.remove("is-hover");
    sync(tip);
  });
}

function ensureLayer(): HTMLElement {
  let layer = document.getElementById(LAYER_ID);
  if (!layer) {
    layer = document.createElement("div");
    layer.id = LAYER_ID;
    document.body.appendChild(layer);
  }
  return layer;
}

const balloons = new WeakMap<HTMLElement, HTMLElement>();
const attached = new WeakSet<HTMLElement>();
let globalsInstalled = false;

function balloonFor(tip: HTMLElement): HTMLElement | null {
  return balloons.get(tip) ?? tip.querySelector<HTMLElement>(".info-tip-balloon");
}

function place(tip: HTMLElement): void {
  const btn = tip.querySelector<HTMLElement>(".info-tip-btn");
  const balloon = balloonFor(tip);
  if (!btn || !balloon) return;
  balloons.set(tip, balloon);

  const layer = ensureLayer();
  if (balloon.parentElement !== layer) layer.appendChild(balloon);

  balloon.hidden = false;
  balloon.style.display = "block";
  balloon.style.position = "fixed";
  balloon.style.visibility = "hidden";
  balloon.style.left = "0px";
  balloon.style.top = "0px";

  const pos = computeBalloonPosition(
    btn.getBoundingClientRect(),
    { width: balloon.offsetWidth, height: balloon.offsetHeight },
    { width: globalThis.innerWidth, height: globalThis.innerHeight },
    tip.classList.contains("info-tip--end"),
  );
  balloon.style.left = `${pos.left}px`;
  balloon.style.top = `${pos.top}px`;
  balloon.style.visibility = "visible";
}

function restore(tip: HTMLElement): void {
  const balloon = balloonFor(tip);
  if (!balloon) return;
  balloon.style.display = "";
  balloon.style.visibility = "";
  balloon.style.position = "";
  balloon.style.left = "";
  balloon.style.top = "";
  balloon.hidden = true;
  if (balloon.parentElement !== tip) tip.appendChild(balloon);
}

function isShown(tip: HTMLElement): boolean {
  return tip.classList.contains("is-open") || tip.classList.contains("is-hover");
}

function sync(tip: HTMLElement): void {
  if (isShown(tip)) place(tip);
  else restore(tip);
}

/** Bind one (i) marker. Safe to call for dynamically created tips (e.g. CodeMirror widgets). */
export function attachInfoTip(tip: HTMLElement): void {
  if (attached.has(tip)) return;
  const btn = tip.querySelector<HTMLButtonElement>(".info-tip-btn");
  if (!btn) return;
  attached.add(tip);
  ensureGlobals();

  let hideTimer = 0;
  const cancelHide = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }
  };
  const scheduleHide = () => {
    if (tip.classList.contains("is-open")) return;
    cancelHide();
    hideTimer = globalThis.setTimeout(() => {
      tip.classList.remove("is-hover");
      sync(tip);
    }, 120);
  };

  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const next = !tip.classList.contains("is-open");
    closeAll(tip);
    setOpen(tip, next);
    if (next) tip.classList.add("is-hover");
    else tip.classList.remove("is-hover");
    sync(tip);
  });

  tip.addEventListener("mouseenter", () => {
    cancelHide();
    tip.classList.add("is-hover");
    sync(tip);
  });
  tip.addEventListener("mouseleave", () => scheduleHide());
  tip.addEventListener("focusin", () => {
    cancelHide();
    tip.classList.add("is-hover");
    sync(tip);
  });
  tip.addEventListener("focusout", (event) => {
    const next = event.relatedTarget as Node | null;
    const balloon = balloonFor(tip);
    if (next && (tip.contains(next) || balloon?.contains(next))) return;
    scheduleHide();
  });

  const balloon = tip.querySelector<HTMLElement>(".info-tip-balloon");
  balloon?.addEventListener("mouseenter", () => {
    cancelHide();
    tip.classList.add("is-hover");
  });
  balloon?.addEventListener("mouseleave", () => scheduleHide());
  balloon?.addEventListener("click", (event) => event.stopPropagation());
}

/** Return a portaled balloon to its tip (call when the tip's host is destroyed). */
export function detachInfoTip(tip: HTMLElement): void {
  tip.classList.remove("is-open", "is-hover");
  restore(tip);
}

function ensureGlobals(): void {
  if (globalsInstalled) return;
  globalsInstalled = true;

  document.addEventListener("click", () => {
    closeAll();
    document.querySelectorAll<HTMLElement>(".info-tip.is-hover").forEach((tip) => {
      tip.classList.remove("is-hover");
      sync(tip);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeAll();
    document.querySelectorAll<HTMLElement>(".info-tip").forEach((tip) => {
      tip.classList.remove("is-hover");
      sync(tip);
    });
  });
  const reposition = () => {
    document.querySelectorAll<HTMLElement>(".info-tip").forEach((tip) => {
      if (isShown(tip)) place(tip);
    });
  };
  globalThis.addEventListener("resize", reposition);
  globalThis.addEventListener("scroll", reposition, true);
}

export function installInfoTips(root: ParentNode = document): void {
  ensureGlobals();
  root.querySelectorAll<HTMLElement>(".info-tip").forEach((tip) => attachInfoTip(tip));
}
