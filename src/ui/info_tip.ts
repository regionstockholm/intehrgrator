/** Hover/focus/click balloons for pane info (i) buttons. */

function setOpen(tip: Element, open: boolean): void {
  tip.classList.toggle("is-open", open);
  tip.querySelector(".info-tip-btn")?.setAttribute("aria-expanded", String(open));
}

function closeAll(except?: Element): void {
  document.querySelectorAll(".info-tip.is-open").forEach((tip) => {
    if (tip !== except) setOpen(tip, false);
  });
}

export function installInfoTips(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(".info-tip").forEach((tip) => {
    const btn = tip.querySelector<HTMLButtonElement>(".info-tip-btn");
    if (!btn) return;
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const next = !tip.classList.contains("is-open");
      closeAll(tip);
      setOpen(tip, next);
    });
  });
  document.addEventListener("click", () => closeAll());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAll();
  });
}
