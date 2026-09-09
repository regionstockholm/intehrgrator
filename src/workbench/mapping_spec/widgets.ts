import { WidgetType } from "@codemirror/view";
import {
  SOURCE_TYPE_EMOJI,
  type SourceReturnType,
} from "../../blockly/source_query.ts";
import { EDITOR_LANGUAGE_OPTIONS } from "../codemirror_setup.ts";
import { attachInfoTip, detachInfoTip } from "../../ui/info_tip.ts";
import type { SpecEditFieldName, SpecEditableField, SpecLine } from "./project.ts";
import { createSearchablePick } from "../../ui/searchable_pick.ts";

/** Matching CodeMirror line box — keep Spec rows as dense as a code listing. */
export const SPEC_LINE_HEIGHT = 18;
const CODE_ROW_HEIGHT = 15;
const CODE_MAX_ROWS = 8;

export type SpecFieldEditHandler = (
  blockId: string,
  field: SpecEditFieldName,
  value: string,
) => void;

export type SpecBlockSelectHandler = (blockId: string) => void;

/** Block-level widget that replaces one projected Spec line. */
export class MappingSpecWidget extends WidgetType {
  constructor(
    readonly line: SpecLine,
    readonly onFieldEdit?: SpecFieldEditHandler,
    readonly onSelect?: SpecBlockSelectHandler,
    readonly warning: string | null = null,
    readonly selected = false,
  ) {
    super();
  }

  override get estimatedHeight(): number {
    if (this.line.editKind === "code") {
      const text = this.line.editable?.find((f) => f.field === "TEXT")?.value ?? "";
      const rows = Math.min(CODE_MAX_ROWS, Math.max(3, text.split("\n").length));
      return 20 + rows * CODE_ROW_HEIGHT;
    }
    return SPEC_LINE_HEIGHT;
  }

  override eq(other: MappingSpecWidget): boolean {
    return (
      this.line.blockId === other.line.blockId &&
      this.line.kind === other.line.kind &&
      this.line.type === other.line.type &&
      this.line.attribute === other.line.attribute &&
      this.line.shell === other.line.shell &&
      this.line.editKind === other.line.editKind &&
      this.line.summary === other.line.summary &&
      JSON.stringify(this.line.editable) === JSON.stringify(other.line.editable) &&
      JSON.stringify(this.line.attributeEdit) === JSON.stringify(other.line.attributeEdit) &&
      JSON.stringify(this.line.aliasIds) === JSON.stringify(other.line.aliasIds) &&
      JSON.stringify(this.line.info) === JSON.stringify(other.line.info) &&
      this.warning === other.warning &&
      this.selected === other.selected
    );
  }

