import { assertEquals } from "@std/assert";
import { yJustBelowDefaults } from "@intehrgrator/blockly/defaults_canvas.ts";
import { startYAboveRoot } from "@intehrgrator/blockly/conversion_start_canvas.ts";
import {
  mappingPaneLeadsOnNarrow,
  NARROW_MAIN_PANES_MAX_WIDTH_PX,
  visualAxisFromFlexDirection,
} from "@intehrgrator/ui/split_pane.ts";

Deno.test("scaffold top sits a small gap under Defaults, not a Defaults-height jump", () => {
  assertEquals(yJustBelowDefaults(160), 20 + 160 + 16);
  assertEquals(yJustBelowDefaults(4000) > 20 + 160, true);
  // Must not subtract the (possibly huge) skeleton height.
  assertEquals(yJustBelowDefaults(4000) < 20 + 4000 + 50, true);
});

Deno.test("Conversion start parks above the root using start height, not root height", () => {
  const rootY = 500;
  const startHeight = 40;
  assertEquals(startYAboveRoot(rootY, startHeight), 500 - 40 - 12);
  // A tall composition must not shove start thousands of pixels upward.
  assertEquals(startYAboveRoot(rootY, startHeight) > 0, true);
});

Deno.test("stacked CSS column wins over a declared row split", () => {
  assertEquals(visualAxisFromFlexDirection("column", "row"), "column");
  assertEquals(visualAxisFromFlexDirection("row", "column"), "row");
  assertEquals(visualAxisFromFlexDirection("", "row"), "row");
});

Deno.test("narrow viewports treat Mapping Editors as the lead pane", () => {
  assertEquals(mappingPaneLeadsOnNarrow(NARROW_MAIN_PANES_MAX_WIDTH_PX), true);
  assertEquals(mappingPaneLeadsOnNarrow(375), true);
  assertEquals(mappingPaneLeadsOnNarrow(1280), false);
});
