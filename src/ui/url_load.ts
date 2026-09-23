/** Split load buttons (from file / from URL) plus a shared URL dialog with history. */

import {
  forgetUrl,
  listUrlHistory,
  rememberUrl,
  type UrlHistoryKind,
} from "../host/url_history.ts";
import { isGitHubExamplesDirectoryUrl } from "../core/source/github_examples.ts";
import { closeAllAnchoredMenus, installAnchoredMenu } from "./anchored_menu.ts";
import { detectLocale } from "../blockly/i18n/locale.ts";
import { chrome, formatMessage } from "./chrome_i18n.ts";

export type { UrlHistoryKind };

export interface SplitLoadKindConfig {
  main: HTMLButtonElement;
  chevron: HTMLButtonElement;
  menu: HTMLElement;
  fromFile: () => void | Promise<void>;
  fromUrl: (url: string) => Promise<void>;
  /** When set, used for ▾ → From GitHub folder… dialog submissions. */
  fromGitHubDirectory?: (url: string) => Promise<void>;
  title: string;
  hint: string;
  placeholder: string;
  historyHeading: string;
  /** Optional non-destructive refresh (keeps canvas mappings). */
  refresh?: {
    fromFile: () => void | Promise<void>;
    fromUrl: (url: string) => Promise<void>;
  };
  /** Extra first-class menu action, e.g. GitHub .t.json closure load. */
  github?: {
    label: string;
    title: string;
    hint: string;
    placeholder: string;
  };
  /** Bulk load JSON/XML instances from a local folder. */
  bulkLocal?: {
    label: string;
    fromDirectory: () => void | Promise<void>;
  };
  /** Bulk load JSON/XML instances from a GitHub tree URL. */
  bulkGitHubDir?: {
    label: string;
    title: string;
    hint: string;
    placeholder: string;
  };
}

export interface UrlLoadUiOptions {
  dialog: HTMLDialogElement;
  title: HTMLElement;
  hint: HTMLElement;
  input: HTMLInputElement;
  error: HTMLElement;
  history: HTMLElement;
  historyHeading: HTMLElement;
  cancel: HTMLButtonElement;
  storage: Storage;
  kinds: Record<UrlHistoryKind, SplitLoadKindConfig>;
}

