/**
 * Throwaway #85 playground: real Blockly, modest theme, four join_list shapes.
 * Open via dist/prototype-join-list.html?variant=A after `deno task build`.
 *
 * Intentionally does not import `src/blockly/mod.ts` (ehrtslib / RM stack).
 */
import type { BlockSvg } from "blockly/core";
import "blockly/blocks";
import { Blockly } from "../src/blockly/blockly_core.ts";
import { createModestTheme } from "../src/blockly/theme.ts";
import { loadBlocklyLocale } from "../src/blockly/i18n/locale.ts";
import {
  PROTOTYPE_DECISION_INDEX,
  PROTOTYPE_DECISION_POSITION,
  PROTOTYPE_JOIN_FOR_READING,
  PROTOTYPE_JOIN_LIST,
  PROTOTYPE_JOIN_LOCALE,
  PROTOTYPE_JOIN_POSITION_RECIPE,
  PROTOTYPE_JOIN_VIA_TABLE,
  PROTOTYPE_LIST_INDEX,
  PROTOTYPE_LIST_IS_FIRST,
  PROTOTYPE_LIST_IS_LAST,
  PROTOTYPE_LIST_LENGTH,
  PROTOTYPE_THIS_ITEM,
  registerJoinListPrototypeBlocks,
} from "../src/blockly/blocks/join_list_prototype.ts";

type VariantKey = "A" | "B" | "C" | "D" | "E";

interface Variant {
  key: VariantKey;
  name: string;
  title: string;
  serializes: string;
  output: string;
  notesHtml: string;
  showSheet: boolean;
  sheetHtml: string;
  build: (ws: Blockly.WorkspaceSvg) => void;
}

const KEYS: VariantKey[] = ["A", "B", "C", "D", "E"];

function asSvg(block: Blockly.Block): BlockSvg {
  return block as BlockSvg;
}

function ready(block: Blockly.Block): BlockSvg {
  const svg = asSvg(block);
  svg.initSvg();
  svg.render();
  return svg;
}

function text(ws: Blockly.WorkspaceSvg, value: string): BlockSvg {
  const block = ready(ws.newBlock("text"));
  block.setFieldValue(value, "TEXT");
  return block;
}

function namesList(ws: Blockly.WorkspaceSvg): BlockSvg {
  const list = ws.newBlock("lists_create_with") as Blockly.Block & {
    itemCount_: number;
    updateShape_: () => void;
  };
  list.itemCount_ = 3;
  list.updateShape_();
  const svg = ready(list);
  plug(svg, "ADD0", text(ws, "Anna"));
  plug(svg, "ADD1", text(ws, "Bo"));
  plug(svg, "ADD2", text(ws, "Carl"));
  return svg;
}

function plug(parent: Blockly.Block, input: string, child: Blockly.Block): void {
  parent.getInput(input)?.connection?.connect(child.outputConnection!);
}

function place(block: Blockly.Block, x: number, y: number): void {
  asSvg(block).moveBy(x, y);
}

function number(ws: Blockly.WorkspaceSvg, value: number): BlockSvg {
  const block = ready(ws.newBlock("math_number"));
  block.setFieldValue(String(value), "NUM");
  return block;
}

function eq(ws: Blockly.WorkspaceSvg, left: BlockSvg, right: BlockSvg): BlockSvg {
  const cmp = ready(ws.newBlock("logic_compare"));
  cmp.setFieldValue("EQ", "OP");
  plug(cmp, "A", left);
  plug(cmp, "B", right);
  return cmp;
}

function minus(ws: Blockly.WorkspaceSvg, left: BlockSvg, right: BlockSvg): BlockSvg {
  const op = ready(ws.newBlock("math_arithmetic"));
  op.setFieldValue("MINUS", "OP");
  plug(op, "A", left);
  plug(op, "B", right);
  return op;
}

function remainder(ws: Blockly.WorkspaceSvg, dividend: BlockSvg, divisor: BlockSvg): BlockSvg {
  const op = ready(ws.newBlock("math_modulo"));
  plug(op, "DIVIDEND", dividend);
  plug(op, "DIVISOR", divisor);
  return op;
}

