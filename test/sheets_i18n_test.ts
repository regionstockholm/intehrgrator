import { assertEquals } from "@std/assert";
import { jspreadsheetDictionary } from "@intehrgrator/ui/sheets_i18n.ts";

Deno.test("jspreadsheet dictionary covers app locales with Search/Cut/Copy/Paste", () => {
  for (const loc of ["sv", "de", "es", "ca", "fr"] as const) {
    const d = jspreadsheetDictionary(loc);
    assertEquals(typeof d.Search, "string");
    assertEquals(typeof d.Cut, "string");
    assertEquals(typeof d.Copy, "string");
    assertEquals(typeof d.Paste, "string");
    assertEquals(d.Search.length > 0, true);
  }
  assertEquals(jspreadsheetDictionary("en"), {});
});
