import { assertEquals, assertExists } from "@std/assert";
import { EditorState } from "@codemirror/state";
import { foldable } from "@codemirror/language";
import {
  detectEditorLanguage,
  editorChromeExtensions,
  languageForExportTarget,
  languageSupport,
} from "@intehrgrator/workbench/codemirror_setup.ts";

Deno.test("detectEditorLanguage recognizes JSON, XML, and JS comments", () => {
  assertEquals(detectEditorLanguage('{"a": 1}'), "json");
  assertEquals(detectEditorLanguage("  [1, 2]"), "json");
  assertEquals(detectEditorLanguage('<?xml version="1.0"?><root/>'), "xml");
  assertEquals(detectEditorLanguage("<composition xmlns='http://example'/>"), "xml");
  assertEquals(detectEditorLanguage("// Test Run output"), "javascript");
  assertEquals(detectEditorLanguage("{{path}}"), "none");
  assertEquals(detectEditorLanguage(""), "none");
});

Deno.test("languageForExportTarget uses TypeScript and falls back to JSON/XML", () => {
  assertEquals(languageForExportTarget("preview", "// Pick a language"), "javascript");
  assertEquals(languageForExportTarget("typescript", "class Foo {}"), "typescript");
  assertEquals(languageForExportTarget("handlebars", '{"x": 1}'), "json");
  assertEquals(languageForExportTarget("handlebars", "<root>{{x}}</root>"), "xml");
  assertEquals(languageForExportTarget("java", "public class Map {}"), "none");
  assertEquals(languageForExportTarget("xquery", "xquery version '3.1';"), "none");
});

Deno.test("JSON language support reports a foldable range for a nested object", () => {
  const doc = '{\n  "a": {\n    "b": 1\n  }\n}\n';
  const state = EditorState.create({
    doc,
    extensions: [...editorChromeExtensions, languageSupport("json")],
  });
  const firstLine = state.doc.line(1);
  const range = foldable(state, firstLine.from, firstLine.to);
  assertExists(range);
  assertEquals(range.from < range.to, true);
});