  override toDOM(): HTMLElement {
    const row = document.createElement("span");
    row.className = `spec-widget spec-widget--${this.line.kind}`;
    if (this.line.editKind === "code") row.classList.add("spec-widget--multiline");
    if (this.selected) row.classList.add("spec-widget--selected");
    row.style.paddingLeft = `${4 + this.line.indent * 12}px`;
    if (this.line.blockId) row.dataset.blockId = this.line.blockId;
    if (this.warning) {
      row.title = this.warning;
      row.dataset.warning = "1";
    }

    if (this.warning) {
      const warn = document.createElement("span");
      warn.className = "spec-widget-warning";
      warn.textContent = "⚠";
      warn.setAttribute("aria-label", this.warning);
      warn.title = this.warning;
      row.appendChild(warn);
    }

    if (this.line.attributeEdit && this.line.blockId) {
      const attr = document.createElement("span");
      attr.className = "spec-widget-attr spec-widget-attr--edit";
      if (this.line.attribute?.startsWith("@")) {
        const at = document.createElement("span");
        at.className = "spec-widget-punct";
        at.textContent = "@";
        attr.appendChild(at);
      }
      attr.appendChild(
        textInput(
          this.line,
          this.line.attributeEdit,
          this.onFieldEdit,
          this.line.attribute?.startsWith("@") ? "Attribute name" : "Map key",
          "spec-widget-input spec-widget-input--attr",
        ),
      );
      row.appendChild(attr);
    } else if (this.line.attribute) {
      const attr = document.createElement("span");
      attr.className = "spec-widget-attr";
      attr.textContent = this.line.attribute;
      attr.title = this.line.attribute;
      row.appendChild(attr);
    }

    const badge = document.createElement("span");
    badge.className = "spec-widget-badge";
    badge.textContent = badgeLabel(this.line);
    if (this.line.shell) badge.title = this.line.shell;
    row.appendChild(badge);

    const editors = document.createElement("span");
    editors.className = this.line.editKind === "code"
      ? "spec-widget-editors spec-widget-editors--stack"
      : "spec-widget-editors";
    renderEditors(editors, this.line, this.onFieldEdit);
    row.appendChild(editors);

    const tip = document.createElement("span");
    tip.className = "info-tip info-tip--end";
    const infoBtn = document.createElement("button");
    infoBtn.type = "button";
    infoBtn.className = "info-tip-btn spec-widget-info";
    infoBtn.textContent = "i";
    infoBtn.setAttribute("aria-expanded", "false");
    infoBtn.setAttribute("aria-label", "Block details");
    const balloon = document.createElement("pre");
    balloon.className = "info-tip-balloon info-tip-balloon--code";
    balloon.hidden = true;
    balloon.setAttribute("role", "tooltip");
    balloon.textContent = JSON.stringify(this.line.info, null, 2);
    tip.append(infoBtn, balloon);
    attachInfoTip(tip);
    row.append(tip);

    if (this.line.blockId) {
      row.addEventListener("mousedown", (event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("input, select, textarea, button, .info-tip, .info-tip-balloon")
        ) {
          return;
        }
        event.preventDefault();
        this.onSelect?.(this.line.blockId!);
      });
    }
    return row;
  }

  override destroy(dom: HTMLElement): void {
    const tip = dom.querySelector<HTMLElement>(".info-tip");
    if (tip) detachInfoTip(tip);
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

function renderEditors(
  host: HTMLElement,
  line: SpecLine,
  onFieldEdit?: SpecFieldEditHandler,
): void {
  const fields = line.editable ?? [];
  if (!fields.length || line.editKind === "none" || !line.blockId) {
    const summary = document.createElement("span");
    summary.className = "spec-widget-summary";
    summary.textContent = line.summary || line.label;
    host.appendChild(summary);
    return;
  }

  if (line.editKind === "source_path") {
    const returnField = fields.find((f) => f.field === "RETURN_TYPE");
    const exprField = fields.find((f) => f.field === "EXPRESSION");
    if (returnField) {
      host.appendChild(returnTypeSelect(line, returnField, onFieldEdit));
    } else {
      const typeHint = document.createElement("span");
      typeHint.className = "spec-widget-type";
      const summaryType = sourceReturnTypeFromSummary(line.summary);
      typeHint.textContent = SOURCE_TYPE_EMOJI[summaryType];
      typeHint.title = summaryType;
      typeHint.setAttribute("aria-label", summaryType);
      host.appendChild(typeHint);
    }
    if (exprField) {
      host.appendChild(textInput(line, exprField, onFieldEdit, "Source path expression", "spec-widget-input"));
    }
    return;
  }

  if (line.editKind === "map_get") {
    const name = fields.find((f) => f.field === "NAME");
    const key = fields.find((f) => f.field === "TEXT" || f.field === "EXPRESSION");
    if (name) {
      host.appendChild(textInput(line, name, onFieldEdit, "Map name", "spec-widget-input spec-widget-input--name"));
    }
    const lbrack = document.createElement("span");
    lbrack.className = "spec-widget-punct";
    lbrack.textContent = "[";
    host.appendChild(lbrack);
    if (key) {
      host.appendChild(textInput(line, key, onFieldEdit, "Map key", "spec-widget-input"));
    }
    const rbrack = document.createElement("span");
    rbrack.className = "spec-widget-punct";
    rbrack.textContent = "]";
    host.appendChild(rbrack);
    return;
  }

  if (line.editKind === "compare") {
    for (const field of fields) {
      if (field.field === "OP") {
        host.appendChild(opSelect(line, field, onFieldEdit));
      } else {
        host.appendChild(textInput(line, field, onFieldEdit, field.field, "spec-widget-input spec-widget-input--short"));
      }
    }
    return;
  }

  if (line.editKind === "sheet_lookup") {
    const name = fields.find((f) => f.field === "NAME");
    const rest = fields.filter((f) => f.field !== "NAME");
    if (name) {
      host.appendChild(textInput(line, name, onFieldEdit, "Sheet name", "spec-widget-input spec-widget-input--name"));
    }
    const punct = (text: string) => {
      const el = document.createElement("span");
      el.className = "spec-widget-punct";
      el.textContent = text;
      return el;
    };
    if (rest[0]) {
      host.appendChild(punct("where"));
      host.appendChild(textInput(line, rest[0], onFieldEdit, "Match column", "spec-widget-input spec-widget-input--short"));
    }
    if (rest[1]) {
      host.appendChild(punct("="));
      host.appendChild(textInput(line, rest[1], onFieldEdit, "Match value", "spec-widget-input"));
    }
    if (rest[2]) {
      host.appendChild(punct("→"));
      host.appendChild(textInput(line, rest[2], onFieldEdit, "Return column", "spec-widget-input spec-widget-input--short"));
    }
    return;
  }

  if (line.editKind === "code") {
    const lang = fields.find((f) => f.field === "LANG");
    const text = fields.find((f) => f.field === "TEXT");
    if (lang) host.appendChild(langSelect(line, lang, onFieldEdit));
    if (text) host.appendChild(codeArea(line, text, onFieldEdit));
    return;
  }

  if (line.editKind === "loop") {
    const name = fields.find((f) => f.field === "VAR");
    const path = fields.find((f) => f.field === "PATH");
    const prefix = document.createElement("span");
    prefix.className = "spec-widget-punct";
    prefix.textContent = "for each";
    host.appendChild(prefix);
    if (name) host.appendChild(textInput(line, name, onFieldEdit, "Loop variable", "spec-widget-input spec-widget-input--name"));
    const inn = document.createElement("span");
    inn.className = "spec-widget-punct";
    inn.textContent = "in";
    host.appendChild(inn);
    if (path) host.appendChild(textInput(line, path, onFieldEdit, "Source path", "spec-widget-input"));
    return;
  }

  if (line.editKind === "boolean") {
    const bool = fields.find((f) => f.field === "BOOL");
    if (bool) host.appendChild(boolSelect(line, bool, onFieldEdit));
    return;
  }

  if (line.editKind === "term_pick") {
    const set = fields.find((f) => f.field === "SET");
    const code = fields.find((f) => f.field === "CODE");
    if (set) {
      host.appendChild(
        pickField(line, set, onFieldEdit, "Term set", "spec-widget-select spec-widget-select--set"),
      );
    }
    if (code) {
      host.appendChild(
        pickField(line, code, onFieldEdit, "Term code", "spec-widget-input spec-widget-input--code"),
      );
    }
    return;
  }

  for (const field of fields) {
    if (field.field === "LANG") {
      host.appendChild(langSelect(line, field, onFieldEdit));
      continue;
    }
    if (field.options?.length) {
      host.appendChild(pickField(line, field, onFieldEdit, field.field, "spec-widget-select"));
      continue;
    }
    host.appendChild(textInput(line, field, onFieldEdit, field.field, "spec-widget-input"));
  }
}

function editTarget(line: SpecLine, field: SpecEditableField): string | undefined {
  return field.targetBlockId ?? line.blockId;
}

function commit(
  line: SpecLine,
  field: SpecEditableField,
  value: string,
  onFieldEdit?: SpecFieldEditHandler,
): void {
  const id = editTarget(line, field);
  if (id) onFieldEdit?.(id, field.field, value);
}

function textInput(
  line: SpecLine,
  field: SpecEditableField,
  onFieldEdit: SpecFieldEditHandler | undefined,
  aria: string,
  className: string,
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = field.field === "NUM" ? "number" : "text";
  input.className = className;
  input.value = field.value;
  input.setAttribute("aria-label", aria);
  input.addEventListener("change", () => commit(line, field, input.value, onFieldEdit));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
  });
  return input;
}

