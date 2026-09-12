import { assertEquals } from "@std/assert";
import { generateGoTemplate } from "@intehrgrator/core/codegen/mod.ts";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";

Deno.test("go-template xml_element uses separate text and attributes mouths", () => {
  initBlocklyGenerators();
  const model = createEmptyModel("test");
  const output = generateGoTemplate(model, {
    blocklyState: {
      blocks: {
        blocks: [{
          type: "xml_element",
          fields: { NAME: "Note" },
          extraState: { childGroups: ["attributes", "text"] },
          inputs: {
            TARGET_attributes: {
              block: {
                type: "xml_attribute",
                fields: { NAME: "lang" },
                inputs: {
                  VALUE: { block: { type: "text", fields: { TEXT: "en" } } },
                },
              },
            },
            TARGET_text: {
              block: { type: "text", fields: { TEXT: "hello" } },
            },
          },
        }],
      },
    },
  });
  assertEquals(output.includes("<Note"), true, output);
  assertEquals(output.includes('lang="en"'), true, output);
  assertEquals(output.includes("hello"), true, output);
  assertEquals(output.includes("</Note>"), true, output);
});

Deno.test("go-template xml_document emits prolog and CDATA", () => {
  initBlocklyGenerators();
  const model = createEmptyModel("test");
  const output = generateGoTemplate(model, {
    blocklyState: {
      blocks: {
        blocks: [{
          type: "xml_document",
          fields: { VERSION: "1.0", ENCODING: "UTF-8", STANDALONE: "yes" },
          extraState: { attributes: [{ name: "xmlns", value: "http://example.com/ns" }] },
          inputs: {
            TARGET_root: {
              block: {
                type: "xml_element",
                fields: { NAME: "root" },
                extraState: { childGroups: ["text"] },
                inputs: {
                  TARGET_text: {
                    block: {
                      type: "xml_cdata",
                      inputs: {
                        VALUE: { block: { type: "text", fields: { TEXT: "raw&<data>" } } },
                      },
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
  assertEquals(output.includes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'), true, output);
  assertEquals(output.includes('xmlns="http://example.com/ns"'), true, output);
  assertEquals(output.includes("<![CDATA[raw&<data>]]>"), true, output);
});