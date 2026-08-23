import { assertEquals } from "@std/assert";
import {
  formatSlotCardinality,
  isCardinalityMet,
  parseSlotCardinality,
} from "@intehrgrator/blockly/slot_cardinality.ts";

Deno.test("formatSlotCardinality always uses [min..max] including [1..1]", () => {
  assertEquals(formatSlotCardinality({ min: 1, max: 1 }), "[1..1]");
  assertEquals(formatSlotCardinality({ min: 0, max: 1 }), "[0..1]");
  assertEquals(formatSlotCardinality({ min: 0, max: null }), "[0..*]");
  assertEquals(formatSlotCardinality({ min: 1, max: null }), "[1..*]");
  assertEquals(formatSlotCardinality({ min: 1, max: 3 }), "[1..3]");
});

Deno.test("parseSlotCardinality accepts compact and bracket forms", () => {
  assertEquals(parseSlotCardinality("1"), { min: 1, max: 1 });
  assertEquals(parseSlotCardinality("[1..1]"), { min: 1, max: 1 });
  assertEquals(parseSlotCardinality("0..*"), { min: 0, max: null });
  assertEquals(parseSlotCardinality("[1..*]"), { min: 1, max: null });
});

Deno.test("isCardinalityMet enforces min and optional max", () => {
  assertEquals(isCardinalityMet(0, { min: 0, max: null }), true);
  assertEquals(isCardinalityMet(0, { min: 1, max: null }), false);
  assertEquals(isCardinalityMet(1, { min: 1, max: 1 }), true);
  assertEquals(isCardinalityMet(2, { min: 1, max: 1 }), false);
});
