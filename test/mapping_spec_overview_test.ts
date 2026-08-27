import { assertEquals } from "@std/assert";
import {
  blocklyJsonDocument,
  specWarningMarkers,
} from "@intehrgrator/workbench/mapping_spec/mod.ts";

Deno.test("spec warning markers sit at widget positions for constraint warnings", () => {
  const state = {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: "element",
          id: "ok",
          fields: { NAME: "ok" },
        },
        {
          type: "element",
          id: "warn",
          fields: { NAME: "warn" },
        },
      ],
    },
  };
  const doc = blocklyJsonDocument(state);
  const markers = specWarningMarkers(doc, { warn: "Unmapped mandatory value" }, doc.text.length);
  assertEquals(markers.length, 1);
  assertEquals(markers[0]?.blockId, "warn");
  assertEquals(markers[0]?.message, "Unmapped mandatory value");
  const warnWidget = doc.widgets.find((item) => item.line.blockId === "warn");
  assertEquals(markers[0]?.from, warnWidget?.from);
});
