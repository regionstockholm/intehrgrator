/** Split load buttons (from file / from URL) plus a shared URL dialog with history. */

import {
  forgetUrl,
  listUrlHistory,
  rememberUrl,
  type UrlHistoryKind,
} from "../host/url_history.ts";

export type { UrlHistoryKind };

export interface SplitLoadKindConfig {
  main: HTMLButtonElement;
  chevron: HTMLButtonElement;
  menu: HTMLElement;
  fromFile: () => void | Promise<void>;
  fromUrl: (url: string) => Promise<void>;
  title: string;
  hint: string;
  placeholder: string;
  historyHeading: string;
  /** Extra first-class menu action, e.g. GitHub .t.json closure load. */
  github?: {
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

  for (const config of Object.values(kinds)) {
    document.body.append(config.menu);
  }

  const closeMenus = () => {
    for (const config of Object.values(kinds)) {
      config.menu.hidden = true;
      config.chevron.setAttribute("aria-expanded", "false");
    }
  };

  const positionMenu = (kind: UrlHistoryKind) => {
    const { chevron, main, menu } = kinds[kind];
    const rect = chevron.getBoundingClientRect();
    const leftEdge = main.getBoundingClientRect().left;
    menu.style.position = "fixed";
    menu.style.left = "auto";
    menu.style.right = `${Math.max(8, globalThis.innerWidth - rect.right)}px`;
    menu.style.minWidth = `${Math.max(220, rect.right - leftEdge)}px`;
    menu.hidden = false;
    const menuHeight = menu.getBoundingClientRect().height;
    const openUp = rect.bottom + 2 + menuHeight > globalThis.innerHeight && rect.top > menuHeight + 8;
    menu.style.top = openUp ? `${rect.top - menuHeight - 2}px` : `${rect.bottom + 2}px`;
  };

  const populateMenu = (kind: UrlHistoryKind) => {
    const config = kinds[kind];
    config.menu.replaceChildren();
    appendMenuItem(config.menu, "From file…", () => {
      closeMenus();
      void config.fromFile();
    });
    if (config.github) {
      appendMenuItem(config.menu, config.github.label, () => {
        closeMenus();
        openDialog(kind, "github");
      });
    }
    appendMenuItem(config.menu, "From URL…", () => {
      closeMenus();
      openDialog(kind, "url");
    });
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

  const openMenu = (kind: UrlHistoryKind) => {
    const alreadyOpen = !kinds[kind].menu.hidden;
    closeMenus();
    if (alreadyOpen) return;
    populateMenu(kind);
    kinds[kind].chevron.setAttribute("aria-expanded", "true");
    positionMenu(kind);
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
      empty.textContent = "No recent URLs yet.";
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
      remove.setAttribute("aria-label", `Remove ${url} from history`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        forgetUrl(kind, url, storage);
        renderDialogHistory(kind);
      });
      row.append(pick, remove);
      history.append(row);
    }
  };

  const openDialog = (kind: UrlHistoryKind, preset: "url" | "github" = "url") => {
    activeKind = kind;
    const config = kinds[kind];
    const github = preset === "github" ? config.github : undefined;
    title.textContent = github?.title ?? config.title;
    hint.textContent = github?.hint ?? config.hint;
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
    await kinds[kind].fromUrl(url);
    rememberUrl(kind, url.trim(), storage);
  };

  const submitDialog = async () => {
    const url = input.value.trim();
    if (!url) {
      showError("Enter a URL.");
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
    config.main.addEventListener("click", () => void config.fromFile());
    config.chevron.addEventListener("click", (event) => {
      event.stopPropagation();
      openMenu(kind);
    });
    config.menu.addEventListener("click", (event) => event.stopPropagation());
  }

  document.addEventListener("click", closeMenus);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenus();
  });
  globalThis.addEventListener("resize", closeMenus);

  cancel.addEventListener("click", () => dialog.close());
  dialog.querySelector("form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitDialog();
  });
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
