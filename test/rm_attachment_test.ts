/** Catalog seam for optional RM attachments (not duplicated in Blockly RM tests). */
import { assertEquals } from "@std/assert";
import { getValidAttachments } from "@intehrgrator/core/rm_attachment_catalog.ts";
import { termSetForRmAttribute } from "@intehrgrator/core/openehr_term_catalog.ts";

Deno.test("composition optional attachments exclude present attrs", () => {
  const opts = getValidAttachments("COMPOSITION", {
    presentAttributes: new Set(["context"]),
    templateConstrained: new Set(),
  });
  assertEquals(opts.some((o) => o.attributeName === "context"), false);
  assertEquals(opts.some((o) => o.attributeName === "feeder_audit"), true);
});

Deno.test("ELEMENT offers null_flavour and null_reason, not the value mouth", () => {
  const opts = getValidAttachments("ELEMENT", {
    presentAttributes: new Set(["name", "value"]),
    templateConstrained: new Set(["name"]),
  });
  const flavour = opts.find((o) => o.attributeName === "null_flavour");
  const reason = opts.find((o) => o.attributeName === "null_reason");
  assertEquals(flavour?.rmType, "DV_CODED_TEXT");
  assertEquals(reason?.rmType, "DV_TEXT");
  assertEquals(opts.some((o) => o.attributeName === "value"), false);
  assertEquals(opts.some((o) => o.attributeName === "encoding"), false);
  assertEquals(opts.some((o) => o.attributeName === "feeder_audit"), true);
  const set = termSetForRmAttribute("ELEMENT", "null_flavour");
  assertEquals(set?.id, "openehr:null_flavours");
  assertEquals(
    set?.codes.some((item) => item.code === "271" && item.rubric === "no information"),
    true,
  );
});

Deno.test("observation offers feeder_audit and links from RM meta", () => {
  const opts = getValidAttachments("OBSERVATION", {
    presentAttributes: new Set(["data"]),
    templateConstrained: new Set(["data"]),
  });
  assertEquals(opts.some((o) => o.attributeName === "feeder_audit"), true);
  assertEquals(opts.some((o) => o.attributeName === "links"), true);
  assertEquals(opts.some((o) => o.attributeName === "data"), false);
});
