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
    accept: {
      "application/xml": [".opt"],
      "application/json": [".json"],
    },
  }]);
  assertEquals(acceptToVscodeFilters(".opt,.json"), {
    "Supported files": ["opt", "json"],
  });
});

Deno.test("acceptToPickerTypes never uses application/octet-stream", () => {
  const types = acceptToPickerTypes(".json,.xml,.zip,.intehrgrator,.blockly.json");
  const accept = types?.[0]?.accept ?? {};
  assertEquals("application/octet-stream" in accept, false);
  assertEquals(accept["application/json"], [".json"]);
  assertEquals(accept["application/xml"], [".xml"]);
  assertEquals(accept["application/zip"], [".zip", ".intehrgrator"]);
  const extensions = Object.values(accept).flat();
  assertEquals(extensions.includes(".exe"), false);
  assertEquals(extensions.includes(".com"), false);
  assertEquals(extensions.includes(".bin"), false);
});
