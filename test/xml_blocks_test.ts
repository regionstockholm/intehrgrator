import { assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import { migrateXmlElementInputs } from "@intehrgrator/blockly/blocks/xml_blocks.ts";
import { targetChildInputName } from "@intehrgrator/blockly/blocks/target_blocks.ts";

let ready = false;
function ensure(): void {
  if (!ready) {
    initBlocklyGenerators();
    ready = true;
  }
}

Deno.test("migrateXmlElementInputs splits legacy children chain into text/attributes/children", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const parent = workspace.newBlock("xml_element");
  parent.setFieldValue("item", "NAME");

  const attr = workspace.newBlock("xml_attribute");
  attr.setFieldValue("id", "NAME");
  const text = workspace.newBlock("xml_text");
  const query = workspace.newBlock("source_query");
  query.setFieldValue("$.value", "EXPRESSION");
  text.getInput("VALUE")?.connection?.connect(query.outputConnection!);
  const child = workspace.newBlock("xml_element");
  child.setFieldValue("child", "NAME");

  const children = parent.getInput(targetChildInputName("children"));
  children?.connection?.connect(attr.previousConnection!);
  attr.nextConnection?.connect(text.previousConnection!);
  text.nextConnection?.connect(child.previousConnection!);

  migrateXmlElementInputs(parent);

  assertEquals(parent.getInputTargetBlock(targetChildInputName("text"))?.type, "source_query");
  assertEquals(parent.getInputTargetBlock(targetChildInputName("attributes"))?.type, "xml_attribute");
  assertEquals(parent.getInputTargetBlock(targetChildInputName("children"))?.type, "xml_element");
  workspace.dispose();
});
