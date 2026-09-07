/**
 * Slot captions on tall value/statement rows must sit by the mouth, not at
 * the vertical midpoint of a connected child (Thrasos default for value rows).
 */
import { assertEquals } from "@std/assert";
import { FieldSlotLabel } from "@intehrgrator/blockly/slot_label.ts";
import {
  pinnedSlotCaptionCenterline_,
  shouldPinSlotCaptionToMouth_,
} from "@intehrgrator/blockly/compact_renderer.ts";

Deno.test("slot captions pin on tall value and statement rows", () => {
  const caption = { field: new FieldSlotLabel("items") };
  assertEquals(
    shouldPinSlotCaptionToMouth_({ hasInlineInput: true, hasStatement: false }, caption),
    true,
  );
  assertEquals(
    shouldPinSlotCaptionToMouth_({ hasExternalInput: true }, caption),
    true,
  );
  assertEquals(
    shouldPinSlotCaptionToMouth_({ hasStatement: true }, caption),
    true,
  );
  assertEquals(
    shouldPinSlotCaptionToMouth_({ hasInlineInput: false, hasExternalInput: false }, caption),
    false,
  );
  assertEquals(
    shouldPinSlotCaptionToMouth_({ hasInlineInput: true }, { field: null }),
    false,
  );
});

Deno.test("pinned caption centerline hugs mouth, not mid-child height", () => {
  const constants = {
    EMPTY_STATEMENT_INPUT_HEIGHT: 24,
    TALL_INPUT_FIELD_OFFSET_Y: 3,
    MEDIUM_PADDING: 3,
    MIN_BLOCK_HEIGHT: 24,
  };
  const tallRow = { yPos: 100, height: 4800, hasInlineInput: true, hasStatement: false };
  const elem = { height: 14, field: new FieldSlotLabel("Casenote") };

  const y = pinnedSlotCaptionCenterline_(tallRow, elem, constants);
  // Top of row + offset + half field — far above mid-child (100 + 2400).
  assertEquals(y, 100 + 3 + 7);
  assertEquals(y < 100 + tallRow.height / 4, true);

  const stmtY = pinnedSlotCaptionCenterline_(
    { yPos: 50, height: 5000, hasStatement: true },
    elem,
    constants,
  );
  assertEquals(stmtY, 50 + 12);
});
