import { assertEquals } from "@std/assert";
import { unionBoxes } from "@intehrgrator/ui/floating.ts";

Deno.test("unionBoxes spans split-button main + chevron", () => {
  const box = unionBoxes([
    { top: 10, left: 100, right: 180, bottom: 36 },
    { top: 10, left: 180, right: 204, bottom: 36 },
  ]);
  assertEquals(box.left, 100);
  assertEquals(box.right, 204);
  assertEquals(box.width, 104);
  assertEquals(box.height, 26);
});

Deno.test("unionBoxes uses the outermost edges", () => {
  const box = unionBoxes([
    { top: 80, left: 20, right: 40, bottom: 100 },
    { top: 10, left: 30, right: 90, bottom: 50 },
  ]);
  assertEquals(box.top, 10);
  assertEquals(box.left, 20);
  assertEquals(box.right, 90);
  assertEquals(box.bottom, 100);
});
