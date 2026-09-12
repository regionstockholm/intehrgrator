import { assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { initBlocklyGenerators, findSlotIdAtPoint } from "@intehrgrator/blockly/mod.ts";
import type { WorkspaceSvg } from "blockly/core";

let ready = false;
function ensure(): WorkspaceSvg {
  if (!ready) {
    initBlocklyGenerators();
    ready = true;
  }
  return new Blockly.Workspace() as WorkspaceSvg;
}

Deno.test("findSlotIdAtPoint resolves element VALUE slot from block bounds fallback", () => {
  const workspace = ensure();
  const element = workspace.newBlock("element");
  element.setFieldValue("slot/systolic", "SLOT_ID");
  const svg = element as {
    initSvg?: () => void;
    getSvgRoot?: () => SVGElement;
  };
  svg.initSvg?.();
  const root = svg.getSvgRoot?.();
  if (root && typeof root.getBoundingClientRect === "function") {
    root.getBoundingClientRect = () => ({
      left: 10,
      top: 20,
      right: 110,
      bottom: 70,
      width: 100,
      height: 50,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    });
  }

  const slotId = findSlotIdAtPoint(workspace, 30, 30);
  assertEquals(slotId, "slot/systolic");
  workspace.dispose();
});
