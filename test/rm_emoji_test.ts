import { assertEquals } from "@std/assert";
import { zipehrEmojiForRmType } from "@intehrgrator/core/rm_emoji.ts";

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
