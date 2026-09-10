import { assert, assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import "blockly/blocks";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import {
  ABSTRACT_SLOT_GLYPH,
  BLOCK_OUT_EMOJI_FIELD,
  checkConnectionTooltip,
  glyphForConnectionCheck,
  slotEmojiFieldName,
} from "@intehrgrator/blockly/rm_type_emoji.ts";
import { zipehrEmojiForRmType } from "@intehrgrator/core/rm_emoji.ts";
import { LOGIC_LIST_RESTRICTION_BLOCK } from "@intehrgrator/blockly/blocks/logic_blocks.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

Deno.test("Blockly primitive checks reuse ZipEHR glyphs; unions use ⁇", () => {
  assertEquals(glyphForConnectionCheck("Boolean"), zipehrEmojiForRmType("Boolean"));
  assertEquals(glyphForConnectionCheck("String"), zipehrEmojiForRmType("String"));
  assertEquals(glyphForConnectionCheck("Number"), zipehrEmojiForRmType("C_REAL"));
  assertEquals(glyphForConnectionCheck("Array"), "📋");
  assertEquals(glyphForConnectionCheck("Map"), "🗂️");
  assertEquals(glyphForConnectionCheck("Source"), "📂");
  assertEquals(glyphForConnectionCheck(["Array", "Source"], true), ABSTRACT_SLOT_GLYPH);
  const tip = checkConnectionTooltip(["Array", "Source"]);
  assertEquals(tip.includes("Array"), true);
  assertEquals(tip.includes("Source"), true);
});

Deno.test("logic_list_restriction shows output and slot type-fit glyphs", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock(LOGIC_LIST_RESTRICTION_BLOCK);
  assert(block.getField(BLOCK_OUT_EMOJI_FIELD), "expected Boolean output glyph");
  assert(block.getField(slotEmojiFieldName("LIST")), "expected LIST slot glyph");
  assert(block.getField(slotEmojiFieldName("PRED")), "expected PRED slot glyph");
  workspace.dispose();
});

Deno.test("lists_create_with uses a header mutator cog instead of the stock icon", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const list = workspace.newBlock("lists_create_with") as Blockly.Block & {
    itemCount_?: number;
    updateShape_?: () => void;
  };
  assert(list.getField("MUTATOR_COG"), "expected header MUTATOR_COG");
  assert(list.getField(BLOCK_OUT_EMOJI_FIELD), "expected Array output glyph");
  list.itemCount_ = 0;
  list.updateShape_?.();
  assert(list.getField("MUTATOR_COG"), "cog must survive updateShape_");
  workspace.dispose();
});
