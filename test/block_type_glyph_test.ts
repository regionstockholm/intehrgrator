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
  assertEquals(glyphForBlocklyCheck(["Array", "Source"]), ABSTRACT_SLOT_GLYPH);
});

Deno.test("measureGlyphWidth reserves room for connection glyphs", () => {
  assertEquals(measureGlyphWidth("", 18), 0);
  assert(measureGlyphWidth("📋", 18) >= 18);
  assert(measureGlyphWidth("✓", 18) >= 18);
});

Deno.test("stock lists_length puts the output glyph on a LEFT HEADER, not the VALUE mouth", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock("lists_length");
  const header = block.getInput("HEADER");
  assert(header, "HEADER chrome");
  assertEquals(header.align, Blockly.inputs.Align.LEFT);
  assert(block.getField(BLOCK_OUT_EMOJI_FIELD), "output glyph");
  assertEquals(
    header.fieldRow.some((f) => f.name === BLOCK_OUT_EMOJI_FIELD),
    true,
  );
  assertEquals(
    block.getInput("VALUE")?.fieldRow.some((f) => f.name === BLOCK_OUT_EMOJI_FIELD) ?? false,
    false,
  );
  workspace.dispose();
});

Deno.test("logic list blocks keep class chrome on HEADER, mouths hug sockets", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const restriction = workspace.newBlock(LOGIC_LIST_RESTRICTION_BLOCK);
  assert(restriction.getInput("HEADER"), "restriction HEADER");
  assertEquals(restriction.getInput("HEADER")?.align, Blockly.inputs.Align.LEFT);
  assertEquals(restriction.getInput("LIST")?.name, "LIST");
  assertEquals(
    restriction.getInput("HEADER")?.fieldRow.some((f) => f.name === BLOCK_OUT_EMOJI_FIELD),
    true,
  );
  assertEquals(
    restriction.getInput("LIST")?.fieldRow.some((f) => f.name === BLOCK_OUT_EMOJI_FIELD) ?? false,
    false,
  );

  const setOp = workspace.newBlock(LISTS_SET_OPERATION_BLOCK);
  assert(setOp.getInput("HEADER"), "set-op HEADER");
  assertEquals(setOp.getInput("A")?.name, "A");
  assertEquals(
    setOp.getInput("HEADER")?.fieldRow.some((f) => f.name === BLOCK_OUT_EMOJI_FIELD),
    true,
  );
  workspace.dispose();
});
