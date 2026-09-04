/**
 * Anchored popup for RM/schema documentation: external links + scrollable body.
 */
import { anchorFloating, stopAnchoring } from "./floating.ts";
import type { SpecHelpContent } from "../core/spec_help.ts";

const POPUP_ID = "intehrgrator-spec-help-popup";

export function showSpecHelpPopup(
  anchor: Element,
  content: SpecHelpContent,
): void {
  if (typeof document === "undefined") return;
  dismissSpecHelpPopup();

  const root = document.createElement("div");
  root.id = POPUP_ID;
  root.className = "spec-help-popup";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", content.title);

  const header = document.createElement("div");
  header.className = "spec-help-popup__header";
  const title = document.createElement("div");
  title.className = "spec-help-popup__title";
  title.textContent = content.title;
  header.append(title);
  if (content.subtitle) {
    const sub = document.createElement("div");
    sub.className = "spec-help-popup__subtitle";
    sub.textContent = content.subtitle;
    header.append(sub);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.className = "spec-help-popup__close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "×";
  close.addEventListener("click", () => dismissSpecHelpPopup());
  header.append(close);
  root.append(header);

  if (content.links.length) {
    const links = document.createElement("div");
    links.className = "spec-help-popup__links";
    for (const link of content.links) {
      const a = document.createElement("a");
      a.href = link.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = link.label;
      links.append(a);
    }
    root.append(links);
  }

  const body = document.createElement("div");
  body.className = "spec-help-popup__body";
  body.textContent = content.body;
  root.append(body);

  document.body.appendChild(root);
  anchorFloating(anchor, root, {
    placement: "bottom-start",
    offset: 8,
    fitSize: true,
    sizeTarget: body,
    minWidth: 280,
  });

  const onPointer = (event: Event) => {
    if (event.target instanceof Node && root.contains(event.target)) return;
    dismissSpecHelpPopup();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") dismissSpecHelpPopup();
  };
  document.addEventListener("pointerdown", onPointer, true);
  document.addEventListener("keydown", onKey, true);
  root.dataset.dismissBound = "1";
  (root as HTMLElement & { _dismiss?: () => void })._dismiss = () => {
    document.removeEventListener("pointerdown", onPointer, true);
    document.removeEventListener("keydown", onKey, true);
  };
}

export function dismissSpecHelpPopup(): void {
  if (typeof document === "undefined") return;
  const tip = document.getElementById(POPUP_ID);
  if (!tip) return;
  const dismiss = (tip as HTMLElement & { _dismiss?: () => void })._dismiss;
  dismiss?.();
  stopAnchoring(tip);
  tip.remove();
}
