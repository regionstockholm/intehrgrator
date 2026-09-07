import { EditorState, Facet, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  keymap,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { foldGutter, foldKeymap, foldService } from "@codemirror/language";
import {
  blocklyJsonDocument,
  type BlocklyJsonDocument,
  type SpecLine,
} from "./project.ts";
import { MappingSpecWidget, SPEC_LINE_HEIGHT, type SpecFieldEditHandler, type SpecBlockSelectHandler } from "./widgets.ts";
import { specOverviewTickTopPx, specWarningMarkers } from "./overview.ts";

const setJsonDocEffect = StateEffect.define<BlocklyJsonDocument>();

const jsonDocField = StateField.define<BlocklyJsonDocument>({
  create() {
    return blocklyJsonDocument(null);
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setJsonDocEffect)) return effect.value;
    }
    return value;
  },
});

const editFacet = Facet.define<
  SpecFieldEditHandler | undefined,
  SpecFieldEditHandler | undefined
>({
  combine(values) {
    return values.find((value) => value !== undefined);
  },
});

const selectFacet = Facet.define<
  SpecBlockSelectHandler | undefined,
  SpecBlockSelectHandler | undefined
>({
  combine(values) {
    return values.find((value) => value !== undefined);
  },
});

export interface SpecChrome {
  warnings: Record<string, string>;
  selectedBlockId: string | null;
}

const emptyChrome: SpecChrome = { warnings: {}, selectedBlockId: null };

const setSpecChromeEffect = StateEffect.define<SpecChrome>();

const specChromeField = StateField.define<SpecChrome>({
  create() {
    return emptyChrome;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSpecChromeEffect)) return effect.value;
    }
    return value;
  },
});

function warningForLine(line: SpecLine, warnings: Record<string, string>): string | null {
  if (line.blockId && warnings[line.blockId]) return warnings[line.blockId] ?? null;
  for (const id of line.aliasIds ?? []) {
    if (warnings[id]) return warnings[id] ?? null;
  }
  return null;
}

function lineIsSelected(line: SpecLine, selectedBlockId: string | null): boolean {
  if (!selectedBlockId) return false;
  return line.blockId === selectedBlockId || (line.aliasIds ?? []).includes(selectedBlockId);
}

/**
 * Replace decorations that span line breaks must come from a StateField,
 * not a ViewPlugin (CodeMirror: "may not be specified via plugins").
 */
function buildDecorations(state: EditorState): DecorationSet {
  const doc = state.field(jsonDocField);
  const onEdit = state.facet(editFacet);
  const onSelect = state.facet(selectFacet);
  const chrome = state.field(specChromeField);
  if (!doc.widgets.length) return Decoration.none;

  const ranges = [];
  for (const widget of doc.widgets) {
    ranges.push(
      Decoration.replace({
        widget: new MappingSpecWidget(
          widget.line,
          onEdit,
          onSelect,
          warningForLine(widget.line, chrome.warnings),
          lineIsSelected(widget.line, chrome.selectedBlockId),
        ),
        block: widget.line.editKind === "code",
        inclusive: widget.line.editKind !== "code",
      }).range(widget.from, widget.to),
    );
  }
  return Decoration.set(ranges, true);
}

function indentFoldRange(
  state: EditorState,
  lineStart: number,
  _lineEnd: number,
): { from: number; to: number } | null {
  const line = state.doc.lineAt(lineStart);
  if (!line.text.trim()) return null;
  const indent = /^ */.exec(line.text)?.[0].length ?? 0;
  let end = line.to;
  let sawChild = false;
  for (let n = line.number + 1; n <= state.doc.lines; n++) {
    const next = state.doc.line(n);
    if (!next.text.trim()) {
      end = next.to;
      continue;
    }
    const nextIndent = /^ */.exec(next.text)?.[0].length ?? 0;
    if (nextIndent <= indent) break;
    sawChild = true;
    end = next.to;
  }
  return sawChild ? { from: line.to, to: end } : null;
}

