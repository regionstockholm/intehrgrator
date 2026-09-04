import { assertEquals, assert } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { registerTargetBlocks } from "@intehrgrator/blockly/blocks/target_blocks.ts";
import { isSkeletonTitleField } from "@intehrgrator/blockly/field_skeleton_title.ts";
import { isSlotLabelField } from "@intehrgrator/blockly/slot_label.ts";
import { loadSkeletonIntoWorkspace } from "@intehrgrator/blockly/skeleton_loader.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { loadJsonSchema } from "@intehrgrator/core/source/schema_loader.ts";
import { getTargetFormatHandler } from "@intehrgrator/core/target/format_handler.ts";
import "blockly/blocks";

Deno.test("JSON Schema description flows onto SkeletonNode.documentation", () => {
  const schema = JSON.stringify({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    description: "Root patient payload",
    properties: {
      givenName: {
        type: "string",
        description: "Given / first name",
      },
    },
    required: ["givenName"],
  });
  const tree = loadJsonSchema(schema, "Patient");
  assertEquals(tree.description, "Root patient payload");
  assertEquals(tree.children[0]?.name, "givenName");
  assertEquals(tree.children[0]?.description, "Given / first name");

  const handler = getTargetFormatHandler("json-schema");
  assert(handler);
  const loaded = handler.load("patient.schema.json", schema);
  const root = loaded.skeleton[0];
  assert(root);
  assertEquals(root.documentation, "Root patient payload");
  assertEquals(root.children[0]?.documentation, "Given / first name");
});

Deno.test("XSD xs:documentation flows onto SkeletonNode.documentation", () => {
  const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Patient">
    <xs:annotation><xs:documentation>Root patient element</xs:documentation></xs:annotation>
    <xs:complexType>
      <xs:sequence>
        <xs:element name="givenName" type="xs:string">
          <xs:annotation><xs:documentation>Given / first name</xs:documentation></xs:annotation>
        </xs:element>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;
  const handler = getTargetFormatHandler("xml-schema");
  const loaded = handler.load("patient.xsd", xsd);
  const root = loaded.skeleton[0];
  assert(root);
  assertEquals(root.documentation, "Root patient element");
  assertEquals(root.children[0]?.documentation, "Given / first name");
});

Deno.test("schema scaffold wires documentation onto title and slot labels", () => {
  registerTargetBlocks();
  const schema = JSON.stringify({
    type: "object",
    description: "Root patient payload",
    properties: {
      givenName: {
        type: "string",
        description: "Given / first name",
      },
    },
    required: ["givenName"],
  });
  const loaded = getTargetFormatHandler("json-schema").load("patient.schema.json", schema);
  const workspace = new Blockly.Workspace();
  try {
    loadSkeletonIntoWorkspace(
      workspace,
      loaded.skeleton,
      createEmptyModel(loaded.targetId),
      null,
      "en",
      "json-schema",
    );
    const root = workspace.getAllBlocks(false).find((b) => b.type === "target_structure");
    assert(root);
    const title = root.getField("NAME");
    assert(isSkeletonTitleField(title));
    assertEquals(title.documentation(), "Root patient payload");

    const mouth = root.getInput("TARGET_givenName");
    assert(mouth);
    const slotField = mouth.fieldRow.find((f) => isSlotLabelField(f));
    assert(slotField && isSlotLabelField(slotField));
    assertEquals(slotField.documentation(), "Given / first name");
  } finally {
    workspace.dispose();
  }
});
