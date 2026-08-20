import { assertEquals } from "@std/assert";
import { zipehrEmojiForRmType } from "@intehrgrator/core/rm_emoji.ts";
import {
  ABSTRACT_SLOT_GLYPH,
  connectionPointGlyph,
  isHardToReadRmEmoji,
  rmEmojiFontPx,
  RM_EMOJI_FONT_PX,
  RM_EMOJI_LARGE_FONT_PX,
  rmTypeConnectionTooltip,
} from "@intehrgrator/blockly/rm_type_emoji.ts";

Deno.test("ZipEHR emojis match ehrtslib symbol table for common DV_* types", () => {
  assertEquals(zipehrEmojiForRmType("DV_DATE_TIME"), "📅⌚");
  assertEquals(zipehrEmojiForRmType("DV_TEXT"), "🗉");
  assertEquals(zipehrEmojiForRmType("DV_CODED_TEXT"), "🗈");
  assertEquals(zipehrEmojiForRmType("DV_QUANTITY"), "🌡️");
  assertEquals(zipehrEmojiForRmType("DV_COUNT"), "🔢");
  assertEquals(zipehrEmojiForRmType("DV_BOOLEAN"), "🗹");
  assertEquals(zipehrEmojiForRmType("CLUSTER"), "📁");
  assertEquals(zipehrEmojiForRmType("ELEMENT"), "🔹");
  assertEquals(zipehrEmojiForRmType("unknown_type"), undefined);
});

Deno.test("abstract RM types without ZipEHR glyphs use an encircled question mark", () => {
  assertEquals(ABSTRACT_SLOT_GLYPH, "?\u20DD");
  assertEquals(connectionPointGlyph("CONTENT_ITEM"), ABSTRACT_SLOT_GLYPH);
  assertEquals(connectionPointGlyph("ITEM"), ABSTRACT_SLOT_GLYPH);
  assertEquals(connectionPointGlyph("ITEM_STRUCTURE"), ABSTRACT_SLOT_GLYPH);
  assertEquals(connectionPointGlyph("DATA_VALUE"), ABSTRACT_SLOT_GLYPH);
  assertEquals(connectionPointGlyph("DV_QUANTITY"), zipehrEmojiForRmType("DV_QUANTITY"));
  assertEquals(connectionPointGlyph("unknown_type"), undefined);
});

Deno.test("connection tooltips name the RM class and list abstract subclasses", () => {
  assertEquals(rmTypeConnectionTooltip("DV_QUANTITY"), "DV_QUANTITY");
  const content = rmTypeConnectionTooltip("CONTENT_ITEM");
  assertEquals(content.startsWith("CONTENT_ITEM (abstract)"), true);
  assertEquals(content.includes(`${zipehrEmojiForRmType("OBSERVATION")} OBSERVATION`), true);
  assertEquals(content.includes(`${zipehrEmojiForRmType("SECTION")} SECTION`), true);
  const item = rmTypeConnectionTooltip("ITEM");
  assertEquals(item.includes(`${zipehrEmojiForRmType("ELEMENT")} ELEMENT`), true);
  assertEquals(item.includes(`${zipehrEmojiForRmType("CLUSTER")} CLUSTER`), true);
});

Deno.test("DV_TEXT family glyphs are twice body size; other ZipEHR glyphs are 1.5×", () => {
  assertEquals(isHardToReadRmEmoji("DV_TEXT"), true);
  assertEquals(isHardToReadRmEmoji("DV_CODED_TEXT"), true);
  assertEquals(isHardToReadRmEmoji("DV_PARAGRAPH"), true);
  assertEquals(rmEmojiFontPx("DV_TEXT"), RM_EMOJI_LARGE_FONT_PX);
  assertEquals(rmEmojiFontPx("DV_QUANTITY"), RM_EMOJI_FONT_PX);
  assertEquals(RM_EMOJI_FONT_PX, 18);
  assertEquals(RM_EMOJI_LARGE_FONT_PX, 24);
});