const jsonDecorations = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(value, tr) {
    if (
      tr.docChanged ||
      tr.effects.some((effect) => effect.is(setJsonDocEffect) || effect.is(setSpecChromeEffect))
    ) {
      return buildDecorations(tr.state);
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const specTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "12px" },
  ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, monospace" },
  ".cm-content": {
    caretColor: "transparent",
    padding: "2px 0",
    lineHeight: `${SPEC_LINE_HEIGHT}px`,
  },
  ".cm-line": {
    padding: "0 2px",
    lineHeight: `${SPEC_LINE_HEIGHT}px`,
    minHeight: `${SPEC_LINE_HEIGHT}px`,
  },
  ".cm-line:has(.spec-widget--multiline)": {
    height: "auto",
    lineHeight: "normal",
    overflow: "visible",
  },
  ".cm-gutters": {
    lineHeight: `${SPEC_LINE_HEIGHT}px`,
    minHeight: "0",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    minHeight: `${SPEC_LINE_HEIGHT}px`,
    lineHeight: `${SPEC_LINE_HEIGHT}px`,
    fontSize: "10px",
  },
  ".cm-foldGutter .cm-gutterElement": {
    minHeight: `${SPEC_LINE_HEIGHT}px`,
    lineHeight: `${SPEC_LINE_HEIGHT}px`,
  },
  ".cm-widgetBuffer": {
    height: "0",
    lineHeight: "0",
  },
  ".spec-widget--selected": {
    background: "#fff8e1",
    outline: "2px solid #F9A825",
    outlineOffset: "-1px",
    borderRadius: "2px",
  },
  ".spec-widget-warning": {
    flex: "0 0 auto",
    color: "#E65100",
    fontSize: "12px",
    lineHeight: "14px",
    cursor: "help",
  },
  ".spec-widget": {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    maxWidth: "100%",
    height: `${SPEC_LINE_HEIGHT}px`,
    lineHeight: `${SPEC_LINE_HEIGHT}px`,
    verticalAlign: "middle",
    position: "relative",
    fontFamily: "system-ui, sans-serif",
    fontSize: "11px",
    color: "var(--text, #1a1a1a)",
    whiteSpace: "nowrap",
  },
  ".spec-widget-attr": {
    flex: "0 1 auto",
    font: "10px ui-monospace, monospace",
    color: "#5c5c5c",
    lineHeight: "14px",
    maxWidth: "9rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".spec-widget-attr--edit": {
    display: "inline-flex",
    alignItems: "center",
    gap: "1px",
    maxWidth: "10rem",
    overflow: "visible",
  },
  ".spec-widget-input--attr": {
    minWidth: "3.5rem",
    maxWidth: "8rem",
    flex: "1 1 5rem",
  },
  ".spec-widget-badge": {
    flex: "0 0 auto",
    fontSize: "9px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: "#005c53",
    background: "#e8f5f2",
    borderRadius: "2px",
    padding: "0 4px",
    lineHeight: "14px",
  },
  ".spec-widget--source_query .spec-widget-badge": {
    color: "#9a4b00",
    background: "#fff4ea",
  },
  ".spec-widget--dv .spec-widget-badge, .spec-widget--map_lookup .spec-widget-badge, .spec-widget--sheet_lookup .spec-widget-badge": {
    color: "#1e3a5f",
    background: "#e8eef7",
  },
  ".spec-widget--text_gen .spec-widget-badge": {
    color: "#6d4c00",
    background: "#fff6d6",
  },
  ".spec-widget--logic .spec-widget-badge": {
    color: "#4a148c",
    background: "#f3e5f5",
  },
  ".spec-widget-editors": {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    flex: "1 1 auto",
    minWidth: "0",
  },
  ".spec-widget-editors--stack": {
    flexDirection: "column",
    alignItems: "stretch",
  },
  ".spec-widget--multiline": {
    display: "flex",
    alignItems: "flex-start",
    height: "auto",
    minHeight: `${SPEC_LINE_HEIGHT}px`,
    whiteSpace: "normal",
    paddingTop: "2px",
    paddingBottom: "2px",
  },
  ".spec-widget-code": {
    width: "100%",
    minHeight: "3.2rem",
    maxHeight: "8.5rem",
    boxSizing: "border-box",
    font: "11px ui-monospace, monospace",
    padding: "2px 4px",
    border: "1px solid #d9d9d9",
    borderRadius: "2px",
    resize: "vertical",
    lineHeight: "15px",
  },
  ".spec-widget-punct": {
    flex: "0 0 auto",
    color: "#666",
    fontSize: "11px",
  },
  ".spec-widget-input--name": { maxWidth: "7rem", flex: "0 1 7rem" },
  ".spec-widget-input--short": { maxWidth: "6rem", flex: "0 1 6rem" },
  ".spec-widget-select--op": { minWidth: "2.5rem" },
  ".spec-widget-summary": {
    flex: "1 1 auto",
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".spec-widget-input": {
    flex: "1 1 auto",
    minWidth: "6rem",
    height: "16px",
    boxSizing: "border-box",
    font: "11px ui-monospace, monospace",
    padding: "0 4px",
    border: "1px solid #d9d9d9",
    borderRadius: "2px",
    lineHeight: "14px",
  },
  ".spec-widget-select": {
    flex: "0 0 auto",
    height: "16px",
    fontSize: "11px",
    padding: "0 2px",
    border: "1px solid #d9d9d9",
    borderRadius: "2px",
    background: "#fff",
    lineHeight: "14px",
  },
  ".spec-widget-type": {
    flex: "0 0 auto",
    fontSize: "12px",
    lineHeight: "14px",
  },
  ".cm-spec-overview": {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "12px",
    zIndex: "6",
    pointerEvents: "none",
  },
  ".cm-spec-overview-tick": {
    position: "absolute",
    left: "1px",
    right: "1px",
    height: "6px",
    padding: "0",
    border: "0",
    borderRadius: "1px",
    background: "#E65100",
    cursor: "pointer",
    pointerEvents: "auto",
  },
  ".spec-widget .info-tip": {
    flex: "0 0 auto",
  },
  ".spec-widget-info": {
    flex: "0 0 auto",
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    border: "1px solid #005c53",
    background: "#fff",
    color: "#005c53",
    font: "italic bold 9px/12px Georgia, serif",
    cursor: "pointer",
    padding: "0",
    opacity: "0",
  },
  ".spec-widget:hover .spec-widget-info, .spec-widget:focus-within .spec-widget-info": {
    opacity: "1",
  },
});

