import { assertEquals } from "@std/assert";
import { blocklyJsonDocument } from "@intehrgrator/workbench/mapping_spec/project.ts";
import {
  specOverviewTickTopPx,
  specWarningMarkers,
} from "@intehrgrator/workbench/mapping_spec/overview.ts";

Deno.test("spec overview tick uses document pixel ratio not character offset", () => {
  assertEquals(specOverviewTickTopPx(0, 18, 1800, 180, 6), 0);
  assertEquals(specOverviewTickTopPx(891, 18, 1800, 180, 6), 87);
  assertEquals(specOverviewTickTopPx(1794, 18, 1800, 180, 6), 174);
});

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
  const markers = specWarningMarkers(doc, { warn: "Unmapped mandatory value" });
  assertEquals(markers.length, 1);
  assertEquals(markers[0]?.blockId, "warn");
  assertEquals(markers[0]?.message, "Unmapped mandatory value");
  const warnWidget = doc.widgets.find((item) => item.line.blockId === "warn");
  assertEquals(markers[0]?.from, warnWidget?.from);
});