function textJoin(ws: Blockly.WorkspaceSvg, left: string, item: BlockSvg): BlockSvg {
  const join = ws.newBlock("text_join") as Blockly.Block & {
    itemCount_?: number;
    updateShape_?: () => void;
  };
  if (typeof join.itemCount_ === "number") {
    join.itemCount_ = 2;
    join.updateShape_?.();
  }
  const svg = ready(join);
  plug(svg, "ADD0", text(ws, left));
  plug(svg, "ADD1", item);
  return svg;
}

const VARIANTS: Record<VariantKey, Variant> = {
  A: {
    key: "A",
    name: "Compact join_list",
    title: "A — Compact Text reporter",
    serializes: `join_list(\n  list("Anna", "Bo", "Carl"),\n  ", ",\n  " och "\n)`,
    output: "Anna, Bo och Carl",
    showSheet: false,
    sheetHtml: "",
    notesHtml: `
      <p>Closest to the #85 Mapping Expression API. One yellow <strong>Text</strong> reporter:
      list socket + two punctuation fields.</p>
      <ul>
        <li>0 items → <code>""</code>; 1 item → the item; 2 items use only <em>before last</em>.</li>
        <li>No lambda. Separators are literals, so TypeScript / XQuery / Go emit a tiny helper.</li>
        <li>Authors still need a list of strings (existing <code>lists_create_with</code>,
          source query, or a later <code>list_map</code>).</li>
      </ul>
      <p>This is the smallest verifiable surface: <code>string[] × string × string → string</code>.</p>
    `,
    build(ws) {
      const join = ready(ws.newBlock(PROTOTYPE_JOIN_LIST));
      plug(join, "ITEMS", namesList(ws));
      place(join, 40, 40);
    },
  },
  B: {
    key: "B",
    name: "Named-slot recipe",
    title: "B — Named mouths (map scaffolding, cleaned up)",
    serializes: `concat(\n  "Närvarande: ",\n  join_list(names, ", ", " och "),\n  "."\n)`,
    output: "Närvarande: Anna, Bo och Carl.",
    showSheet: false,
    sheetHtml: "",
    notesHtml: `
      <p>Erik’s map with <code>prefix</code> / <code>first</code> / <code>default</code> /
      <code>last</code> / <code>postfix</code> keys, but as a <strong>first-class block</strong>
      with locked captions — not a freeform Map.</p>
      <ul>
        <li>Yellow block = same algebra as A, plus wrap-around prose and skip-empty.</li>
        <li>Teal block below = the richer “item template” reading of the map
          (<code>first</code>/<code>middle</code>/<code>last</code> as expressions over
          <em>this item</em>). Those sockets are <strong>lambdas</strong>. Mapping Expression
          does not have lambdas today; they would be a new hatch.</li>
      </ul>
      <p class="warn">Recommendation: keep the yellow named-slot block (separators + wrap).
      Do not take the teal per-item templates into v1.</p>
    `,
    build(ws) {
      const join = ready(ws.newBlock(PROTOTYPE_JOIN_FOR_READING));
      plug(join, "ITEMS", namesList(ws));
      plug(join, "PREFIX", text(ws, "Närvarande: "));
      plug(join, "POSTFIX", text(ws, "."));
      place(join, 24, 16);

      const recipe = ready(ws.newBlock(PROTOTYPE_JOIN_POSITION_RECIPE));
      plug(recipe, "ITEMS", namesList(ws));
      plug(recipe, "PREFIX", text(ws, "Dear "));
      plug(recipe, "FIRST", ready(ws.newBlock(PROTOTYPE_THIS_ITEM)));
      plug(recipe, "MIDDLE", textJoin(ws, ", ", ready(ws.newBlock(PROTOTYPE_THIS_ITEM))));
      plug(recipe, "LAST", textJoin(ws, " och ", ready(ws.newBlock(PROTOTYPE_THIS_ITEM))));
      plug(recipe, "POSTFIX", text(ws, "."));
      place(recipe, 40, 360);
    },
  },
  C: {
    key: "C",
    name: "Locale preset",
    title: "C — Locale / style dropdown",
    serializes: `join_list(names, ", ", " och ")  -- locale "sv"`,
    output: "Anna, Bo och Carl",
    showSheet: false,
    sheetHtml: "",
    notesHtml: `
      <p>One list socket and a style menu. The example line on the block is the pedagogical
      payoff: authors see the grammar without typing punctuation.</p>
      <ul>
        <li>Presets still lower to the same two separator strings as A.</li>
        <li>#85 listed locale auto-detection as a <em>non-goal</em> for v1. A dropdown of
          three frozen styles is weaker i18n than that, and may still be worth it.</li>
        <li>Custom punctuation (rare connectors, HTML, markdown) still needs A or B.</li>
      </ul>
    `,
    build(ws) {
      const join = ready(ws.newBlock(PROTOTYPE_JOIN_LOCALE));
      plug(join, "ITEMS", namesList(ws));
      place(join, 40, 48);
    },
  },
  D: {
    key: "D",
    name: "Decision table + first/last",
    title: "D — Decision table over list position",
    serializes: `join_list_via_table(\n  names,\n  "NärvarandeList"  -- FIRST; locals first, last, name\n)`,
    output: "Anna, Bo och Carl",
    showSheet: false,
    sheetHtml: "",
    notesHtml: `
      <p>Second alternative from the #85 comment: a table of position cases, VMS-Mustache snippets
      as output, list-position tests as condition columns.</p>
      <ul>
        <li>Top block is the end-user sugar: “join this list using that table.”</li>
        <li>Below: the same idea expanded — named <code>first</code>/<code>last</code>/<code>name</code>
          mouths on a decision lookalike. <code>is first</code> / <code>is last</code> are Logic
          reporters, not Handlebars <code>@</code>-vars.</li>
        <li>COLLECT stays for “which clinical fragments belong”; this table answers
          “how do I punctuate <em>this</em> item.”</li>
      </ul>
      <h3>Table NärvarandeList</h3>
      <p style="margin:0 0 8px">Hit policy FIRST, output kind snippet. Evaluated
      <strong>once per list item</strong>; snippets concatenate. Not COLLECT of clinical fragments.</p>
      <table class="proto-dt">
        <thead>
          <tr><th>first</th><th>last</th><th>snippet</th><th>fires for</th></tr>
        </thead>
        <tbody>
          <tr><td>true</td><td>—</td><td><code>{{name}}</code></td><td>Anna (also singleton)</td></tr>
          <tr><td>false</td><td>false</td><td><code>, {{name}}</code></td><td>Bo</td></tr>
          <tr><td>false</td><td>true</td><td><code> och {{name}}</code></td><td>Carl</td></tr>
        </tbody>
      </table>
    `,
    build(ws) {
      const join = ready(ws.newBlock(PROTOTYPE_JOIN_VIA_TABLE));
      plug(join, "ITEMS", namesList(ws));
      place(join, 24, 12);

      const decision = ready(ws.newBlock(PROTOTYPE_DECISION_POSITION));
      plug(decision, "FIRST", ready(ws.newBlock(PROTOTYPE_LIST_IS_FIRST)));
      plug(decision, "LAST", ready(ws.newBlock(PROTOTYPE_LIST_IS_LAST)));
      plug(decision, "ITEM", ready(ws.newBlock(PROTOTYPE_THIS_ITEM)));
      place(decision, 24, 200);
    },
  },
  E: {
    key: "E",
    name: "Loop index + length",
    title: "E — Index and length on the loop (not Handlebars @)",
    serializes: `first := index = 0\nlast  := index = length - 1\nodd   := index mod 2 = 1`,
    output: "Anna, Bo och Carl",
    showSheet: false,
    sheetHtml: "",
    notesHtml: `
      <p>Bind <code>index</code> (0-based) and <code>length</code> on <code>for_each_source</code> /
      <code>for_each_list</code>, visible to child blocks the same way <code>item</code> is today.
      <code>is first</code> / <code>is last</code> become one-line sugar over those two ints.
      Odd/even is <code>index mod 2</code> with existing Math blocks.</p>
      <ul>
        <li>Does <em>not</em> make SMT harder in kind: two extra loop-invariant / loop-index
          integers, <code>0 ≤ index &lt; length</code>, <code>length = |collection|</code> at entry.</li>
        <li>Lung-MDT <code>@index</code> / <code>@first</code> / <code>@last</code> is a
          <strong>semantic transform</strong> onto these reporters — no need to keep the
          Handlebars names for compatibility.</li>
        <li>Do not bind index on <code>logic_list_restriction</code> in v1 (quantifiers should
          stay order-insensitive unless we have a real case).</li>
      </ul>
    `,
    build(ws) {
      const join = ready(ws.newBlock(PROTOTYPE_JOIN_VIA_TABLE));
      plug(join, "ITEMS", namesList(ws));
      place(join, 16, 8);

      const decision = ready(ws.newBlock(PROTOTYPE_DECISION_INDEX));
      plug(
        decision,
        "FIRST",
        eq(ws, ready(ws.newBlock(PROTOTYPE_LIST_INDEX)), number(ws, 0)),
      );
      plug(
        decision,
        "LAST",
        eq(
          ws,
          ready(ws.newBlock(PROTOTYPE_LIST_INDEX)),
          minus(ws, ready(ws.newBlock(PROTOTYPE_LIST_LENGTH)), number(ws, 1)),
        ),
      );
      plug(
        decision,
        "ODD",
        eq(
          ws,
          remainder(ws, ready(ws.newBlock(PROTOTYPE_LIST_INDEX)), number(ws, 2)),
          number(ws, 1),
        ),
      );
      plug(decision, "ITEM", ready(ws.newBlock(PROTOTYPE_THIS_ITEM)));
      place(decision, 16, 200);
    },
  },
};

