import { assertEquals, assert } from "@std/assert";
import {
  documentationHelp,
  hasRmClassHelp,
  rmAttributeHelp,
  rmClassHelp,
} from "@intehrgrator/core/spec_help.ts";

Deno.test("rmClassHelp returns COMPOSITION BMM text and spec URLs", () => {
  assertEquals(hasRmClassHelp("COMPOSITION"), true);
  const help = rmClassHelp("COMPOSITION");
  assert(help);
  assertEquals(help.title, "COMPOSITION");
  assert(help.body.toLowerCase().includes("composition"));
  assert(help.links.some((l) => l.href.includes("specifications.openehr.org")));
  assert(help.links.some((l) => l.label.includes("HTML")));
});

Deno.test("rmAttributeHelp returns COMPOSITION.content documentation", () => {
  const help = rmAttributeHelp("COMPOSITION", "content");
  assert(help);
  assertEquals(help.title, "COMPOSITION.content");
  assert(help.body.toLowerCase().includes("content"));
});

Deno.test("rmClassHelp / rmAttributeHelp return null for unknown names", () => {
  assertEquals(rmClassHelp("NOT_A_REAL_RM_TYPE_ZZZ"), null);
  assertEquals(rmAttributeHelp("COMPOSITION", "not_a_real_attr_zzz"), null);
  assertEquals(hasRmClassHelp(""), false);
});

Deno.test("documentationHelp wraps free-text schema docs", () => {
  const help = documentationHelp("patient", "  The patient record.  ");
  assert(help);
  assertEquals(help.title, "patient");
  assertEquals(help.body, "The patient record.");
  assertEquals(documentationHelp("x", "   "), null);
});
