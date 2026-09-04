/**
 * Abstract ⁇ tip must win over attribute help when both apply on a slot caption.
 * (Help viewer previously swallowed ⁇ clicks via showEditor_.)
 */
import { assert, assertEquals } from "@std/assert";
import {
  ABSTRACT_SLOT_GLYPH,
  connectionPointGlyph,
  rmTypeConnectionTooltip,
} from "@intehrgrator/blockly/rm_type_emoji.ts";
import { slotLabelOverlayForEditor } from "@intehrgrator/blockly/slot_label.ts";
import { rmAttributeHelp } from "@intehrgrator/core/spec_help.ts";

Deno.test("COMPOSITION.content has RM attribute help (precondition)", () => {
  const help = rmAttributeHelp("COMPOSITION", "content");
  assert(help, "expected ehrtslib spec docs for COMPOSITION.content");
  assert(help.body.length > 0);
});

Deno.test("CONTENT_ITEM slot still uses ⁇ and lists concrete subtypes", () => {
  assertEquals(connectionPointGlyph("CONTENT_ITEM", true), ABSTRACT_SLOT_GLYPH);
  const tip = rmTypeConnectionTooltip("CONTENT_ITEM");
  assert(tip.includes("CONTENT_ITEM (abstract)"));
  assert(tip.includes("Allowed:"));
  assert(tip.includes("OBSERVATION") || tip.includes("SECTION"));
});

Deno.test("slotLabelOverlayForEditor prefers abstract ⁇ tip over attribute help", () => {
  assertEquals(
    slotLabelOverlayForEditor({ isAbstractSlot: true, hasAttrHelp: true }),
    "abstract-tip",
  );
  assertEquals(
    slotLabelOverlayForEditor({ isAbstractSlot: true, hasAttrHelp: false }),
    "abstract-tip",
  );
  assertEquals(
    slotLabelOverlayForEditor({ isAbstractSlot: false, hasAttrHelp: true }),
    "help",
  );
  assertEquals(
    slotLabelOverlayForEditor({ isAbstractSlot: false, hasAttrHelp: false }),
    null,
  );
});
