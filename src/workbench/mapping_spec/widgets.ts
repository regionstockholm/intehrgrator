import { WidgetType } from "@codemirror/view";
import type { SpecLine } from "./project.ts";

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

  eq(other: MappingSpecWidget): boolean {
    return (
      this.line.blockId === other.line.blockId &&
      this.line.kind === other.kind &&
      this.line.type === other.line.type &&
      this.line.summary === other.line.summary &&
      JSON.stringify(this.line.editable) === JSON.stringify(other.line.editable) &&
      JSON.stringify(this.line.info) === JSON.stringify(other.line.info)
    );
  }

  toDOM(): HTMLElement {
    const row = document.createElement("div");
    row.className = `spec-widget spec-widget--${this.line.kind}`;
    row.style.paddingLeft = `${8 + this.line.indent * 14}px`;
    if (this.line.blockId) row.dataset.blockId = this.line.blockId;

    const badge = document.createElement("span");
    badge.className = "spec-widget-badge";
    badge.textContent = badgeLabel(this.line);
    row.appendChild(badge);

    if (this.line.kind === "source_query" && this.line.blockId && this.line.editable) {
      const returnField = this.line.editable.find((f) => f.field === "RETURN_TYPE");
      const exprField = this.line.editable.find((f) => f.field === "EXPRESSION");

      const select = document.createElement("select");
      select.className = "spec-widget-select";
      select.setAttribute("aria-label", "Return type");
      for (const opt of ["string", "number", "boolean"]) {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        if (opt === (returnField?.value ?? "string")) option.selected = true;
        select.appendChild(option);
      }
      select.addEventListener("change", () => {
        if (this.line.blockId) {
          this.onFieldEdit?.(this.line.blockId, "RETURN_TYPE", select.value);
        }
      });
      row.appendChild(select);

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

    const infoBtn = document.createElement("button");
    infoBtn.type = "button";
    infoBtn.className = "spec-widget-info";
    infoBtn.textContent = "i";
    infoBtn.setAttribute("aria-label", "Block details");
    const balloon = document.createElement("pre");
    balloon.className = "spec-widget-balloon";
    balloon.hidden = true;
    balloon.textContent = JSON.stringify(this.line.info, null, 2);
    const show = () => {
      balloon.hidden = false;
    };
    const hide = () => {
      balloon.hidden = true;
    };
    infoBtn.addEventListener("mouseenter", show);
    infoBtn.addEventListener("mouseleave", hide);
    infoBtn.addEventListener("focus", show);
    infoBtn.addEventListener("blur", hide);
    infoBtn.addEventListener("click", (event) => {
      event.preventDefault();
      balloon.hidden = !balloon.hidden;
    });
    row.append(infoBtn, balloon);
    return row;
  }

  ignoreEvent(event: Event): boolean {
    const target = event.target;
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest("input, select, button, .spec-widget-balloon"),
    );
  }
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
