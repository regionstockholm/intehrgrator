import { assertEquals } from "@std/assert";
import {
  injectXmlnsOnOpenTag,
  wrapXmlCdata,
  xmlDeclarationLine,
} from "@intehrgrator/core/xml_shape.ts";
import { upgradeXmlBlocklyState } from "@intehrgrator/core/xml_upgrade.ts";

Deno.test("xmlDeclarationLine emits version, encoding, and optional standalone", () => {
  assertEquals(
    xmlDeclarationLine({ version: "1.0", encoding: "UTF-8" }),
    `<?xml version="1.0" encoding="UTF-8"?>`,
  );
  assertEquals(
    xmlDeclarationLine({ version: "1.1", encoding: "ISO-8859-1", standalone: "yes" }),
    `<?xml version="1.1" encoding="ISO-8859-1" standalone="yes"?>`,
  );
});

Deno.test("wrapXmlCdata splits the CDATA terminator", () => {
  assertEquals(wrapXmlCdata("hello"), "<![CDATA[hello]]>");
  assertEquals(wrapXmlCdata("a]]>b"), "<![CDATA[a]]]]><![CDATA[>b]]>");
});

Deno.test("injectXmlnsOnOpenTag adds xmlns to the start tag", () => {
  assertEquals(
    injectXmlnsOnOpenTag("<Note>", [{ prefix: "tc", uri: "urn:take" }]),
    `<Note xmlns:tc="urn:take">`,
  );
  assertEquals(
    injectXmlnsOnOpenTag("<Note/>", [{ prefix: "", uri: "urn:def" }]),
    `<Note xmlns="urn:def"/>`,
  );
});

Deno.test("upgradeXmlBlocklyState splits mixed TARGET_children into attributes, text, children", () => {
  const state = {
    blocks: {
      blocks: [{
        type: "xml_element",
        fields: { NAME: "Note" },
        extraState: { childGroups: ["children"] },
        inputs: {
          TARGET_children: {
            block: {
              type: "xml_attribute",
              fields: { NAME: "id" },
              inputs: { VALUE: { block: { type: "text", fields: { TEXT: "n1" } } } },
              next: {
                block: {
                  type: "xml_text",
                  inputs: { VALUE: { block: { type: "source_query", fields: { EXPRESSION: "$.note" } } } },
                  next: {
                    block: {
                      type: "xml_element",
                      fields: { NAME: "child" },
                    },
                  },
                },
              },
            },
          },
        },
      }],
    },
  };
  upgradeXmlBlocklyState(state);
  const el = state.blocks.blocks[0];
  assertEquals(el.inputs.TARGET_attributes?.block?.type, "xml_attribute");
  assertEquals(el.inputs.TARGET_attributes?.block?.fields?.NAME, "id");
  assertEquals(el.inputs.VALUE?.block?.type, "source_query");
  assertEquals(el.inputs.VALUE?.block?.fields?.EXPRESSION, "$.note");
  assertEquals(el.inputs.TARGET_children?.block?.type, "xml_element");
  assertEquals(el.inputs.TARGET_children?.block?.fields?.NAME, "child");
  assertEquals(el.inputs.TARGET_children?.block?.next, undefined);
});

Deno.test("upgradeXmlBlocklyState is idempotent on already-split elements", () => {
  const state = {
    blocks: {
      blocks: [{
        type: "xml_element",
        inputs: {
          TARGET_attributes: { block: { type: "xml_attribute", fields: { NAME: "id" } } },
          VALUE: { block: { type: "text", fields: { TEXT: "hi" } } },
          TARGET_children: { block: { type: "xml_element", fields: { NAME: "c" } } },
        },
      }],
    },
  };
  upgradeXmlBlocklyState(state);
  upgradeXmlBlocklyState(state);
  const el = state.blocks.blocks[0];
  assertEquals(el.inputs.TARGET_attributes?.block?.fields?.NAME, "id");
  assertEquals(el.inputs.VALUE?.block?.fields?.TEXT, "hi");
  assertEquals(el.inputs.TARGET_children?.block?.fields?.NAME, "c");
});
