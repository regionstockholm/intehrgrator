import { assertEquals } from "@std/assert";
import { glyphForBlocklyCheck } from "@intehrgrator/blockly/block_type_glyph.ts";
import { ABSTRACT_SLOT_GLYPH } from "@intehrgrator/blockly/rm_type_emoji.ts";

Deno.test("glyphForBlocklyCheck maps Blockly primitives", () => {
  assertEquals(typeof glyphForBlocklyCheck("String"), "string");
  assertEquals(typeof glyphForBlocklyCheck("Number"), "string");
  assertEquals(glyphForBlocklyCheck("Boolean"), "✓");
  assertEquals(glyphForBlocklyCheck("Array"), "📋");
  assertEquals(glyphForBlocklyCheck("Map"), "↦");
});

Deno.test("glyphForBlocklyCheck uses abstract glyph for unions", () => {
  assertEquals(glyphForBlocklyCheck(["String", "Number", "Boolean"]), ABSTRACT_SLOT_GLYPH);
});
