import { assertEquals } from "@std/assert";
import { clampSplitSizes } from "../src/ui/split_pane.ts";

Deno.test("clampSplitSizes keeps the preferred pane at least half when space allows", () => {
  const sizes = clampSplitSizes([1, 1, 1], 80, 900, { index: 1, minFrac: 0.5 });
  assertEquals(sizes.length, 3);
  const sum = sizes.reduce((a, b) => a + b, 0);
  assertEquals(Math.abs(sum - 1) < 1e-9, true);
  assertEquals(sizes[1]! >= 0.5 - 1e-9, true);
});

Deno.test("clampSplitSizes still honors per-pane mins on a tight container", () => {
  const sizes = clampSplitSizes([1, 2.6, 1], 80, 300, { index: 1, minFrac: 0.5 });
  const sum = sizes.reduce((a, b) => a + b, 0);
  assertEquals(Math.abs(sum - 1) < 1e-9, true);
  assertEquals(sizes[1]! >= sizes[0]!, true);
  assertEquals(sizes[1]! >= sizes[2]!, true);
});

Deno.test("clampSplitSizes preserves a 1 / 2.6 / 1 mapping-heavy default", () => {
  const sizes = clampSplitSizes([1, 2.6, 1], 80, 1400);
  assertEquals(sizes[1]! > sizes[0]!, true);
  assertEquals(sizes[1]! > sizes[2]!, true);
});
