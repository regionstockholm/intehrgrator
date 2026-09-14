/**
 * After scaffolding, Conversion start + instance root sit close under the
 * Defaults block — not a full-root-height gap above it (issue #90).
 */
import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { generateSkeleton } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { loadSkeletonIntoWorkspace } from "@intehrgrator/blockly/skeleton_loader.ts";
import { findDefaultsBlock } from "@intehrgrator/blockly/defaults_canvas.ts";
import { findConversionStartBlock } from "@intehrgrator/blockly/instance_root.ts";
import { registerRmBlocks } from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { registerMapBlocks } from "@intehrgrator/blockly/blocks/map_blocks.ts";

const opt = await Deno.readTextFile(
  join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
);

function xy(block: Blockly.Block): { x: number; y: number } {
  return typeof block.getRelativeToSurfaceXY === "function"
    ? block.getRelativeToSurfaceXY()
    : { x: 0, y: 0 };
}

function heightOf(block: Blockly.Block): number {
  if (typeof (block as { getHeightWidth?: () => { height: number } }).getHeightWidth === "function") {
    return (block as { getHeightWidth: () => { height: number } }).getHeightWidth().height;
  }
  return 0;
}

Deno.test("scaffolded composition lands close under the Defaults block", () => {
  registerRmBlocks();
  registerMapBlocks();
  const workspace = new Blockly.Workspace();
  const { skeleton } = generateSkeleton(opt);
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null, "en");

  const defaults = findDefaultsBlock(workspace);
  const start = findConversionStartBlock(workspace);
  assert(defaults, "defaults");
  assert(start, "conversion start");

  const defaultsPos = xy(defaults);
  const startPos = xy(start);
  const defaultsH = heightOf(defaults);

  // Start must not sit a scaffold-height above Defaults (the old -rootH bug).
  assertEquals(startPos.y + 8 >= defaultsPos.y, true, `start.y=${startPos.y} defaults.y=${defaultsPos.y}`);
  if (defaultsH > 0) {
    const gap = startPos.y - (defaultsPos.y + defaultsH);
    assert(
      gap >= -8 && gap <= 80,
      `expected start just under defaults, gap=${gap} (defaultsH=${defaultsH})`,
    );
  } else {
    // Headless Workspace often reports 0 height; still require start not above defaults.
    assertEquals(startPos.y >= defaultsPos.y, true);
  }

  const root = start.getNextBlock();
  assert(root, "instance root under start");
  assertEquals(root.getParent()?.id, start.id);
  const topTypes = workspace.getTopBlocks(false).map((b) => b.type);
  assertEquals(topTypes.includes("conversion_start"), true);
  assertEquals(topTypes.includes(root.type), false, "root is stacked under start, not a separate top block");
  workspace.dispose();
});
