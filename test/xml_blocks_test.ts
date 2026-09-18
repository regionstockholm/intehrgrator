import { assert, assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import {
  composeXmlDocumentOptions,
} from "@intehrgrator/blockly/blocks/xml_blocks.ts";
import {
  XML_ATTRIBUTE_TYPE,
  XML_ATTRIBUTES_INPUT,
  XML_CDATA_TYPE,
  XML_CHILDREN_INPUT,
  XML_DOCUMENT_TYPE,
  XML_ELEMENT_TYPE,
  XML_ROOT_INPUT,
  XML_TEXT_INPUT,
  XML_TEXT_TYPE,
} from "@intehrgrator/core/xml_shape.ts";
import { generateGoTemplate } from "@intehrgrator/core/codegen/mod.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { INSTANCE_ROOT_CONNECTION } from "@intehrgrator/blockly/instance_root.ts";
import { buildDemoToolbox, toolboxBlockTypes } from "@intehrgrator/blockly/toolbox_demo.ts";
import { msg } from "@intehrgrator/blockly/i18n/custom_msg.ts";
import { projectBlocklyState } from "@intehrgrator/workbench/mapping_spec/mod.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

function canConnect(
  a: Blockly.Connection | null | undefined,
  b: Blockly.Connection | null | undefined,
): boolean {
  if (!a || !b) return false;
  const checker = a.getWorkspace?.()?.connectionChecker ??
    (a as Blockly.Connection & { connectionChecker?: { canConnect: (x: Blockly.Connection, y: Blockly.Connection, isDrag: boolean) => boolean } }).connectionChecker;
  if (checker?.canConnect) return checker.canConnect(a, b, true);
  try {
    a.connect(b);
    a.disconnect();
    return true;
  } catch {
    return false;
  }
}

Deno.test("xml_element mouths: attributes stack, one text slot, nested children", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const el = ws.newBlock(XML_ELEMENT_TYPE);
  const attr = ws.newBlock(XML_ATTRIBUTE_TYPE);
  const attr2 = ws.newBlock(XML_ATTRIBUTE_TYPE);
  const text = ws.newBlock(XML_TEXT_TYPE);
  const cdata = ws.newBlock(XML_CDATA_TYPE);
  const child = ws.newBlock(XML_ELEMENT_TYPE);

  const attrs = el.getInput(XML_ATTRIBUTES_INPUT)?.connection;
  const textIn = el.getInput(XML_TEXT_INPUT)?.connection;
  const kids = el.getInput(XML_CHILDREN_INPUT)?.connection;

  assert(attrs, "attributes mouth");
  assert(textIn, "text slot");
  assert(kids, "children mouth");

  assertEquals(canConnect(attrs, attr.previousConnection), true);
  assertEquals(canConnect(attrs, attr2.previousConnection), true);
  assertEquals(canConnect(attrs, child.previousConnection), false, "elements must not stack in attributes");
  assertEquals(canConnect(kids, attr.previousConnection), false, "attributes must not stack in children");
  assertEquals(canConnect(kids, child.previousConnection), true);
  assertEquals(canConnect(textIn, text.outputConnection), true);
  assertEquals(canConnect(textIn, cdata.outputConnection), true);
  assertEquals(text.previousConnection, null, "xml_text is a value block");
  assertEquals(cdata.previousConnection, null, "xml_cdata is a value block");
  ws.dispose();
});

Deno.test("xml_element mouth captions hug sockets (statement LEFT, value RIGHT)", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const el = ws.newBlock(XML_ELEMENT_TYPE);
  assertEquals(el.getInputsInline(), false, "external rows so alignment padding can pack captions");
  const AlignRight = Blockly.inputs.Align.RIGHT;
  const AlignLeft = Blockly.inputs.Align.LEFT;
  assertEquals(el.getInput("HEADER")?.align, AlignLeft);
  const statementLeft = [XML_ATTRIBUTES_INPUT, XML_CHILDREN_INPUT];
  for (const name of statementLeft) {
    const input = el.getInput(name);
    assert(input, name);
    assertEquals(input.align, AlignLeft, `${name} statement C starts after the caption`);
    assert(
      input.fieldRow.some((f) => (f as { isSlotLabelField?: boolean }).isSlotLabelField),
      `${name} uses FieldSlotLabel`,
    );
  }
  const text = el.getInput(XML_TEXT_INPUT);
  assert(text, XML_TEXT_INPUT);
  assertEquals(text.align, AlignRight, "text value socket stays right-packed");
  assert(
    text.fieldRow.some((f) => (f as { isSlotLabelField?: boolean }).isSlotLabelField),
    "text uses FieldSlotLabel",
  );
  const doc = ws.newBlock(XML_DOCUMENT_TYPE);
  assertEquals(doc.getInputsInline(), false);
  assertEquals(doc.getInput(XML_ROOT_INPUT)?.align, AlignLeft);
  assert(
    doc.getInput(XML_ROOT_INPUT)?.fieldRow.some(
      (f) => (f as { isSlotLabelField?: boolean }).isSlotLabelField,
    ),
    "document element mouth uses FieldSlotLabel",
  );
  ws.dispose();
});

