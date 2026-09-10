import { HELP_LINKS, type HelpLinkKey } from "./help_links.ts";

export interface HelpDialogOptions {
  dialog: HTMLDialogElement;
  openButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  versionEl: HTMLElement;
  originEl: HTMLElement;
  copyButton: HTMLButtonElement;
  getVersionText: () => string;
  copyToClipboard: (text: string) => Promise<void> | void;
}

function isHelpLinkKey(value: string): value is HelpLinkKey {
  return Object.hasOwn(HELP_LINKS, value);
}

export function sessionOrigin(locationLike: { origin: string } = globalThis.location): string {
  return locationLike.origin;
}

export function diagnosticsText(versionText: string, origin: string): string {
  return `${versionText.trim()}\n${origin}`;
}

export function installHelpDialog(options: HelpDialogOptions): void {
  const {
    dialog,
    openButton,
    closeButton,
    versionEl,
    originEl,
    copyButton,
    getVersionText,
    copyToClipboard,
  } = options;

  for (const anchor of dialog.querySelectorAll<HTMLAnchorElement>("[data-help-link]")) {
    const key = anchor.dataset.helpLink;
    if (!key || !isHelpLinkKey(key)) continue;
    anchor.href = HELP_LINKS[key];
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  }

  const fill = () => {
    const version = getVersionText().trim() || "unknown build";
    const origin = sessionOrigin();
    versionEl.textContent = version;
    originEl.textContent = origin;
  };

  openButton.addEventListener("click", () => {
    fill();
    dialog.showModal();
  });
  closeButton.addEventListener("click", () => dialog.close());

  const defaultCopyLabel = copyButton.textContent ?? "Copy version";
  copyButton.addEventListener("click", async () => {
    fill();
    await copyToClipboard(diagnosticsText(versionEl.textContent ?? "", originEl.textContent ?? ""));
    copyButton.textContent = "Copied";
    globalThis.setTimeout(() => {
      copyButton.textContent = defaultCopyLabel;
    }, 1500);
  });
}
