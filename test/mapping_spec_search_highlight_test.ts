import { assertEquals } from "@std/assert";
import { EditorSelection, EditorState } from "@codemirror/state";
import { search, SearchQuery, setSearchQuery } from "@codemirror/search";
import { blocklyJsonDocument } from "@intehrgrator/workbench/mapping_spec/project.ts";
import {
  specRangeIsCurrentSearchHit,
  specRangeMatchesSearch,
  specSearchFocusField,
} from "@intehrgrator/workbench/mapping_spec/editor.ts";
import { displayMatchIsCurrent, claimDisplayAnchor } from "@intehrgrator/workbench/mapping_spec/widgets.ts";

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

Deno.test("specRangeIsCurrentSearchHit follows exact selected match (fallback)", () => {
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

Deno.test("specRangeIsCurrentSearchHit uses select.search focus when caret is remapped away", () => {
  const doc = "alpha\nelement · systolic\nomega";
  const from = doc.indexOf("element");
  const to = from + "element".length;
  let state = EditorState.create({
    doc,
    extensions: [search({ top: true }), specSearchFocusField],
  });
  state = state.update({
    effects: setSearchQuery.of(new SearchQuery({ search: "element" })),
  }).state;
  // findNext-style jump records focus via userEvent even if caret later remaps.
  state = state.update({
    selection: EditorSelection.range(from, to),
    userEvent: "select.search",
  }).state;
  // Remap caret to a collapsed position outside the match (replace-widget behavior).
  state = state.update({
    selection: EditorSelection.cursor(0),
  }).state;

  assertEquals(state.field(specSearchFocusField), { from, to });
  assertEquals(specRangeIsCurrentSearchHit(state, from, to), true);
  assertEquals(specRangeIsCurrentSearchHit(state, 0, 5), false);
});

Deno.test("specSearchFocusField lands on first match when query is set", () => {
  const doc = "alpha\nelement · systolic\nomega";
  const from = doc.indexOf("element");
  const to = from + "element".length;
  let state = EditorState.create({
    doc,
    extensions: [search({ top: true }), specSearchFocusField],
  });
  state = state.update({
    effects: setSearchQuery.of(new SearchQuery({ search: "element" })),
  }).state;

  assertEquals(state.field(specSearchFocusField), { from, to });
  assertEquals(specRangeIsCurrentSearchHit(state, from, to), true);
});

Deno.test("displayMatchIsCurrent uses a claimed line anchor per duplicate label", () => {
  const lineText = "language  maps_get · defaults · language";
  const lineFrom = 10;
  const used = new Set<number>();
  const first = claimDisplayAnchor(lineText, "language", used);
  const second = claimDisplayAnchor(lineText, "language", used);
  if (first == null || second == null) throw new Error("expected two language anchors");
  assertEquals(first < second, true);

  const paintSecond = {
    search: "langu",
    caseSensitive: false,
    regexp: false,
    current: true,
    currentFrom: lineFrom + second,
    currentTo: lineFrom + second + 5,
    lineFrom,
    lineText,
  };
  assertEquals(displayMatchIsCurrent(paintSecond, first, 0, 5), false);
  assertEquals(displayMatchIsCurrent(paintSecond, second, 0, 5), true);

  const paintFirst = {
    ...paintSecond,
    currentFrom: lineFrom + first,
    currentTo: lineFrom + first + 5,
  };
  assertEquals(displayMatchIsCurrent(paintFirst, first, 0, 5), true);
  assertEquals(displayMatchIsCurrent(paintFirst, second, 0, 5), false);
});
