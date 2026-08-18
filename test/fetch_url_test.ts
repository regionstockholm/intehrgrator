import { assertEquals, assertThrows } from "@std/assert";
import {
  assertHttpUrl,
  filenameFromUrl,
  toFetchableUrl,
} from "@intehrgrator/host/fetch_url.ts";

Deno.test("toFetchableUrl rewrites GitHub blob pages to raw.githubusercontent.com", () => {
  const href = toFetchableUrl(
    "https://github.com/Ehrlibs/openEHR-model-examples/blob/main/local/templates/composition/foo.opt",
  );
  assertEquals(
    href,
    "https://raw.githubusercontent.com/Ehrlibs/openEHR-model-examples/main/local/templates/composition/foo.opt",
  );
});

Deno.test("toFetchableUrl rewrites GitHub raw links and keeps query-free path", () => {
  const href = toFetchableUrl(
    "https://github.com/Ehrlibs/openEHR-model-examples/raw/main/local/theme-packs/sport-event-details/templates/Accident%20report%20including%20vital%20signs.opt?plain=1",
  );
  assertEquals(
    href,
    "https://raw.githubusercontent.com/Ehrlibs/openEHR-model-examples/main/local/theme-packs/sport-event-details/templates/Accident%20report%20including%20vital%20signs.opt",
  );
});

Deno.test("toFetchableUrl resolves relative URLs against a base href", () => {
  const href = toFetchableUrl("examples/bp.json", "https://app.example/workbench/");
  assertEquals(href, "https://app.example/workbench/examples/bp.json");
});

Deno.test("filenameFromUrl decodes the last path segment", () => {
  assertEquals(
    filenameFromUrl(
      "https://raw.githubusercontent.com/org/repo/main/local/Accident%20report.opt",
    ),
    "Accident report.opt",
  );
});

Deno.test("assertHttpUrl rejects non-http schemes", () => {
  assertThrows(() => assertHttpUrl("file:///tmp/schema.json"), Error, "http(s)");
});