export interface MappingSpecEditorOptions {
  onFieldEdit?: SpecFieldEditHandler;
  onSelect?: SpecBlockSelectHandler;
}

function specOverview(onSelect?: SpecBlockSelectHandler) {
  return ViewPlugin.fromClass(class {
    readonly dom: HTMLElement;

    constructor(readonly view: EditorView) {
      this.dom = document.createElement("div");
      this.dom.className = "cm-spec-overview";
      this.dom.setAttribute("aria-label", "Constraint warning locations");
      view.dom.appendChild(this.dom);
      this.rebuild();
    }

    update(update: ViewUpdate): void {
      if (
        update.docChanged ||
        update.geometryChanged ||
        update.viewportChanged ||
        update.transactions.some((tr) =>
          tr.effects.some((effect) => effect.is(setJsonDocEffect) || effect.is(setSpecChromeEffect))
        )
      ) {
        this.rebuild();
      }
    }

    destroy(): void {
      this.dom.remove();
    }

    private rebuild(): void {
      const doc = this.view.state.field(jsonDocField);
      const chrome = this.view.state.field(specChromeField);
      const markers = specWarningMarkers(doc, chrome.warnings);
      const scrollHeight = this.view.scrollDOM.scrollHeight;
      const trackHeight = this.dom.clientHeight;
      this.dom.replaceChildren();
      if (!scrollHeight || !trackHeight || !markers.length) return;

      for (const marker of markers) {
        const lineBlock = this.view.lineBlockAt(marker.from);
        const tick = document.createElement("button");
        tick.type = "button";
        tick.className = "cm-spec-overview-tick";
        tick.style.top = `${
          specOverviewTickTopPx(
            lineBlock.top,
            lineBlock.height,
            scrollHeight,
            trackHeight,
          )
        }px`;
        tick.title = marker.message;
        tick.setAttribute("aria-label", marker.message);
        tick.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        tick.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.view.dispatch({
            effects: EditorView.scrollIntoView(marker.from, { y: "center" }),
          });
          onSelect?.(marker.blockId);
        });
        this.dom.appendChild(tick);
      }
    }
  });
}

export function createMappingSpecEditor(
  parent: HTMLElement,
  options: MappingSpecEditorOptions = {},
): EditorView {
  const empty = blocklyJsonDocument(null);
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: empty.text,
      extensions: [
        foldGutter(),
        keymap.of(foldKeymap),
        foldService.of(indentFoldRange),
        jsonDocField.init(() => empty),
        specChromeField.init(() => emptyChrome),
        editFacet.of(options.onFieldEdit),
        selectFacet.of(options.onSelect),
        jsonDecorations,
        specOverview(options.onSelect),
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        specTheme,
      ],
    }),
  });
}

/** Replace the Spec view from canonical Blockly workspace JSON. */
export function setMappingSpecFromBlockly(
  view: EditorView,
  blocklyState: unknown,
  chrome: SpecChrome = emptyChrome,
): void {
  const next = blocklyJsonDocument(blocklyState);
  const current = view.state.doc.toString();
  if (current === next.text) {
    setMappingSpecChrome(view, chrome);
    return;
  }
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: next.text },
    effects: [setJsonDocEffect.of(next), setSpecChromeEffect.of(chrome)],
  });
}

export function setMappingSpecChrome(view: EditorView, chrome: SpecChrome): void {
  const prev = view.state.field(specChromeField);
  if (
    prev.selectedBlockId === chrome.selectedBlockId &&
    JSON.stringify(prev.warnings) === JSON.stringify(chrome.warnings)
  ) {
    return;
  }
  view.dispatch({ effects: setSpecChromeEffect.of(chrome) });
}

export function scrollMappingSpecToBlock(view: EditorView, blockId: string): void {
  const doc = view.state.field(jsonDocField);
  const widget = doc.widgets.find((item) =>
    item.line.blockId === blockId || (item.line.aliasIds ?? []).includes(blockId)
  );
  if (!widget) return;
  view.dispatch({
    effects: EditorView.scrollIntoView(widget.from, { y: "center" }),
  });
}

/** Compact Spec projection currently shown in the Mapping Spec tab. */
export function mappingSpecDocumentText(view: EditorView): string {
  return view.state.doc.toString();
}

export type { SpecFieldEditHandler, SpecBlockSelectHandler, SpecLine };
