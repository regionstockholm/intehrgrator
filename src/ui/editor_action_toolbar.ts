/**
 * Shared Search / Copy / Download icon toolbar for CodeMirror editor hosts.
 */
import { openSearchPanel } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";
import type { ChromeMessages } from "./chrome_en.ts";
import { chrome } from "./chrome_i18n.ts";

const COPY_PATH =
  "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z";
const CHECK_PATH = "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z";

const COPY_FEEDBACK_MS = 1800;

export type EditorActionI18nKeys = {
  searchTitle: keyof ChromeMessages;
  searchAria: keyof ChromeMessages;
  copyTitle: keyof ChromeMessages;
  copyAria: keyof ChromeMessages;
  downloadTitle: keyof ChromeMessages;
  downloadAria: keyof ChromeMessages;
};

export type WireEditorActionToolbarOptions = {
  toolbar: HTMLElement;
  view: EditorView;
  /** Copy full editor document text (or a caller-chosen payload). */
  copyText: (text: string) => Promise<void>;
  /** When omitted, Copy uses `view.state.doc.toString()`. */
  getCopyText?: () => string;
  onDownload: () => void;
  locale: () => string;
  i18n: EditorActionI18nKeys;
};

function iconSvg(pathD: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", "0 0 24 24");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  svg.append(path);
  return svg;
}

function setIcon(btn: HTMLButtonElement, pathD: string): void {
  btn.replaceChildren(iconSvg(pathD));
}

function labelFor(locale: string, key: keyof ChromeMessages): string {
  return chrome(locale)[key];
}

/**
 * Wire Search / Copy / Download buttons already present under `.editor-action-toolbar`.
 * Buttons are matched by `data-editor-action` (`search` | `copy` | `download`).
 */
export function wireEditorActionToolbar(
  options: WireEditorActionToolbarOptions,
): { downloadButton: HTMLButtonElement } {
  const searchBtn = options.toolbar.querySelector<HTMLButtonElement>(
    '[data-editor-action="search"]',
  );
  const copyBtn = options.toolbar.querySelector<HTMLButtonElement>(
    '[data-editor-action="copy"]',
  );
  const downloadBtn = options.toolbar.querySelector<HTMLButtonElement>(
    '[data-editor-action="download"]',
  );
  if (!searchBtn || !copyBtn || !downloadBtn) {
    throw new Error("editor-action-toolbar: missing search/copy/download button");
  }

  searchBtn.addEventListener("click", () => {
    options.view.focus();
    openSearchPanel(options.view);
  });

  let copyResetTimer: number | undefined;
  copyBtn.addEventListener("click", () => {
    void (async () => {
      const text = options.getCopyText?.() ?? options.view.state.doc.toString();
      await options.copyText(text);
      const locale = options.locale();
      const copied = labelFor(locale, "copied");
      setIcon(copyBtn, CHECK_PATH);
      copyBtn.title = copied;
      copyBtn.setAttribute("aria-label", copied);
      if (copyResetTimer !== undefined) globalThis.clearTimeout(copyResetTimer);
      copyResetTimer = globalThis.setTimeout(() => {
        setIcon(copyBtn, COPY_PATH);
        copyBtn.title = labelFor(locale, options.i18n.copyTitle);
        copyBtn.setAttribute("aria-label", labelFor(locale, options.i18n.copyAria));
        copyResetTimer = undefined;
      }, COPY_FEEDBACK_MS);
    })();
  });

  downloadBtn.addEventListener("click", () => options.onDownload());

  return { downloadButton: downloadBtn };
}
