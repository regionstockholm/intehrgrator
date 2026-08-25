/**
 * Click-to-toggle menus portaled to `document.body` and positioned with Floating UI.
 */
import {
  anchorFloating,
  refreshFloating,
  stopAnchoring,
  virtualFromElements,
  type AnchorFloatingOptions,
  type FloatingPlacement,
} from "./floating.ts";

export interface AnchoredMenuHandle {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  refresh: () => void;
}

export interface AnchoredMenuOptions {
  menu: HTMLElement;
  /** Click target that toggles the menu (usually the chevron). */
  trigger: HTMLElement;
  /** Extra elements that count as the menu's "inside" for outside-click. */
  roots?: HTMLElement[];
  /** Elements whose combined box the menu should sit against. Default: trigger. */
  referenceEls?: HTMLElement[];
  /** Minimum menu width — typically the whole split-button group. */
  minWidth?: number | HTMLElement;
  placement?: FloatingPlacement;
  offset?: number;
  /** Called just before the menu is shown (populate items, etc.). */
  onBeforeOpen?: () => void;
}

interface InternalHandle extends AnchoredMenuHandle {
  isInside: (node: Node | null) => boolean;
}

const openMenus = new Set<InternalHandle>();
let globalsInstalled = false;

function ensureGlobals(): void {
  if (globalsInstalled) return;
  globalsInstalled = true;
  document.addEventListener("click", (event) => {
    const t = event.target as Node | null;
    for (const handle of [...openMenus]) {
      if (handle.isInside(t)) continue;
      handle.close();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllAnchoredMenus();
  });
}

export function closeAllAnchoredMenus(): void {
  for (const handle of [...openMenus]) handle.close();
}

export function installAnchoredMenu(options: AnchoredMenuOptions): AnchoredMenuHandle {
  const { menu, trigger } = options;
  const roots = options.roots ?? [];
  const referenceEls = options.referenceEls?.length ? options.referenceEls : [trigger];
  const floatingOpts: AnchorFloatingOptions = {
    placement: options.placement ?? "bottom-end",
    offset: options.offset ?? 2,
    minWidth: options.minWidth,
    fitSize: true,
  };

  if (menu.parentElement !== document.body) document.body.append(menu);

  const close = () => {
    if (menu.hidden) return;
    stopAnchoring(menu);
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    openMenus.delete(handle);
  };

  const open = () => {
    ensureGlobals();
    closeAllAnchoredMenus();
    options.onBeforeOpen?.();
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    const reference = referenceEls.length === 1
      ? referenceEls[0]
      : virtualFromElements(referenceEls);
    anchorFloating(reference, menu, floatingOpts);
    openMenus.add(handle);
  };

  const refresh = () => {
    if (menu.hidden) return;
    refreshFloating(menu);
  };

  const isInside = (node: Node | null): boolean => {
    if (!node) return false;
    if (menu.contains(node) || trigger.contains(node)) return true;
    return roots.some((el) => el.contains(node));
  };

  const handle: InternalHandle = {
    open,
    close,
    refresh,
    isOpen: () => !menu.hidden,
    isInside,
  };

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!menu.hidden) {
      close();
      return;
    }
    open();
  });
  menu.addEventListener("click", (event) => event.stopPropagation());

  return handle;
}
