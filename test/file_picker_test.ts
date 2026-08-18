import { assertEquals } from "@std/assert";
import {
  acceptToExtensions,
  acceptToPickerTypes,
  acceptToVscodeFilters,
  filePickerId,
} from "@intehrgrator/host/file_picker.ts";

Deno.test("filePickerId is distinct per load button", () => {
  assertEquals(filePickerId("schema"), "intehrgrator-schema");
  assertEquals(filePickerId("example"), "intehrgrator-example");
  assertEquals(filePickerId("target"), "intehrgrator-target");
  assertEquals(filePickerId(), undefined);
});

Deno.test("acceptToExtensions keeps dotted suffixes and skips MIME types", () => {
  assertEquals(
    acceptToExtensions(".json,.xml,.xsd,application/json,application/xml"),
    [".json", ".xml", ".xsd"],
  );
});

Deno.test("accept helpers feed Chromium and VS Code pickers", () => {
  assertEquals(acceptToPickerTypes(".opt,.json"), [{
    description: "Supported files",
    accept: { "application/octet-stream": [".opt", ".json"] },
  }]);
  assertEquals(acceptToVscodeFilters(".opt,.json"), {
    "Supported files": ["opt", "json"],
  });
});
