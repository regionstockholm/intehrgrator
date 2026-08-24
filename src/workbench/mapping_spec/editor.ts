import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorState, Facet, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  WidgetType,
  keymap,
  lineNumbers,
  type DecorationSet,
} from "@codemirror/view";
import {
  blocklyJsonDocument,
  type BlocklyJsonDocument,
  type SpecLine,
} from "./project.ts";
import { MappingSpecWidget, SPEC_LINE_HEIGHT, type SpecFieldEditHandler } from "./widgets.ts";

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

class HiddenJsonWidget extends WidgetType {
  override get estimatedHeight(): number {
    return 0;
  }

  override toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-spec-json-chrome";
    span.hidden = true;
    return span;
  }

  override eq(): boolean {
    return true;
  }
}

/**
 * Replace decorations that span line breaks must come from a StateField,
 * not a ViewPlugin (CodeMirror: "may not be specified via plugins").
 */
function buildDecorations(state: EditorState): DecorationSet {
  const doc = state.field(jsonDocField);
  const onEdit = state.facet(editFacet);
  if (!doc.widgets.length) return Decoration.none;

  const ranges = [];
  const text = state.doc.toString();
  let cursor = 0;
  for (const widget of doc.widgets) {
    if (widget.from > cursor) {
      ranges.push(
        Decoration.replace({
          widget: new HiddenJsonWidget(),
          block: true,
          inclusive: true,
        }).range(cursor, widget.from),
      );
    }
    ranges.push(
      Decoration.replace({
        widget: new MappingSpecWidget(widget.line, onEdit),
        inclusive: true,
      }).range(widget.from, widget.to),
    );
    cursor = widget.to;
    if (text[cursor] === "\n") cursor++;
  }
  if (cursor < text.length) {
    ranges.push(
      Decoration.replace({
        widget: new HiddenJsonWidget(),
        block: true,
        inclusive: true,
      }).range(cursor, text.length),
    );
  }
  return Decoration.set(ranges, true);
}

const jsonDecorations = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(value, tr) {
    if (
      tr.docChanged ||
      tr.effects.some((effect) => effect.is(setJsonDocEffect))
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
  ".cm-gutters": {
    lineHeight: `${SPEC_LINE_HEIGHT}px`,
    minHeight: "0",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    minHeight: `${SPEC_LINE_HEIGHT}px`,
    lineHeight: `${SPEC_LINE_HEIGHT}px`,
    fontSize: "10px",
  },
  ".cm-widgetBuffer": {
    height: "0",
    lineHeight: "0",
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
  ".spec-widget--dv .spec-widget-badge": {
    color: "#1e3a5f",
    background: "#e8eef7",
  },
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
  },
});

export interface MappingSpecEditorOptions {
  onFieldEdit?: SpecFieldEditHandler;
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
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        jsonDocField.init(() => empty),
        editFacet.of(options.onFieldEdit),
        jsonDecorations,
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        specTheme,
      ],
    }),
  });
}

/** Replace the Spec view from canonical Blockly workspace JSON. */
export function setMappingSpecFromBlockly(view: EditorView, blocklyState: unknown): void {
  const next = blocklyJsonDocument(blocklyState);
  const current = view.state.doc.toString();
  if (current === next.text) return;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: next.text },
    effects: setJsonDocEffect.of(next),
  });
}

/** The editor document is the full Blockly workspace JSON. */
export function mappingSpecDocumentText(view: EditorView): string {
  return view.state.doc.toString();
}

export type { SpecFieldEditHandler, SpecLine };
