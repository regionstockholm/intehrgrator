import { assertEquals, assert } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  connectExpressionToDataValueShell,
  registerRmBlocks,
} from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { createMapsGetBlock, registerMapBlocks } from "@intehrgrator/blockly/blocks/map_blocks.ts";
import {
  ensureDefaultsBlock,
  findDefaultsBlock,
} from "@intehrgrator/blockly/defaults_canvas.ts";
import {
  hardcodeDefaultsMapKey,
  listDefaultsMapEntries,
} from "@intehrgrator/blockly/hardcode_defaults.ts";
import { namedMapsFromBlocklyState } from "@intehrgrator/core/defaults/mod.ts";

Deno.test("hardcodeDefaultsMapKey inlines maps_get lookups from the Defaults Map value", () => {
  registerRmBlocks();
  registerMapBlocks();
  const workspace = new Blockly.Workspace();
  ensureDefaultsBlock(workspace, "sv");
  assert(findDefaultsBlock(workspace));
  assert(listDefaultsMapEntries(workspace).some((entry) => entry.key === "territory"));

  const shell = workspace.newBlock("code_phrase");
  const lookup = createMapsGetBlock(workspace, "defaults", "territory");
  connectExpressionToDataValueShell(shell, lookup);

  assertEquals(hardcodeDefaultsMapKey(workspace, "territory"), 1);
  assertEquals(
    workspace.getAllBlocks(false).filter((block) =>
      block.type === "maps_get" &&
      block.getInputTargetBlock("KEY")?.getFieldValue("TEXT") === "territory"
    ).length,
    0,
  );
  const maps = namedMapsFromBlocklyState(Blockly.serialization.workspaces.save(workspace));
  assertEquals(maps.defaults?.territory, "SE");
  const connected = shell.getInput("FLD_code_string")?.connection?.targetBlock();
  assert(connected);
  // term_pick cannot plug into String mouths — hardcode falls back to text "SE".
  assertEquals(connected.type, "text");
  assertEquals(connected.getFieldValue("TEXT"), "SE");
  workspace.dispose();
});