function codeArea(
  line: SpecLine,
  field: SpecEditableField,
  onFieldEdit?: SpecFieldEditHandler,
): HTMLTextAreaElement {
  const area = document.createElement("textarea");
  area.className = "spec-widget-code";
  area.value = field.value;
  area.setAttribute("aria-label", "Generated text");
  const rows = Math.min(CODE_MAX_ROWS, Math.max(3, field.value.split("\n").length));
  area.rows = rows;
  area.spellcheck = false;
  area.addEventListener("change", () => commit(line, field, area.value, onFieldEdit));
  return area;
}

function returnTypeSelect(
  line: SpecLine,
  field: SpecEditableField,
  onFieldEdit?: SpecFieldEditHandler,
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "spec-widget-select spec-widget-type-select";
  select.setAttribute("aria-label", "Return type");
  for (const opt of ["string", "number", "boolean"] as SourceReturnType[]) {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = `${SOURCE_TYPE_EMOJI[opt]} ${opt}`;
    if (opt === (field.value ?? "string")) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener("change", () => commit(line, field, select.value, onFieldEdit));
  return select;
}

function langSelect(
  line: SpecLine,
  field: SpecEditableField,
  onFieldEdit?: SpecFieldEditHandler,
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "spec-widget-select";
  select.setAttribute("aria-label", "Code language");
  for (const [label, value] of EDITOR_LANGUAGE_OPTIONS) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if (value === field.value) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener("change", () => commit(line, field, select.value, onFieldEdit));
  return select;
}

function opSelect(
  line: SpecLine,
  field: SpecEditableField,
  onFieldEdit?: SpecFieldEditHandler,
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "spec-widget-select spec-widget-select--op";
  select.setAttribute("aria-label", "Compare operator");
  for (const [value, label] of [
    ["EQ", "="],
    ["NEQ", "≠"],
    ["LT", "<"],
    ["LTE", "≤"],
    ["GT", ">"],
    ["GTE", "≥"],
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if (value === field.value) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener("change", () => commit(line, field, select.value, onFieldEdit));
  return select;
}

function pickField(
  line: SpecLine,
  field: SpecEditableField,
  onFieldEdit: SpecFieldEditHandler | undefined,
  aria: string,
  className: string,
): HTMLElement {
  return createSearchablePick({
    options: field.options ?? [],
    value: field.value,
    ariaLabel: aria,
    className,
    onCommit: (value) => commit(line, field, value, onFieldEdit),
  });
}

function boolSelect(
  line: SpecLine,
  field: SpecEditableField,
  onFieldEdit?: SpecFieldEditHandler,
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "spec-widget-select";
  select.setAttribute("aria-label", "Boolean");
  for (const [value, label] of [["TRUE", "true"], ["FALSE", "false"]] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if (value === field.value) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener("change", () => commit(line, field, select.value, onFieldEdit));
  return select;
}

function sourceReturnTypeFromSummary(summary: string): SourceReturnType {
  const raw = summary.split(" · ")[0] ?? "string";
  if (raw === "number" || raw === "boolean" || raw === "node") return raw;
  return "string";
}

function badgeLabel(line: SpecLine): string {
  if (line.shell) {
    return line.shell.replace(/^dv_/i, "DV_").toUpperCase();
  }
  switch (line.kind) {
    case "header":
      return "spec";
    case "source_query":
      return "source";
    case "dv":
      return line.type.replace(/^dv_/i, "DV_").toUpperCase();
    case "value":
      return "slot";
    case "map_lookup":
      return "map";
    case "term_pick":
      return "TERM_PICK";
    case "sheet_lookup":
      return "sheet";
    case "text_gen":
      return line.editable?.find((f) => f.field === "LANG")?.value || "code";
    case "literal":
      return line.editKind === "number" ? "num" : line.editKind === "boolean" ? "bool" : "text";
    case "logic":
      return line.type === "logic_operation" ? line.label : "if";
    case "container":
      return line.type.replace(/^schema_/, "");
    default:
      return line.type;
  }
}
