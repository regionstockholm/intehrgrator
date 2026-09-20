import { assertEquals, assert } from "@std/assert";
import { join } from "@std/path";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  connectExpressionToDataValueShell,
  registerRmBlocks,
  rmAttributeInputName,
} from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { createMapsGetBlock, registerMapBlocks } from "@intehrgrator/blockly/blocks/map_blocks.ts";
import {
  ensureDefaultsBlock,
  findDefaultsBlock,
  hydrateDefaultsMapArgument,
} from "@intehrgrator/blockly/defaults_canvas.ts";
import { relabelWorkspaceFromSkeleton } from "@intehrgrator/blockly/block_labels.ts";
import { loadSkeletonIntoWorkspace } from "@intehrgrator/blockly/skeleton_loader.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { generateSkeleton } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import {
  hardcodeDefaultsMapKey,
  listDefaultsMapEntries,
} from "@intehrgrator/blockly/hardcode_defaults.ts";
import { namedMapsFromBlocklyState } from "@intehrgrator/core/defaults/mod.ts";

const opt = await Deno.readTextFile(
  join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
);

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

Deno.test("hardcode of a term_pick Defaults Map key inlines into a CODE_PHRASE mouth", () => {
  registerRmBlocks();
  registerMapBlocks();
  const workspace = new Blockly.Workspace();
  ensureDefaultsBlock(workspace, "sv");
  const composition = workspace.newBlock("composition");
  const languageInput = composition.getInput("ATTR_language");
  assert(languageInput?.connection, "COMPOSITION.language mouth");
  const existing = languageInput.connection.targetBlock();
  existing?.dispose(false);
  const lookup = createMapsGetBlock(workspace, "defaults", "language");
  assert(lookup.outputConnection);
  languageInput.connection.connect(lookup.outputConnection);

  assertEquals(hardcodeDefaultsMapKey(workspace, "language"), 1);
  const inlined = composition.getInput("ATTR_language")?.connection?.targetBlock();
  assertEquals(inlined?.type, "term_pick");
  assertEquals(inlined?.getFieldValue("SET"), "ISO_639-1");
  assertEquals(inlined?.getFieldValue("CODE"), "sv");
  workspace.dispose();
});

Deno.test("hardcode after scaffold relabel still inlines maps_get(defaults, territory)", () => {
  registerRmBlocks();
  registerMapBlocks();
  const workspace = new Blockly.Workspace();
  ensureDefaultsBlock(workspace, "sv");
  const { skeleton } = generateSkeleton(opt);
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null, "sv");
  relabelWorkspaceFromSkeleton(workspace, skeleton);
  const composition = workspace.getAllBlocks(false).find((block) => block.type === "composition");
  assert(composition);
  const before = composition.getInputTargetBlock(rmAttributeInputName("territory"));
  assertEquals(before?.type, "maps_get");
  assertEquals(before?.getFieldValue("NAME"), "defaults");
  assertEquals(hardcodeDefaultsMapKey(workspace, "territory"), 1);
  const inlined = composition.getInputTargetBlock(rmAttributeInputName("territory"));
  assertEquals(inlined?.type, "term_pick");
  assertEquals(inlined?.getFieldValue("CODE"), "SE");
  assertEquals(inlined?.isShadow(), false);
  workspace.dispose();
});

Deno.test("hardcode replaces a shadow Defaults Map value with a real block", () => {
  registerRmBlocks();
  registerMapBlocks();
  const workspace = new Blockly.Workspace();
  ensureDefaultsBlock(workspace, "sv");
  hydrateDefaultsMapArgument(workspace, {
    type: "maps_create_with",
    extraState: { itemCount: 1 },
    fields: { KEY0: "*.time" },
    inputs: {
      VAL0: { shadow: { type: "text", fields: { TEXT: "2026-01-01T00:00:00Z" } } },
    },
  }, "sv");
  const shell = workspace.newBlock("dv_date_time");
  const lookup = createMapsGetBlock(workspace, "defaults", "time");
  connectExpressionToDataValueShell(shell, lookup);
  assertEquals(hardcodeDefaultsMapKey(workspace, "time"), 1);
  const connected = shell.getInput("FLD_value")?.connection?.targetBlock() ??
    shell.getInputTargetBlock("FLD_value");
  assert(connected);
  assertEquals(connected.type, "text");
  assertEquals(connected.getFieldValue("TEXT"), "2026-01-01T00:00:00Z");
  assertEquals(connected.isShadow(), false);
  workspace.dispose();
});

