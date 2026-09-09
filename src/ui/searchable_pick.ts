/**
 * Shared type-to-filter pick list used by Blockly long dropdowns and Mapping Spec
 * widgets. Only values from the provided option list are committable.
 */

import { Blockly } from "../blockly/blockly_core.ts";

export type PickOption = [label: string, value: string];

/** Dropdowns / spec picks with at least this many rows get a search box. */
export const SEARCHABLE_DROPDOWN_MIN = 8;

export const DROPDOWN_SEARCH_CLASS = "blockly-dropdown-search";

export function shouldSearchPickList(optionCount: number): boolean {
  return optionCount >= SEARCHABLE_DROPDOWN_MIN;
}

export function filterPickOptions(options: PickOption[], query: string): PickOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(([label, value]) =>
    label.toLowerCase().includes(q) || value.toLowerCase().includes(q)
  );
}

/** Return `value` only when it is one of the allowed option values. */
export function allowedPickValue(
  options: PickOption[],
  value: string,
): string | null {
  return options.some(([, item]) => item === value) ? value : null;
}

export function labelForPickValue(options: PickOption[], value: string): string {
  return options.find(([, item]) => item === value)?.[0] ?? value;
}

export interface SearchablePickConfig {
  options: PickOption[];
  value: string;
  ariaLabel: string;
  className?: string;
  onCommit: (value: string) => void;
}

/** Spec / HTML combobox: short lists stay a `<select>`; long lists type-to-filter. */
export function createSearchablePick(config: SearchablePickConfig): HTMLElement {
  const options = config.options.length ? config.options : [["(none)", ""] as PickOption];
  if (!shouldSearchPickList(options.length)) {
    return createSelectPick(config, options);
  }
  return createComboboxPick(config, options);
}

function createSelectPick(
  config: SearchablePickConfig,
  options: PickOption[],
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = config.className ?? "spec-widget-select";
  select.setAttribute("aria-label", config.ariaLabel);
  for (const [label, value] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if (value === config.value) option.selected = true;
    select.appendChild(option);
  }
  if (config.value && !options.some(([, value]) => value === config.value)) {
    const extra = document.createElement("option");
    extra.value = config.value;
    extra.textContent = config.value;
    extra.selected = true;
    select.appendChild(extra);
  }
  select.addEventListener("change", () => {
    const allowed = allowedPickValue(options, select.value);
    if (allowed !== null) config.onCommit(allowed);
  });
  return select;
}

function createComboboxPick(
  config: SearchablePickConfig,
  options: PickOption[],
): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "searchable-pick";
  const input = document.createElement("input");
  input.type = "search";
  input.className = config.className ?? "spec-widget-input searchable-pick-input";
  input.setAttribute("aria-label", config.ariaLabel);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");
  input.autocomplete = "off";
  input.spellcheck = false;
  input.value = labelForPickValue(options, config.value);

  const list = document.createElement("div");
  list.className = "searchable-pick-list";
  list.hidden = true;
  list.setAttribute("role", "listbox");

  const render = (query: string) => {
    const filtered = filterPickOptions(options, query);
    list.replaceChildren();
    for (const [label, value] of filtered) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "searchable-pick-option";
      row.setAttribute("role", "option");
      row.dataset.value = value;
      row.textContent = label;
      if (value === config.value) row.setAttribute("aria-selected", "true");
      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
        commit(value);
      });
      list.appendChild(row);
    }
    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "searchable-pick-empty";
      empty.textContent = "No matches";
      list.appendChild(empty);
    }
  };

  const open = () => {
    render(input.value === labelForPickValue(options, config.value) ? "" : input.value);
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };

  const close = () => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
  };

  const commit = (value: string) => {
    const allowed = allowedPickValue(options, value);
    if (allowed === null) {
      input.value = labelForPickValue(options, config.value);
      close();
      return;
    }
    config.value = allowed;
    input.value = labelForPickValue(options, allowed);
    close();
    config.onCommit(allowed);
  };

  input.addEventListener("focus", open);
  input.addEventListener("input", () => {
    open();
    render(input.value);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const first = filterPickOptions(options, input.value)[0];
      if (first) commit(first[1]);
    }
    if (event.key === "Escape") {
      input.value = labelForPickValue(options, config.value);
      close();
    }
  });
  input.addEventListener("blur", () => {
    const typed = input.value.trim();
    const exact = options.find(([label, value]) =>
      label === typed || value === typed
    );
    if (exact) {
      commit(exact[1]);
      return;
    }
    input.value = labelForPickValue(options, config.value);
    close();
  });

  wrap.append(input, list);
  return wrap;
}

/**
 * Inject a search box into an open Blockly dropdown and hide non-matching rows.
 * No-op when the option list is short or there is no dropdown DOM.
 */
export function attachDropdownSearch(field: {
  getOptions?: (all?: boolean) => PickOption[];
}): void {
  if (typeof document === "undefined") return;
  const dd = (Blockly as unknown as {
    DropDownDiv?: { getContentDiv?: () => Element };
  }).DropDownDiv;
  const content = dd?.getContentDiv?.() ??
    document.querySelector(".blocklyDropDownContent");
  if (!(content instanceof HTMLElement)) return;
  if (content.querySelector(`.${DROPDOWN_SEARCH_CLASS}`)) return;
  const options = field.getOptions?.(false) ?? [];
  if (!shouldSearchPickList(options.length)) return;

  const input = document.createElement("input");
  input.type = "search";
  input.className = DROPDOWN_SEARCH_CLASS;
  input.placeholder = "Search…";
  input.setAttribute("aria-label", "Filter list");
  input.autocomplete = "off";
  content.insertBefore(input, content.firstChild);

  const apply = () => {
    const filtered = filterPickOptions(options, input.value);
    const keepLabels = new Set(filtered.map(([label]) => label));
    for (const item of content.querySelectorAll<HTMLElement>(".blocklyMenuItem")) {
      const text = (item.textContent ?? "").trim();
      item.style.display = keepLabels.has(text) ? "" : "none";
    }
  };

  input.addEventListener("input", apply);
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      input.value = "";
      apply();
    }
  });
  input.addEventListener("mousedown", (event) => event.stopPropagation());
  input.addEventListener("pointerdown", (event) => event.stopPropagation());
  queueMicrotask(() => input.focus());
}