export function installUrlLoadUi(options: UrlLoadUiOptions): void {
  const { dialog, title, hint, input, error, history, historyHeading, cancel, storage, kinds } = options;
  let activeKind: UrlHistoryKind = "schema";
  let activePreset: "url" | "github" | "githubDir" | "refresh" = "url";

  const closeMenus = () => closeAllAnchoredMenus();

  const populateMenu = (kind: UrlHistoryKind) => {
    const config = kinds[kind];
    config.menu.replaceChildren();
    const messages = chrome(detectLocale());
    appendMenuItem(config.menu, messages.fromFile, () => {
      closeMenus();
      void config.fromFile();
    });
    if (config.bulkLocal) {
      appendMenuItem(config.menu, config.bulkLocal.label, () => {
        closeMenus();
        void config.bulkLocal!.fromDirectory();
      });
    }
    if (config.github) {
      appendMenuItem(config.menu, config.github.label, () => {
        closeMenus();
        openDialog(kind, "github");
      });
    }
    if (config.bulkGitHubDir) {
      appendMenuItem(config.menu, config.bulkGitHubDir.label, () => {
        closeMenus();
        openDialog(kind, "githubDir");
      });
    }
    appendMenuItem(config.menu, messages.fromUrl, () => {
      closeMenus();
      openDialog(kind, "url");
    });
    if (config.refresh) {
      appendMenuItem(config.menu, messages.refreshFromFile, () => {
        closeMenus();
        void config.refresh!.fromFile();
      });
      appendMenuItem(config.menu, messages.refreshFromUrl, () => {
        closeMenus();
        openDialog(kind, "refresh");
      });
    }
    const urls = listUrlHistory(kind, storage);
    if (!urls.length) return;
    const heading = document.createElement("div");
    heading.className = "split-btn-menu-heading";
    heading.textContent = config.historyHeading;
    config.menu.append(heading);
    for (const url of urls) {
      appendMenuItem(config.menu, url, () => {
        closeMenus();
        void loadUrl(kind, url).catch(() => {});
      }, "split-btn-menu-url");
    }
  };

  const showError = (message: string) => {
    error.hidden = false;
    error.textContent = message;
  };

  const clearError = () => {
    error.hidden = true;
    error.textContent = "";
  };

  const renderDialogHistory = (kind: UrlHistoryKind) => {
    history.replaceChildren();
    const urls = listUrlHistory(kind, storage);
    if (!urls.length) {
      const empty = document.createElement("p");
      empty.className = "load-project-empty";
      empty.textContent = chrome(detectLocale()).noRecentUrls;
      history.append(empty);
      return;
    }
    for (const url of urls) {
      const row = document.createElement("div");
      row.className = "url-history-row";
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "url-history-pick";
      pick.title = url;
      pick.textContent = url;
      pick.addEventListener("click", () => {
        input.value = url;
        void submitDialog();
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "url-history-forget";
      remove.setAttribute(
        "aria-label",
        formatMessage(chrome(detectLocale()).removeFromHistory, { url }),
      );
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        forgetUrl(kind, url, storage);
        renderDialogHistory(kind);
      });
      row.append(pick, remove);
      history.append(row);
    }
  };

  const openDialog = (kind: UrlHistoryKind, preset: "url" | "github" | "githubDir" | "refresh" = "url") => {
    activeKind = kind;
    activePreset = preset;
    const config = kinds[kind];
    const github = preset === "github"
      ? config.github
      : preset === "githubDir"
      ? config.bulkGitHubDir
      : undefined;
    const messages = chrome(detectLocale());
    const kindLabel = kind === "schema"
      ? messages.kindSchema
      : kind === "example"
      ? messages.kindExample
      : messages.kindTarget;
    title.textContent = preset === "refresh"
      ? formatMessage(messages.refreshKindFromUrl, { kind: kindLabel })
      : github?.title ?? config.title;
    hint.textContent = preset === "refresh"
      ? messages.refreshUrlHint
      : github?.hint ?? config.hint;
    historyHeading.textContent = config.historyHeading;
    input.placeholder = github?.placeholder ?? config.placeholder;
    input.value = listUrlHistory(kind, storage)[0] ?? github?.placeholder ?? "";
    clearError();
    renderDialogHistory(kind);
    dialog.showModal();
    input.focus();
    input.select();
  };

  const loadUrl = async (kind: UrlHistoryKind, url: string) => {
    const config = kinds[kind];
    const loader = resolveUrlLoader(config, url, activePreset);
    await loader(url);
    rememberUrl(kind, url.trim(), storage);
  };

  const submitDialog = async () => {
    const url = input.value.trim();
    if (!url) {
      showError(chrome(detectLocale()).enterUrl);
      return;
    }
    clearError();
    try {
      await loadUrl(activeKind, url);
      dialog.close();
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  for (const [kind, config] of Object.entries(kinds) as [UrlHistoryKind, SplitLoadKindConfig][]) {
    installAnchoredMenu({
      menu: config.menu,
      trigger: config.chevron,
      roots: [config.main],
      referenceEls: [config.main, config.chevron],
      minWidth: config.main.parentElement ?? config.chevron,
      onBeforeOpen: () => populateMenu(kind),
    });
    config.main.addEventListener("click", () => void config.fromFile());
  }

  cancel.addEventListener("click", () => dialog.close());
  dialog.querySelector("form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitDialog();
  });
}

function resolveUrlLoader(
  config: SplitLoadKindConfig,
  url: string,
  preset: "url" | "github" | "githubDir" | "refresh",
): (url: string) => Promise<void> {
  if (preset === "refresh" && config.refresh) {
    return config.refresh.fromUrl;
  }
  if (preset === "githubDir" && config.fromGitHubDirectory) {
    return config.fromGitHubDirectory;
  }
  if (
    config.fromGitHubDirectory &&
    isGitHubExamplesDirectoryUrl(url) &&
    /github\.com\/[^/]+\/[^/]+\/tree\//i.test(url.trim())
  ) {
    return config.fromGitHubDirectory;
  }
  return config.fromUrl;
}

function appendMenuItem(
  menu: HTMLElement,
  label: string,
  onClick: () => void,
  extraClass?: string,
): void {
  const item = document.createElement("button");
  item.type = "button";
  item.setAttribute("role", "menuitem");
  item.className = extraClass ? `split-btn-menu-item ${extraClass}` : "split-btn-menu-item";
  item.textContent = label;
  item.title = label;
  item.addEventListener("click", onClick);
  menu.append(item);
}
