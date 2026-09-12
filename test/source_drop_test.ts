import { assert, assertEquals } from "@std/assert";
import {
  isSourceDropSlotBlock,
  isUsableSourceDropPoint,
} from "@intehrgrator/blockly/source_drop.ts";

Deno.test("source drop slots are value blocks, not composition containers", () => {
  assertEquals(isSourceDropSlotBlock({ type: "element" }), true);
  assertEquals(isSourceDropSlotBlock({ type: "target_value" }), true);
  assertEquals(isSourceDropSlotBlock({ type: "xml_text" }), true);
  assertEquals(isSourceDropSlotBlock({ type: "xml_cdata" }), true);
  assertEquals(isSourceDropSlotBlock({ type: "xml_attribute" }), true);
  assertEquals(isSourceDropSlotBlock({ type: "dv_quantity" }), true);
  assertEquals(isSourceDropSlotBlock({ type: "code_phrase" }), true);
  assertEquals(isSourceDropSlotBlock({ type: "composition" }), false);
  assertEquals(isSourceDropSlotBlock({ type: "observation" }), false);
  assertEquals(isSourceDropSlotBlock({ type: "cluster" }), false);
  assertEquals(isSourceDropSlotBlock({ type: "xml_element" }), false);
  assertEquals(isSourceDropSlotBlock({ type: "xml_document" }), false);
  assertEquals(isSourceDropSlotBlock({ type: "maps_create_with" }), false);
});

Deno.test("source drop ignores the dragend origin (0,0) and points outside the mount", () => {
  const mount = { left: 100, top: 50, right: 500, bottom: 400 };
  assertEquals(isUsableSourceDropPoint(0, 0, mount), false);
  assertEquals(isUsableSourceDropPoint(Number.NaN, 120, mount), false);
  assertEquals(isUsableSourceDropPoint(10, 10, mount), false);
  assertEquals(isUsableSourceDropPoint(200, 200, mount), true);
  assert(isUsableSourceDropPoint(200, 200, null));
});
