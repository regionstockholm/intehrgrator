import { assert, assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import "blockly/blocks";
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
  assert(map.getField("KEY0"));
  assert(map.getInput("VAL2"));
  const lookup = workspace.newBlock(MAPS_GET);
  lookup.setFieldValue("defaults", "NAME");
  assertEquals(lookup.getFieldValue("NAME"), "defaults");
  workspace.dispose();
});

Deno.test("maps_create_with keeps keys as fields and values on the right edge", () => {
  registerMapBlocks();
  const workspace = new Blockly.Workspace();
  const map = workspace.newBlock(MAPS_CREATE_WITH) as MapCreateBlock;
  map.itemCount_ = 2;
  map.updateShape_();
  assertEquals(map.getInputsInline(), false);
  assertEquals(inputNames(map), ["HEADER", "VAL0", "VAL1"]);
  assertEquals(map.getInput("HEADER")?.type, Blockly.inputs.inputTypes.DUMMY);
  assertEquals(map.getInput("VAL0")?.type, Blockly.inputs.inputTypes.VALUE);
  assertEquals(map.getInput("VAL0")?.align, Blockly.inputs.Align.RIGHT);
  assertEquals(map.getFieldValue("KEY0"), "");
  assertEquals(map.getInput("VAL0")?.fieldRow[1]?.getText?.() ?? ":", ":");
  assert(!map.getInput("KEY0"));

  map.setFieldValue("language", "KEY0");
  assertEquals(map.getFieldValue("KEY0"), "language");

  map.itemCount_ = 0;
  map.updateShape_();
  assertEquals(inputNames(map), ["HEADER", "EMPTY"]);
  workspace.dispose();
});

Deno.test("maps_create_with serializes field keys and value sockets", () => {
  registerMapBlocks();
  const workspace = new Blockly.Workspace();
  const map = workspace.newBlock(MAPS_CREATE_WITH) as MapCreateBlock;
  map.itemCount_ = 1;
  map.updateShape_();
  map.setFieldValue("territory", "KEY0");
  const val = map.getInput("VAL0")?.connection;
  if (val && typeof val.setShadowState === "function") {
    val.setShadowState({ type: "text", fields: { TEXT: "SE" } });
  }
  const saved = Blockly.serialization.blocks.save(map) as {
    fields?: Record<string, unknown>;
    inputs?: Record<string, unknown>;
  };
  assertEquals(saved.fields?.KEY0, "territory");
  assertEquals(saved.inputs?.KEY0, undefined);
  assert(saved.inputs?.VAL0);
  workspace.dispose();
});
