import { WidgetType } from "@codemirror/view";
import {
  SOURCE_TYPE_EMOJI,
  type SourceReturnType,
} from "../../blockly/source_query.ts";
import { attachInfoTip, detachInfoTip } from "../../ui/info_tip.ts";
import type { SpecLine } from "./project.ts";

/** Matching CodeMirror line box — keep Spec rows as dense as a code listing. */
export const SPEC_LINE_HEIGHT = 18;

export type SpecFieldEditHandler = (
  blockId: string,
  field: "EXPRESSION" | "RETURN_TYPE",
  value: string,
) => void;

/** Block-level widget that replaces one projected Spec line. */
export class MappingSpecWidget extends WidgetType {
  constructor(
    readonly line: SpecLine,
    readonly onFieldEdit?: SpecFieldEditHandler,
  ) {
    super();
  }

  override get estimatedHeight(): number {
    return SPEC_LINE_HEIGHT;
  }

  override eq(other: MappingSpecWidget): boolean {
    return (
      this.line.blockId === other.line.blockId &&
      this.line.kind === other.line.kind &&
      this.line.type === other.line.type &&
      this.line.summary === other.line.summary &&
      JSON.stringify(this.line.editable) === JSON.stringify(other.line.editable) &&
      JSON.stringify(this.line.info) === JSON.stringify(other.line.info)
    );
  }

  override toDOM(): HTMLElement {
    const row = document.createElement("span");
    row.className = `spec-widget spec-widget--${this.line.kind}`;
    row.style.paddingLeft = `${4 + this.line.indent * 12}px`;
    if (this.line.blockId) row.dataset.blockId = this.line.blockId;

    const badge = document.createElement("span");
    badge.className = "spec-widget-badge";
    badge.textContent = badgeLabel(this.line);
    row.appendChild(badge);

    if (this.line.kind === "source_query" && this.line.blockId && this.line.editable) {
      const returnField = this.line.editable.find((f) => f.field === "RETURN_TYPE");
      const exprField = this.line.editable.find((f) => f.field === "EXPRESSION");

      if (returnField) {
        const select = document.createElement("select");
        select.className = "spec-widget-select spec-widget-type-select";
        select.setAttribute("aria-label", "Return type");
        for (const opt of ["string", "number", "boolean"] as SourceReturnType[]) {
          const option = document.createElement("option");
          option.value = opt;
          option.textContent = `${SOURCE_TYPE_EMOJI[opt]} ${opt}`;
          if (opt === (returnField.value ?? "string")) option.selected = true;
          select.appendChild(option);
        }
        select.addEventListener("change", () => {
          if (this.line.blockId) {
            this.onFieldEdit?.(this.line.blockId, "RETURN_TYPE", select.value);
          }
        });
        row.appendChild(select);
      } else {
        const typeHint = document.createElement("span");
        typeHint.className = "spec-widget-type";
        const summaryType = sourceReturnTypeFromSummary(this.line.summary);
        typeHint.textContent = SOURCE_TYPE_EMOJI[summaryType];
        typeHint.title = summaryType;
        typeHint.setAttribute("aria-label", summaryType);
        row.appendChild(typeHint);
      }

      const input = document.createElement("input");
      input.type = "text";
      input.className = "spec-widget-input";
      input.value = exprField?.value ?? "";
      input.setAttribute("aria-label", "Source path expression");
      input.addEventListener("change", () => {
        if (this.line.blockId) {
          this.onFieldEdit?.(this.line.blockId, "EXPRESSION", input.value);
        }
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
      });
      row.appendChild(input);
    } else {
      const summary = document.createElement("span");
      summary.className = "spec-widget-summary";
      summary.textContent = this.line.summary || this.line.label;
      row.appendChild(summary);
    }

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
    return row;
  }

  override destroy(dom: HTMLElement): void {
    const tip = dom.querySelector<HTMLElement>(".info-tip");
    if (tip) detachInfoTip(tip);
  }

  override ignoreEvent(event: Event): boolean {
    const target = event.target;
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest("input, select, button, .info-tip, .info-tip-balloon"),
    );
  }
}

function sourceReturnTypeFromSummary(summary: string): SourceReturnType {
  const raw = summary.split(" · ")[0] ?? "string";
  if (raw === "number" || raw === "boolean") return raw;
  return "string";
}

function badgeLabel(line: SpecLine): string {
  switch (line.kind) {
    case "header":
      return "spec";
    case "source_query":
      return "source";
    case "dv":
      return line.type.replace(/^dv_/i, "DV_").toUpperCase();
    case "value":
      return "slot";
    case "container":
      return line.type;
    default:
      return line.type;
  }
}
