import { assertEquals } from "@std/assert";
import { EditorSelection, EditorState } from "@codemirror/state";
import { search, SearchQuery, setSearchQuery } from "@codemirror/search";
import { blocklyJsonDocument } from "@intehrgrator/workbench/mapping_spec/project.ts";
import {
  specRangeIsCurrentSearchHit,
  specRangeMatchesSearch,
} from "@intehrgrator/workbench/mapping_spec/editor.ts";

Deno.test("specRangeMatchesSearch finds projected Spec line text under replace widgets", () => {
  const projected = blocklyJsonDocument({
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: "element",
          id: "el1",
          fields: { NAME: "systolic" },
        },
      ],
    },
  });
  const widget = projected.widgets.find((item) => item.line.blockId === "el1");
  if (!widget) throw new Error("expected element widget");

  let state = EditorState.create({
    doc: projected.text,
    extensions: [search({ top: true })],
  });
  state = state.update({
    effects: setSearchQuery.of(new SearchQuery({ search: "element", caseSensitive: false })),
  }).state;

  assertEquals(specRangeMatchesSearch(state, widget.from, widget.to), true);
  assertEquals(specRangeMatchesSearch(state, 0, 0), false);

  state = state.update({
    effects: setSearchQuery.of(new SearchQuery({ search: "no-such-token" })),
  }).state;
  assertEquals(specRangeMatchesSearch(state, widget.from, widget.to), false);
});

Deno.test("specRangeIsCurrentSearchHit follows the selected match range", () => {
  const doc = "alpha\nelement · systolic\nomega";
  let state = EditorState.create({
    doc,
    extensions: [search({ top: true })],
  });
  const from = doc.indexOf("element");
  const to = from + "element".length;
  state = state.update({
    effects: setSearchQuery.of(new SearchQuery({ search: "element" })),
    selection: EditorSelection.range(from, to),
  }).state;

  assertEquals(specRangeMatchesSearch(state, from, to), true);
  assertEquals(specRangeIsCurrentSearchHit(state, from, to), true);
  assertEquals(specRangeIsCurrentSearchHit(state, 0, 5), false);
});
