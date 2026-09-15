/**
 * Compact renderer padding must keep labels off block edges and statement
 * children out of the deep left of parent mouths (issue #66).
 */
import { assertEquals } from "@std/assert";
import {
  applyCompactConstants,
  COMPACT_PADDING,
} from "@intehrgrator/blockly/compact_renderer.ts";

Deno.test("compact padding restores readable edge and statement insets", () => {
  const constants: Record<string, number> = {
    TAB_HEIGHT: 15,
    SMALL_PADDING: 0,
    MEDIUM_PADDING: 0,
    LARGE_PADDING: 0,
    STATEMENT_INPUT_PADDING_LEFT: 1,
    STATEMENT_BOTTOM_SPACER: 0,
  };
  applyCompactConstants(constants);
  assertEquals(constants.SMALL_PADDING, COMPACT_PADDING.SMALL);
  assertEquals(constants.MEDIUM_PADDING, COMPACT_PADDING.MEDIUM);
  assertEquals(constants.LARGE_PADDING, COMPACT_PADDING.LARGE);
  assertEquals(constants.STATEMENT_INPUT_PADDING_LEFT, COMPACT_PADDING.STATEMENT_INPUT_LEFT);
  assertEquals(constants.STATEMENT_BOTTOM_SPACER, COMPACT_PADDING.STATEMENT_BOTTOM);
  // Blockly default statement inset is 20; we stay compact but not flush (was 1).
  assertEquals(COMPACT_PADDING.STATEMENT_INPUT_LEFT >= 12, true);
  assertEquals(COMPACT_PADDING.STATEMENT_INPUT_LEFT < 20, true);
});
