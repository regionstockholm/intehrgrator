import { assertEquals, assert } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { registerMapBlocks } from "@intehrgrator/blockly/blocks/map_blocks.ts";
import { MAPS_CREATE_WITH, MAPS_GET, DEFAULTS_CTX_MAP } from "@intehrgrator/core/defaults/extract.ts";

Deno.test("map blocks register create/get/keys/length/isEmpty and Defaults", () => {
  registerMapBlocks();
  assert(Blockly.Blocks[MAPS_CREATE_WITH]);
  assert(Blockly.Blocks[MAPS_GET]);
  assert(Blockly.Blocks["maps_keys"]);
  assert(Blockly.Blocks["maps_length"]);
  assert(Blockly.Blocks["maps_isEmpty"]);
  assert(Blockly.Blocks["maps_create_empty"]);
  assert(Blockly.Blocks[DEFAULTS_CTX_MAP]);
  assert(Blockly.Blocks["defaults_block"]);

  const workspace = new Blockly.Workspace();
  const map = workspace.newBlock(MAPS_CREATE_WITH) as Blockly.Block & {
    itemCount_: number;
    updateShape_: () => void;
  };
  map.itemCount_ = 3;
  map.updateShape_();
  assert(map.getInput("KEY0"));
  assert(map.getInput("VAL2"));
  const lookup = workspace.newBlock(MAPS_GET);
  lookup.setFieldValue("defaults", "NAME");
  assertEquals(lookup.getFieldValue("NAME"), "defaults");
  workspace.dispose();
});
