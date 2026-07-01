import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { bracketMatching, indentOnInput } from "@codemirror/language";

const baseExtensions = [
  lineNumbers(),
  history(),
  indentOnInput(),
  bracketMatching(),
  keymap.of([...defaultKeymap, ...historyKeymap]),
  EditorView.theme({
    "&": { height: "100%", fontSize: "12px" },
    ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, monospace" },
  }),
];

export function createReadonlyEditor(parent: HTMLElement, placeholder = ""): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: placeholder,
      extensions: [
        ...baseExtensions,
        javascript(),
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
      ],
    }),
  });
}

export function createSpecEditor(
  parent: HTMLElement,
  onExpressionEdit: (line: number, text: string) => void,
): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: "",
      extensions: [
        ...baseExtensions,
        javascript(),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          for (const tr of update.transactions) {
            if (!tr.docChanged) continue;
            tr.changes.iterChangedRanges((_fromA, _toA, fromB, _toB, inserted) => {
              const line = update.state.doc.lineAt(fromB).number - 1;
              onExpressionEdit(line, inserted.toString());
            });
          }
        }),
      ],
    }),
  });
}

export function setEditorDoc(view: EditorView, doc: string): void {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: doc },
  });
}