Deno.test("xml_document is an instance root with declaration fields by default", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const doc = ws.newBlock(XML_DOCUMENT_TYPE);
  assertEquals(doc.previousConnection?.getCheck()?.includes(INSTANCE_ROOT_CONNECTION), true);
  assertEquals(doc.nextConnection?.getCheck()?.includes(INSTANCE_ROOT_CONNECTION), true);
  assert(doc.getField("MUTATOR_COG"), "cogwheel");
  assertEquals(doc.getFieldValue("VERSION"), "1.0");
  assertEquals(doc.getFieldValue("ENCODING"), "UTF-8");
  const root = ws.newBlock(XML_ELEMENT_TYPE);
  assertEquals(
    canConnect(doc.getInput(XML_ROOT_INPUT)?.connection, root.previousConnection),
    true,
  );
  assertEquals(doc.getInput(XML_ROOT_INPUT)?.connection?.getCheck(), [XML_ELEMENT_TYPE]);
  assertEquals(root.previousConnection?.getCheck()?.includes(XML_ELEMENT_TYPE), true);
  assertEquals(
    root.previousConnection?.getCheck()?.includes(INSTANCE_ROOT_CONNECTION),
    false,
    "nested xml_element must not wear the instance-root cap",
  );
  ws.dispose();
});

Deno.test("xml_document mutator can add standalone and a namespace", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const doc = ws.newBlock(XML_DOCUMENT_TYPE);
  composeXmlDocumentOptions(doc, ["declaration", "standalone", "ns0"]);
  assert(doc.getInput("STANDALONE_ROW"), "standalone row");
  assert(doc.getInput("NS_ns0"), "namespace row");
  doc.setFieldValue("tc", "PREFIX_ns0");
  doc.setFieldValue("urn:take", "URI_ns0");
  const saved = Blockly.serialization.blocks.save(doc) as {
    extraState?: { namespaces?: Array<{ prefix: string; uri: string }>; extras?: string[] };
  };
  assertEquals(saved.extraState?.namespaces?.[0]?.prefix, "tc");
  assertEquals(saved.extraState?.namespaces?.[0]?.uri, "urn:take");
  ws.dispose();
});

Deno.test("XML toolbox lists document, element, text, CDATA, and attribute", () => {
  ensure();
  const types = toolboxBlockTypes(buildDemoToolbox("en"));
  for (const type of [XML_DOCUMENT_TYPE, XML_ELEMENT_TYPE, XML_TEXT_TYPE, XML_CDATA_TYPE, XML_ATTRIBUTE_TYPE]) {
    assert(types.includes(type), type);
  }
});

function drawerBlockTypes(toolbox: ReturnType<typeof buildDemoToolbox>, name: string): string[] {
  const root = toolbox as {
    contents: Array<{ name?: string; contents?: Array<{ type?: string }> }>;
  };
  return (root.contents.find((c) => c.name === name)?.contents ?? [])
    .map((block) => block.type)
    .filter((type): type is string => Boolean(type));
}

Deno.test("JSON and XML drawers do not list leftover schema target/value blocks", () => {
  const toolbox = buildDemoToolbox("en");
  const m = msg("en");
  for (const name of [m.CAT_JSON, m.CAT_XML]) {
    const types = drawerBlockTypes(toolbox, name);
    assertEquals(types.includes("target_structure"), false, `${name} target_structure`);
    assertEquals(types.includes("target_value"), false, `${name} target_value`);
  }
  assertEquals(drawerBlockTypes(toolbox, m.CAT_JSON), [
    "conversion_start",
    "json_object",
    "json_array",
    "json_value",
    "json_boolean",
    "json_null",
  ]);
});

Deno.test("go-template codegen: split mouths, CDATA, and XML declaration", () => {
  const model = createEmptyModel("test");
  const output = generateGoTemplate(model, {
    blocklyState: {
      blocks: {
        blocks: [{
          type: XML_DOCUMENT_TYPE,
          extraState: {
            declaration: true,
            version: "1.0",
            encoding: "UTF-8",
            namespaces: [{ prefix: "tc", uri: "urn:take" }],
          },
          inputs: {
            TARGET_root: {
              block: {
                type: XML_ELEMENT_TYPE,
                fields: { NAME: "Note" },
                inputs: {
                  TARGET_attributes: {
                    block: {
                      type: XML_ATTRIBUTE_TYPE,
                      fields: { NAME: "id" },
                      inputs: { VALUE: { block: { type: "text", fields: { TEXT: "n1" } } } },
                    },
                  },
                  VALUE: {
                    block: {
                      type: XML_CDATA_TYPE,
                      inputs: { VALUE: { block: { type: "text", fields: { TEXT: "raw <xml>" } } } },
                    },
                  },
                },
              },
            },
          },
        }],
      },
    },
  });
  assert(output.includes(`<?xml version="1.0" encoding="UTF-8"?>`), output);
  assert(output.includes(`xmlns:tc="urn:take"`), output);
  assert(output.includes(`id="n1"`), output);
  assert(output.includes("<![CDATA[raw <xml>]]>"), output);
  assert(output.includes("<Note"), output);
  assert(output.includes("</Note>"), output);
});

Deno.test("mapping spec flattens xml_cdata like xml_text", () => {
  const projection = projectBlocklyState({
    blocks: {
      languageVersion: 0,
      blocks: [{
        type: XML_ELEMENT_TYPE,
        id: "el",
        fields: { NAME: "Note" },
        inputs: {
          VALUE: {
            block: {
              type: XML_CDATA_TYPE,
              id: "cd",
              inputs: {
                VALUE: { block: { type: "text", id: "t", fields: { TEXT: "x" } } },
              },
            },
          },
        },
      }],
    },
  });
  const types = projection.lines.filter((l) => l.kind !== "header").map((l) => l.type);
  assertEquals(types.includes(XML_ELEMENT_TYPE), true);
  assertEquals(types.includes(XML_CDATA_TYPE), false);
  assertEquals(types.includes("text"), true);
});
