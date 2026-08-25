import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { html } from "@codemirror/lang-html";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";

/** Languages we can highlight. `"none"` still gets folding chrome, but no parser. */
export type EditorLanguage =
  | "javascript"
  | "typescript"
  | "json"
  | "xml"
  | "html"
  | "handlebars"
  | "none";

/** Dropdown pairs for Blockly (`[label, value]`). */
export const EDITOR_LANGUAGE_OPTIONS: Array<[string, EditorLanguage]> = [
  ["Plain", "none"],
  ["Handlebars", "handlebars"],
  ["JSON", "json"],
  ["XML", "xml"],
  ["HTML", "html"],
  ["JavaScript", "javascript"],
  ["TypeScript", "typescript"],
];

const languageOf = new WeakMap<EditorView, Compartment>();
const currentLanguage = new WeakMap<EditorView, EditorLanguage>();

const handlebarsLanguage = StreamLanguage.define({
  name: "handlebars",
  startState: () => ({ inMustache: false }),
  token(stream, state: { inMustache: boolean }) {
    if (!state.inMustache) {
      if (stream.match("{{")) {
        state.inMustache = true;
        return "bracket";
      }
      stream.next();
      stream.eatWhile((ch) => ch !== "{");
      return null;
    }
    if (stream.match("}}")) {
      state.inMustache = false;
      return "bracket";
    }
    if (stream.match(/^[#/][\w.]+/) || stream.match(/^(else|this|as)\b/)) {
      return "keyword";
    }
    if (stream.match(/^[\w.$]+/)) return "variableName";
    stream.next();
    return "string";
  },
});

export function languageSupport(language: EditorLanguage): Extension {
  switch (language) {
    case "javascript":
      return javascript();
    case "typescript":
      return javascript({ typescript: true });
    case "json":
      return json();
    case "xml":
      return xml();
    case "html":
      return html();
    case "handlebars":
      return handlebarsLanguage;
    case "none":
      return [];
  }
}

/** Guess JSON / JS / XML from leading tokens when the caller has no MIME type. */
export function detectEditorLanguage(text: string): EditorLanguage {
  const trimmed = text.trimStart();
  if (!trimmed) return "none";
  // Handlebars `{{…}}` also starts with `{`; highlight as Handlebars, not JSON.
  if (trimmed.startsWith("{{")) return "handlebars";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  if (trimmed.startsWith("<?xml") || /^<[A-Za-z!?]/.test(trimmed)) return "xml";
  if (trimmed.startsWith("//") || trimmed.startsWith("/*")) return "javascript";
  return "none";
}

export function languageForExportTarget(target: string, code = ""): EditorLanguage {
  if (target === "preview") return "javascript";
  if (target === "typescript") return "typescript";
  const detected = detectEditorLanguage(code);
  if (detected === "json" || detected === "xml") return detected;
  return "none";
}

/** Line numbers, fold gutter, foldCode keymap, highlighting. Shared by all editors. */
export const editorChromeExtensions: Extension[] = [
  lineNumbers(),
  foldGutter(),
  history(),
  indentOnInput(),
  bracketMatching(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
];

const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "12px" },
  ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, monospace" },
});

function mountEditor(
  parent: HTMLElement,
  doc: string,
  language: EditorLanguage,
  extra: Extension[],
): EditorView {
  const languageConf = new Compartment();
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        ...editorChromeExtensions,
        languageConf.of(languageSupport(language)),
        editorTheme,
        ...extra,
      ],
    }),
  });
  languageOf.set(view, languageConf);
  currentLanguage.set(view, language);
  return view;
}

/** Compact CodeMirror for embedding inside a Blockly field (no fold gutter). */
export function createInlineEditor(
  parent: HTMLElement,
  doc: string,
  language: EditorLanguage,
  onChange: (text: string) => void,
): EditorView {
  const languageConf = new Compartment();
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        history(),
        indentOnInput(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        languageConf.of(languageSupport(language)),
        EditorView.theme({
          "&": { height: "100%", fontSize: "12px", backgroundColor: "#fff" },
          ".cm-editor": { height: "100%" },
          ".cm-scroller": {
            overflow: "auto",
            fontFamily: "ui-monospace, Consolas, monospace",
          },
          ".cm-gutters": { minHeight: "100%", backgroundColor: "#f6f6f6" },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString());
        }),
      ],
    }),
  });
  languageOf.set(view, languageConf);
  currentLanguage.set(view, language);
  return view;
}

export function createReadonlyEditor(
  parent: HTMLElement,
  placeholder = "",
  language: EditorLanguage = "javascript",
): EditorView {
  return mountEditor(parent, placeholder, language, [
    EditorView.editable.of(false),
    EditorState.readOnly.of(true),
  ]);
}

export function createTextEditor(
  parent: HTMLElement,
  onChange: (text: string) => void,
  language: EditorLanguage = "none",
): EditorView {
  return mountEditor(parent, "", language, [
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
    }),
  ]);
}

export function setEditorDoc(
  view: EditorView,
  doc: string,
  language?: EditorLanguage,
): void {
  const effects = [];
  if (language !== undefined && currentLanguage.get(view) !== language) {
    const compartment = languageOf.get(view);
    if (compartment) {
      effects.push(compartment.reconfigure(languageSupport(language)));
      currentLanguage.set(view, language);
    }
  }
  const current = view.state.doc.toString();
  if (current === doc && effects.length === 0) return;
  view.dispatch({
    changes: current === doc ? [] : { from: 0, to: view.state.doc.length, insert: doc },
    effects,
  });
}
