import { assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  appendHiddenSerializable,
  createHiddenSerializableField,
} from "@intehrgrator/blockly/hidden_serializable_field.ts";

Deno.test("hidden serializable fields report zero layout size", () => {
  const field = createHiddenSerializableField("CODE_PHRASE");
  const size = field.getSize?.() ?? { width: -1, height: -1 };
  assertEquals(size.width, 0);
  assertEquals(size.height, 0);
});

Deno.test("appendHiddenSerializable reuses HEADER instead of a new dummy row", () => {
  Blockly.Blocks["hidden_field_probe"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput("HEADER").appendField("title");
      this.appendValueInput("VALUE");
      appendHiddenSerializable(this, "SLOT_ID", "slot/x");
      appendHiddenSerializable(this, "RM_TYPE", "OBSERVATION");
    },
  };
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock("hidden_field_probe");
  assertEquals(block.getFieldValue("SLOT_ID"), "slot/x");
  assertEquals(block.getFieldValue("RM_TYPE"), "OBSERVATION");
  const dummyAfterHeader = block.inputList.filter((input) => !input.connection && input.name !== "HEADER");
  assertEquals(dummyAfterHeader.length, 0);
  const saved = Blockly.serialization.blocks.save(block) as {
    fields?: Record<string, string>;
  };
  assertEquals(saved.fields?.SLOT_ID, "slot/x");
  assertEquals(saved.fields?.RM_TYPE, "OBSERVATION");
  workspace.dispose();
  delete Blockly.Blocks["hidden_field_probe"];
});