function currentKey(): VariantKey {
  const raw = new URLSearchParams(location.search).get("variant") ?? "A";
  return KEYS.includes(raw as VariantKey) ? (raw as VariantKey) : "A";
}

function setKey(key: VariantKey): void {
  const url = new URL(location.href);
  url.searchParams.set("variant", key);
  history.replaceState({}, "", url);
}

function neighbour(key: VariantKey, delta: number): VariantKey {
  const i = KEYS.indexOf(key);
  return KEYS[(i + delta + KEYS.length) % KEYS.length]!;
}

let workspace: Blockly.WorkspaceSvg | null = null;

function renderSide(v: Variant): void {
  const side = document.getElementById("side")!;
  side.innerHTML = `
    <h2>${v.title}</h2>
    ${v.notesHtml}
    <h3>Wanted reading</h3>
    <div class="proto-out">${v.output}</div>
    <h3>Lowers to</h3>
    <div class="proto-serial">${v.serializes}</div>
  `;
  const label = document.getElementById("switcher-label")!;
  label.textContent = `${v.key} (${v.name})`;
}

function loadVariant(key: VariantKey): void {
  if (!workspace) return;
  workspace.clear();
  const v = VARIANTS[key];
  v.build(workspace);
  workspace.setScale(key === "E" ? 0.78 : 0.92);
  workspace.scrollCenter();
  renderSide(v);
  document.body.dataset.protoReady = key;
}

function boot(): void {
  void (async () => {
    await loadBlocklyLocale("en");
    registerJoinListPrototypeBlocks();
    const mount = document.getElementById("blockly")!;
    workspace = Blockly.inject(mount, {
      theme: createModestTheme(),
      collapse: false,
      grid: { spacing: 20, length: 2, colour: "#E8EAED" },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.95,
        maxScale: 1.6,
        minScale: 0.5,
        scaleSpeed: 1.2,
        pinch: true,
      },
      move: { scrollbars: true, drag: true, wheel: true },
      trashcan: false,
      renderer: "thrasos",
    });
    const key = currentKey();
    setKey(key);
    loadVariant(key);

    document.getElementById("prev")!.addEventListener("click", () => go(-1));
    document.getElementById("next")!.addEventListener("click", () => go(1));
    document.addEventListener("keydown", (event) => {
      const t = event.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    });
  })();
}

function go(delta: number): void {
  const next = neighbour(currentKey(), delta);
  setKey(next);
  loadVariant(next);
}

boot();
