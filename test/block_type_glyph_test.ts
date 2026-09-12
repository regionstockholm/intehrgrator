import { assert, assertEquals } from "@std/assert";
import * as enMsg from "blockly/msg/en";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { glyphForBlocklyCheck } from "@intehrgrator/blockly/block_type_glyph.ts";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import {
  ABSTRACT_SLOT_GLYPH,
  BLOCK_OUT_EMOJI_FIELD,
  measureGlyphWidth,
} from "@intehrgrator/blockly/rm_type_emoji.ts";
import {
  LISTS_SET_OPERATION_BLOCK,
  LOGIC_LIST_RESTRICTION_BLOCK,
} from "@intehrgrator/blockly/blocks/logic_blocks.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  const anyMod = enMsg as { default?: Record<string, string> } & Record<string, string>;
  const table = anyMod.default && typeof anyMod.default === "object" ? anyMod.default : anyMod;
  Blockly.setLocale(table);
  initBlocklyGenerators();
  ready = true;
}

Deno.test("glyphForBlocklyCheck maps Blockly primitives", () => {
  assertEquals(typeof glyphForBlocklyCheck("String"), "string");
  assertEquals(typeof glyphForBlocklyCheck("Number"), "string");
  assertEquals(glyphForBlocklyCheck("Boolean"), "✓");
  assertEquals(glyphForBlocklyCheck("Array"), "☰");
  assertEquals(glyphForBlocklyCheck("Sheet"), "⊞");
  assertEquals(glyphForBlocklyCheck("Map"), "↦");
});

Deno.test("glyphForBlocklyCheck uses abstract glyph for unions", () => {
  assertEquals(glyphForBlocklyCheck(["String", "Number", "Boolean"]), ABSTRACT_SLOT_GLYPH);
});

Deno.test("measureGlyphWidth reserves room for connection glyphs", () => {
  assertEquals(measureGlyphWidth("", 18), 0);
  assert(measureGlyphWidth("📋", 18) >= 18);
  assert(measureGlyphWidth("✓", 18) >= 18);
});

Deno.test("stock lists_length puts the output glyph on VALUE, not a HEADER dummy", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock("lists_length");
  assertEquals(block.getInput("HEADER"), null);
  assert(block.getField(BLOCK_OUT_EMOJI_FIELD), "output glyph");
  assertEquals(block.inputList[0]?.name, "VALUE");
  workspace.dispose();
});

Deno.test("logic list blocks do not add a HEADER dummy under the first value row", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const restriction = workspace.newBlock(LOGIC_LIST_RESTRICTION_BLOCK);
  assertEquals(restriction.getInput("HEADER"), null);
  assertEquals(restriction.inputList[0]?.name, "LIST");
  assert(restriction.getField(BLOCK_OUT_EMOJI_FIELD), "restriction output glyph");

  const setOp = workspace.newBlock(LISTS_SET_OPERATION_BLOCK);
  assertEquals(setOp.getInput("HEADER"), null);
  assertEquals(setOp.inputList[0]?.name, "A");
  assert(setOp.getField(BLOCK_OUT_EMOJI_FIELD), "set-op output glyph");
  workspace.dispose();
});
