import { assertEquals } from "@std/assert";
import { getValidAttachments } from "@intehrgrator/core/rm_attachment_catalog.ts";

Deno.test("composition optional attachments exclude present attrs", () => {
  const opts = getValidAttachments("COMPOSITION", {
    presentAttributes: new Set(["context"]),
    templateConstrained: new Set(),
  });
  assertEquals(opts.some((o) => o.attributeName === "context"), false);
  assertEquals(opts.some((o) => o.attributeName === "feeder_audit"), true);
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
