import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { registerRmBlocks } from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { registerMapBlocks } from "@intehrgrator/blockly/blocks/map_blocks.ts";
import { registerTargetBlocks } from "@intehrgrator/blockly/blocks/target_blocks.ts";
import { copyWorkspaceState } from "@intehrgrator/blockly/blockly_events.ts";
import {
  ensureDefaultsBlock,
  findDefaultsBlock,
} from "@intehrgrator/blockly/defaults_canvas.ts";
import { loadSkeletonIntoWorkspace } from "@intehrgrator/blockly/skeleton_loader.ts";
import { generateSkeleton } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { getTargetFormatHandler } from "@intehrgrator/core/target/mod.ts";
import "blockly/blocks";

const opt = await Deno.readTextFile(
  join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
);

function blockTypes(workspace: Blockly.Workspace): string[] {
  return workspace.getAllBlocks(false).map((block) => block.type).sort();
}

Deno.test("copyWorkspaceState mirrors blocks created while events were disabled", () => {
  const primary = new Blockly.Workspace();
  const mini = new Blockly.Workspace();
  Blockly.Events.disable();
  try {
    const block = primary.newBlock("math_number");
    block.setFieldValue("42", "NUM");
  } finally {
    Blockly.Events.enable();
  }
  assertEquals(mini.getAllBlocks(false).length, 0);
  copyWorkspaceState(primary, mini);
  assertEquals(mini.getAllBlocks(false).length, 1);
  assertEquals(mini.getAllBlocks(false)[0]?.type, "math_number");
  assertEquals(String(mini.getAllBlocks(false)[0]?.getFieldValue("NUM")), "42");
  primary.dispose();
  mini.dispose();
});

Deno.test("copyWorkspaceState picks up Defaults Map and template skeleton blocks", () => {
  registerRmBlocks();
  registerMapBlocks();
  const primary = new Blockly.Workspace();
  const mini = new Blockly.Workspace();
  ensureDefaultsBlock(primary, "sv");
  const { skeleton } = generateSkeleton(opt);
  loadSkeletonIntoWorkspace(primary, skeleton, createEmptyModel("t"), null, "sv");
  assert(findDefaultsBlock(primary), "primary should have a Defaults block");
  assert(
    primary.getAllBlocks(false).some((block) => block.type === "composition"),
    "primary should have a scaffolded composition",
  );

  copyWorkspaceState(primary, mini);
  assertEquals(blockTypes(mini), blockTypes(primary));
  assert(findDefaultsBlock(mini), "minimap copy should include the Defaults block");
  assert(
    mini.getAllBlocks(false).some((block) => block.type === "composition"),
    "minimap copy should include the scaffolded composition",
  );
  primary.dispose();
  mini.dispose();
});

Deno.test("copyWorkspaceState round-trips JSON Schema target_structure children", async () => {
  registerTargetBlocks();
  registerMapBlocks();
  const schema = await Deno.readTextFile(
    join(import.meta.dirname!, "../examples/dummy-json-vitals/target.schema.json"),
  );
  const target = getTargetFormatHandler("json-schema").load("target.schema.json", schema);
  const primary = new Blockly.Workspace();
  const mini = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(primary, target.skeleton, createEmptyModel(target.targetId));
  assert(
    primary.getAllBlocks(false).some((block) =>
      block.type === "target_structure" && Boolean(block.getInput("TARGET_systolic"))
    ),
    "primary skeleton should expose TARGET_systolic",
  );
  copyWorkspaceState(primary, mini);
  assertEquals(blockTypes(mini), blockTypes(primary));
  assert(
    mini.getAllBlocks(false).some((block) =>
      block.type === "target_structure" && Boolean(block.getInput("TARGET_systolic"))
    ),
    "minimap copy should keep TARGET_systolic mouths",
  );
  primary.dispose();
  mini.dispose();
});
