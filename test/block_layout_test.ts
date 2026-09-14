/**
 * Shared mouth layout: every connected input hugs its socket, including
 * stock list constructors that used to keep Blockly's left-aligned chrome.
 */
import { assert, assertEquals } from "@std/assert";
import * as enMsg from "blockly/msg/en";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  blockTypeUsesMouthLayout,
  enforceMouthLayout,
} from "@intehrgrator/blockly/block_layout.ts";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import { BLOCK_OUT_EMOJI_FIELD } from "@intehrgrator/blockly/rm_type_emoji.ts";
import { isSlotLabelField } from "@intehrgrator/blockly/slot_label.ts";
import { dvFieldInputName } from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import {
  applyOpenEhrRowAlign_,
  shouldPinSlotCaptionToMouth_,
} from "@intehrgrator/blockly/compact_renderer.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  const anyMod = enMsg as { default?: Record<string, string> } & Record<string, string>;
  const table = anyMod.default && typeof anyMod.default === "object" ? anyMod.default : anyMod;
  Blockly.setLocale(table);
  initBlocklyGenerators();
  ready = true;
}

Deno.test("blockTypeUsesMouthLayout covers list constructors", () => {
  assertEquals(blockTypeUsesMouthLayout("lists_create_with"), true);
  assertEquals(blockTypeUsesMouthLayout("lists_getIndex"), true);
  assertEquals(blockTypeUsesMouthLayout("for_each_list"), true);
  assertEquals(blockTypeUsesMouthLayout("logic_compare"), false);
});

Deno.test("enforceMouthLayout right-aligns every connected input", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const list = ws.newBlock("lists_create_with") as Blockly.Block & {
    itemCount_: number;
    updateShape_: () => void;
  };
  list.itemCount_ = 3;
  list.updateShape_();
  enforceMouthLayout(list);
  assertEquals(list.getInputsInline(), false);
  const AlignRight = Blockly.inputs.Align.RIGHT;
  for (const input of list.inputList) {
    if (!input.connection) continue;
    assertEquals(input.align, AlignRight, input.name);
  }
  ws.dispose();
});

Deno.test("lists_create_with and lists_getIndex hug mouths after stock init", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const list = ws.newBlock("lists_create_with");
  assertEquals(list.getInputsInline(), false);
  const add0 = list.getInput("ADD0");
  assert(add0, "ADD0");
  assertEquals(add0.align, Blockly.inputs.Align.RIGHT);
  assert(list.getField(BLOCK_OUT_EMOJI_FIELD), "output glyph stays on the first row");

  const get = ws.newBlock("lists_getIndex");
  assertEquals(get.getInputsInline(), false);
  const value = get.getInput("VALUE");
  assert(value, "VALUE is the list socket");
  assertEquals(value.align, Blockly.inputs.Align.RIGHT);
  ws.dispose();
});

Deno.test("mouth rows stay RIGHT even when the output glyph sits on that row", () => {
  const AlignLeft = -1;
  const AlignRight = 1;
  const row = {
    hasInlineInput: true,
    align: AlignLeft,
    elements: [{ field: { name: BLOCK_OUT_EMOJI_FIELD } }, { field: { name: "TEXT" } }],
  };
  applyOpenEhrRowAlign_(row, AlignLeft, AlignRight);
  assertEquals(row.align, AlignRight);
});

Deno.test("dummy HEADER chrome stays LEFT", () => {
  const AlignLeft = -1;
  const AlignRight = 1;
  const row = {
    hasInlineInput: false,
    hasExternalInput: false,
    hasStatement: false,
    align: AlignRight,
    elements: [{ field: { name: BLOCK_OUT_EMOJI_FIELD } }, { field: { name: "MUTATOR_COG" } }],
  };
  applyOpenEhrRowAlign_(row, AlignLeft, AlignRight);
  assertEquals(row.align, AlignLeft);
});

Deno.test("plain FieldLabels on tall mouths pin like slot captions", () => {
  const label = { field: { name: "TEXT" } };
  assertEquals(
    shouldPinSlotCaptionToMouth_({ hasInlineInput: true }, label),
    true,
  );
  assertEquals(
    shouldPinSlotCaptionToMouth_({ hasStatement: true }, label),
    true,
  );
  assertEquals(
    shouldPinSlotCaptionToMouth_({ hasInlineInput: false, hasExternalInput: false }, label),
    false,
  );
});

Deno.test("DV_CODED_TEXT and CODE_PHRASE field rows use slot captions", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const coded = ws.newBlock("dv_coded_text");
  assertEquals(coded.getInputsInline(), false);
  const value = coded.getInput(dvFieldInputName("value"));
  assert(value);
  assertEquals(value.align, Blockly.inputs.Align.RIGHT);
  assert(isSlotLabelField(value.fieldRow[0]), "value uses FieldSlotLabel");

  const phrase = ws.newBlock("code_phrase");
  const code = phrase.getInput(dvFieldInputName("code_string"));
  assert(code);
  assertEquals(code.align, Blockly.inputs.Align.RIGHT);
  assert(isSlotLabelField(code.fieldRow[0]), "code uses FieldSlotLabel");
  ws.dispose();
});
