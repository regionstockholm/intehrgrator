import { assertEquals } from "@std/assert";
import { computeBalloonPosition } from "@intehrgrator/ui/info_tip.ts";

Deno.test("info-tip balloon flips left when preferEnd would overflow", () => {
  const pos = computeBalloonPosition(
    { top: 100, left: 20, right: 36, bottom: 116, width: 16, height: 16 },
    { width: 280, height: 80 },
    { width: 360, height: 400 },
    false,
  );
  assertEquals(pos.left >= 8, true);
  assertEquals(pos.left + 280 <= 360 - 8, true);
});

Deno.test("info-tip balloon flips above when it would clip the pane bottom", () => {
  const pos = computeBalloonPosition(
    { top: 340, left: 200, right: 216, bottom: 356, width: 16, height: 16 },
    { width: 200, height: 90 },
    { width: 400, height: 392 },
    false,
  );
  assertEquals(pos.top < 340, true);
  assertEquals(pos.top + 90 <= 392 - 8, true);
});
