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
import { MappingSpecWidget, type SpecFieldEditHandler } from "./widgets.ts";

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
  ".cm-content": { caretColor: "transparent" },
  ".spec-widget": {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "22px",
    position: "relative",
    fontFamily: "system-ui, sans-serif",
    fontSize: "12px",
    color: "var(--text, #1a1a1a)",
  },
  ".spec-widget-badge": {
    flex: "0 0 auto",
    fontSize: "10px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: "#005c53",
    background: "#e8f5f2",
    borderRadius: "3px",
    padding: "1px 5px",
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
    minWidth: "8rem",
    font: "12px ui-monospace, monospace",
    padding: "2px 6px",
    border: "1px solid #d9d9d9",
    borderRadius: "3px",
  },
  ".spec-widget-select": {
    flex: "0 0 auto",
    fontSize: "11px",
    padding: "2px 4px",
    border: "1px solid #d9d9d9",
    borderRadius: "3px",
    background: "#fff",
  },
  ".spec-widget-type": {
    flex: "0 0 auto",
    fontSize: "11px",
    fontFamily: "ui-monospace, monospace",
    color: "#9a4b00",
  },
  ".spec-widget-info": {
    flex: "0 0 auto",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    border: "1px solid #005c53",
    background: "#fff",
    color: "#005c53",
    font: "italic bold 11px/16px Georgia, serif",
    cursor: "pointer",
    padding: "0",
  },
  ".spec-widget-balloon": {
    position: "absolute",
    right: "0",
    top: "22px",
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
