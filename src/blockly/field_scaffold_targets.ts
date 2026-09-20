/**
 * Chip row for scaffold targets on a default context map entry.
 * Click a chip to toggle Class.attribute ↔ *.attribute; × removes it.
 */
import { Blockly } from "./blockly_core.ts";
import {
  parseDefaultsPathKey,
  parseTargetsField,
  toggleScaffoldTargetWildcard,
} from "../core/defaults/mod.ts";

export const FIELD_SCAFFOLD_TARGETS_TYPE = "field_scaffold_targets";

const SVG_NS = "http://www.w3.org/2000/svg";
const CHIP_H = 22;
const MIN_W = 72;

// deno-lint-ignore no-explicit-any
const FieldBase = Blockly.Field as any;

export class FieldScaffoldTargets extends FieldBase {
  SERIALIZABLE = true;
  EDITABLE = false;
  CURSOR = "default";

  private foreignObject_: SVGForeignObjectElement | null = null;
  private host_: HTMLDivElement | null = null;

  constructor(value: string | string[] = "[]") {
    super(typeof value === "string" ? value : JSON.stringify(value));
    this.SERIALIZABLE = true;
    this.EDITABLE = false;
    if (this.size_) {
      this.size_.width = MIN_W;
      this.size_.height = CHIP_H;
    }
  }

  static fromJson(options: { targets?: string[]; value?: string } | string): FieldScaffoldTargets {
    if (typeof options === "string") return new FieldScaffoldTargets(options);
    if (options?.targets) return new FieldScaffoldTargets(options.targets);
    return new FieldScaffoldTargets(options?.value ?? "[]");
  }

  getTargets(): string[] {
    return parseTargetsField(this.getValue());
  }

  setTargets(targets: string[]): void {
    const unique = [...new Set(targets.map((item) => item.trim()).filter(Boolean))];
    this.setValue(JSON.stringify(unique));
  }

  addTarget(path: string): void {
    const trimmed = path.trim();
    if (!trimmed) return;
    const next = this.getTargets();
    if (!next.includes(trimmed)) next.push(trimmed);
    this.setTargets(next);
  }

  removeTarget(path: string): void {
    this.setTargets(this.getTargets().filter((item) => item !== path));
  }

  initView(): void {
    const group = this.fieldGroup_ as SVGGElement | null;
    if (!group || typeof document === "undefined") {
      this.updateSize_();
      return;
    }
    this.foreignObject_ = document.createElementNS(SVG_NS, "foreignObject");
    this.foreignObject_.setAttribute("x", "0");
    this.foreignObject_.setAttribute("y", "0");
    this.foreignObject_.style.overflow = "visible";
    this.foreignObject_.style.pointerEvents = "all";
    this.host_ = document.createElement("div");
    this.host_.className = "scaffold-target-chips";
    this.host_.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    this.host_.title = "Scaffold targets — drop a Target schema leaf, or click a chip to toggle wildcard";
    this.foreignObject_.appendChild(this.host_);
    group.appendChild(this.foreignObject_);
    this.paint_();
    this.updateSize_();
  }

  render_(): void {
    this.paint_();
    this.updateSize_();
  }

  protected doValueUpdate_(newValue: string): void {
    super.doValueUpdate_?.(newValue);
    this.paint_();
  }

  private paint_(): void {
    const host = this.host_;
    if (!host) return;
    host.replaceChildren();
    const targets = this.getTargets();
    if (!targets.length) {
      const empty = document.createElement("span");
      empty.className = "scaffold-target-chips__empty";
      empty.textContent = "drop path";
      host.appendChild(empty);
      return;
    }
    for (const path of targets) {
      const chip = document.createElement("span");
      chip.className = "scaffold-target-chip";
      chip.dataset.path = path;
      const label = document.createElement("button");
      label.type = "button";
      label.className = "scaffold-target-chip__label";
      label.textContent = path;
      label.title = "Click to toggle wildcard (*.attribute)";
      label.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.togglePath_(path);
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "scaffold-target-chip__remove";
      remove.setAttribute("aria-label", `Remove ${path}`);
      remove.textContent = "×";
      remove.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.removeTarget(path);
      });
      chip.append(label, remove);
      host.appendChild(chip);
    }
  }

  private togglePath_(path: string): void {
    const parsed = parseDefaultsPathKey(path);
    if (!parsed) return;
    const toggled = toggleScaffoldTargetWildcard(path);
    if (toggled === path && parsed.parts[0] === "*") return;
    this.setTargets(this.getTargets().map((item) => item === path ? toggled : item));
  }

  updateSize_(): boolean {
    if (!this.size_) return false;
    const host = this.host_;
    const width = host ? Math.max(MIN_W, Math.ceil(host.scrollWidth || host.offsetWidth || MIN_W)) : MIN_W;
    const height = host ? Math.max(CHIP_H, Math.ceil(host.scrollHeight || CHIP_H)) : CHIP_H;
    this.size_.width = width;
    this.size_.height = height;
    if (this.foreignObject_) {
      this.foreignObject_.setAttribute("width", String(width));
      this.foreignObject_.setAttribute("height", String(height));
    }
    return false;
  }

  /** Client rect of the chip host, for canvas drag hit-testing. */
  getClientRect(): DOMRect | null {
    return this.host_?.getBoundingClientRect() ?? null;
  }
}

let registered = false;
export function registerFieldScaffoldTargets(): void {
  if (registered) return;
  registered = true;
  try {
    Blockly.fieldRegistry?.register(FIELD_SCAFFOLD_TARGETS_TYPE, FieldScaffoldTargets);
  } catch {
    // Already registered (HMR / repeated init).
  }
}
