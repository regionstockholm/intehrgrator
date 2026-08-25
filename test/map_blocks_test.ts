import { assert, assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { registerMapBlocks } from "@intehrgrator/blockly/blocks/map_blocks.ts";
import {
  MAPS_CREATE_WITH,
  MAPS_GET,
} from "@intehrgrator/core/defaults/extract.ts";

type MapCreateBlock = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

function inputNames(block: Blockly.Block): string[] {
  return block.inputList.map((input) => input.name);
}

Deno.test("map blocks register create/get/keys/length/isEmpty and Defaults", () => {
  registerMapBlocks();
  assert(Blockly.Blocks[MAPS_CREATE_WITH]);
  assert(Blockly.Blocks[MAPS_GET]);
  assert(Blockly.Blocks["maps_keys"]);
  assert(Blockly.Blocks["maps_length"]);
  assert(Blockly.Blocks["maps_isEmpty"]);
  assert(Blockly.Blocks["maps_create_empty"]);
  assert(Blockly.Blocks["defaults_block"]);

  const workspace = new Blockly.Workspace();
  const map = workspace.newBlock(MAPS_CREATE_WITH) as MapCreateBlock;
  map.itemCount_ = 3;
  map.updateShape_();
  assert(map.getInput("KEY0"));
  assert(map.getInput("VAL2"));
  const lookup = workspace.newBlock(MAPS_GET);
  lookup.setFieldValue("defaults", "NAME");
  assertEquals(lookup.getFieldValue("NAME"), "defaults");
  workspace.dispose();
});

Deno.test("maps_create_with keeps each key:value pair on one row", () => {
  registerMapBlocks();
  const workspace = new Blockly.Workspace();
  const map = workspace.newBlock(MAPS_CREATE_WITH) as MapCreateBlock;
  map.itemCount_ = 2;
  map.updateShape_();
  assertEquals(map.getInputsInline(), true);
  assertEquals(inputNames(map), [
    "HEADER",
    "HEADER_END",
    "KEY0",
    "VAL0",
    "ROW0",
    "KEY1",
    "VAL1",
    "ROW1",
  ]);
  assertEquals(map.getInput("HEADER")?.type, Blockly.inputs.inputTypes.DUMMY);
  assertEquals(
    map.getInput("HEADER_END")?.type,
    Blockly.inputs.inputTypes.END_ROW,
  );
  assertEquals(map.getInput("KEY0")?.type, Blockly.inputs.inputTypes.VALUE);
  assertEquals(map.getInput("VAL0")?.type, Blockly.inputs.inputTypes.VALUE);
  assertEquals(map.getInput("ROW0")?.type, Blockly.inputs.inputTypes.END_ROW);
  assertEquals(map.getInput("VAL0")?.fieldRow[0]?.getText?.() ?? ":", ":");

  map.itemCount_ = 0;
  map.updateShape_();
  assertEquals(inputNames(map), ["HEADER", "HEADER_END", "EMPTY"]);
  workspace.dispose();
});
