import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorState, Facet, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  keymap,
  lineNumbers,
  type ViewUpdate,
} from "@codemirror/view";
import { projectBlocklyState, type SpecLine, type SpecProjection } from "./project.ts";
import { MappingSpecWidget, SPEC_LINE_HEIGHT, type SpecFieldEditHandler } from "./widgets.ts";

const setProjectionEffect = StateEffect.define<SpecProjection>();

const projectionField = StateField.define<SpecProjection>({
  create() {
    return projectBlocklyState(null);
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setProjectionEffect)) return effect.value;
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

function buildDecorations(view: EditorView): Decoration {
  const projection = view.state.field(projectionField);
  const onEdit = view.state.facet(editFacet);
  const ranges = [];
  for (let i = 0; i < projection.lines.length; i++) {
    const line = view.state.doc.line(i + 1);
    const meta = projection.lines[i]!;
    ranges.push(
      Decoration.replace({
        widget: new MappingSpecWidget(meta, onEdit),
        inclusive: true,
      }).range(line.from, line.to),
    );
  }
  return Decoration.set(ranges, true);
}

const widgetPlugin = ViewPlugin.fromClass(
  class {
    decorations: Decoration;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.transactions.some((tr) =>
          tr.effects.some((effect) => effect.is(setProjectionEffect))
        )
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (value) => value.decorations },
);

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
  ".spec-widget-balloon": {
    position: "absolute",
    right: "0",
    top: `${SPEC_LINE_HEIGHT}px`,
    zIndex: "5",
    margin: "0",
    maxWidth: "min(420px, 70vw)",
    maxHeight: "200px",
    overflow: "auto",
    padding: "8px 10px",
    background: "#003b49",
    color: "#f5f5f0",
    borderRadius: "6px",
    font: "11px/1.35 ui-monospace, monospace",
    boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
    whiteSpace: "pre-wrap",
  },
});

export interface MappingSpecEditorOptions {
  onFieldEdit?: SpecFieldEditHandler;
}

export function createMappingSpecEditor(
  parent: HTMLElement,
  options: MappingSpecEditorOptions = {},
): EditorView {
  const empty = projectBlocklyState(null);
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: empty.text,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        projectionField.init(() => empty),
        editFacet.of(options.onFieldEdit),
        widgetPlugin,
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        specTheme,
      ],
    }),
  });
}

/** Replace the Spec view from canonical Blockly workspace JSON. */
export function setMappingSpecFromBlockly(view: EditorView, blocklyState: unknown): void {
  const projection = projectBlocklyState(blocklyState);
  const current = view.state.doc.toString();
  if (
    current === projection.text &&
    sameLines(view.state.field(projectionField).lines, projection.lines)
  ) {
    return;
  }
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: projection.text },
    effects: setProjectionEffect.of(projection),
  });
}

function sameLines(a: SpecLine[], b: SpecLine[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i]!.blockId !== b[i]!.blockId ||
      a[i]!.summary !== b[i]!.summary ||
      JSON.stringify(a[i]!.editable) !== JSON.stringify(b[i]!.editable)
    ) {
      return false;
    }
  }
  return true;
}

export type { SpecFieldEditHandler, SpecProjection, SpecLine };
