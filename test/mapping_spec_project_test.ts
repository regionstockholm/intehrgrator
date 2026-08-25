import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  blocklyJsonDocument,
  projectBlocklyState,
  slotAttributeFromInputName,
} from "@intehrgrator/workbench/mapping_spec/mod.ts";

Deno.test("projectBlocklyState compresses nested blocks and omits x/y from text", () => {
  const state = {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: "element",
          id: "el1",
          x: 40,
          y: 80,
          fields: { NAME: "systolic", RM_TYPE: "ELEMENT", SLOT_ID: "bp/items/at0004" },
          inputs: {
            VALUE: {
              block: {
                type: "dv_quantity",
                id: "dv1",
                fields: { RM_TYPE: "DV_QUANTITY" },
                inputs: {
                  MAGNITUDE: {
                    block: {
                      type: "source_query",
                      id: "sq1",
                      fields: { EXPRESSION: "$.systolic", RETURN_TYPE: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
  };

  const projection = projectBlocklyState(state);
  assertStringIncludes(projection.text, "element ·");
  assertStringIncludes(projection.text, "source_query ·");
  assertEquals(projection.text.includes('"x"'), false);
  assertEquals(projection.text.includes("40"), false);

  const source = projection.lines.find((line) => line.kind === "source_query");
  assertEquals(source?.blockId, "sq1");
  assertEquals(source?.attribute, "magnitude");
  assertEquals(
    source?.editable?.find((field) => field.field === "EXPRESSION")?.value,
    "$.systolic",
  );
  assertEquals(source?.summary, "number · $.systolic");
  assertEquals(source?.info.x, undefined);
  assertEquals(
    projection.lines.find((line) => line.blockId === "el1")?.info.x,
    40,
  );
  assertEquals(projection.lines.find((line) => line.blockId === "dv1")?.attribute, "value");
  assertStringIncludes(projection.text, "value  dv_quantity");
  assertStringIncludes(projection.text, "magnitude  source_query");
});

Deno.test("empty workspace projects a header and empty marker", () => {
  const projection = projectBlocklyState({ blocks: { languageVersion: 0, blocks: [] } });
  assertEquals(projection.lines[0]?.kind, "header");
  assertStringIncludes(projection.text, "no blocks");
});

Deno.test("projectBlocklyState classifies typed source_query_number as source", () => {
  const projection = projectBlocklyState({
    blocks: {
      languageVersion: 0,
      blocks: [{
        type: "source_query_number",
        id: "n1",
        x: 10,
        y: 10,
        fields: { EXPRESSION: "$.systolic" },
      }],
    },
  });
  const source = projection.lines.find((line) => line.kind === "source_query");
  assertEquals(source?.type, "source_query_number");
  assertEquals(source?.summary, "number · $.systolic");
  assertEquals(source?.editable?.map((f) => f.field), ["EXPRESSION"]);
});

Deno.test("projectBlocklyState labels named ATTR_/FLD_ slot fillers and statement chains", () => {
  const projection = projectBlocklyState({
    blocks: {
      languageVersion: 0,
      blocks: [{
        type: "composition",
        id: "c1",
        fields: { RM_TYPE: "COMPOSITION" },
        inputs: {
          ATTR_language: {
            block: {
              type: "code_phrase",
              id: "lang",
              fields: { RM_TYPE: "CODE_PHRASE" },
              inputs: {
                FLD_code_string: {
                  block: {
                    type: "source_query",
                    id: "langq",
                    fields: { EXPRESSION: "$.lang", RETURN_TYPE: "string" },
                  },
                },
              },
            },
          },
          ATTR_content: {
            block: {
              type: "observation",
              id: "obs1",
              fields: { NAME: "Blood pressure", RM_TYPE: "OBSERVATION" },
              next: {
                block: {
                  type: "observation",
                  id: "obs2",
                  fields: { NAME: "Pulse", RM_TYPE: "OBSERVATION" },
                },
              },
            },
          },
          OPT_feeder_audit: {
            block: {
              type: "feeder_audit",
              id: "fa1",
              fields: { RM_TYPE: "FEEDER_AUDIT" },
            },
          },
        },
      }],
    },
  });
  assertEquals(projection.lines.find((l) => l.blockId === "c1")?.attribute, undefined);
  assertEquals(projection.lines.find((l) => l.blockId === "lang")?.attribute, "language");
  assertEquals(projection.lines.find((l) => l.blockId === "langq")?.attribute, "code_string");
  assertEquals(projection.lines.find((l) => l.blockId === "obs1")?.attribute, "content");
  assertEquals(projection.lines.find((l) => l.blockId === "obs2")?.attribute, "content");
  assertEquals(projection.lines.find((l) => l.blockId === "fa1")?.attribute, "feeder_audit");
  assertStringIncludes(projection.text, "language  code_phrase");
  assertStringIncludes(projection.text, "content  observation");
});

Deno.test("slotAttributeFromInputName strips Blockly prefixes", () => {
  assertEquals(slotAttributeFromInputName("ATTR_language"), "language");
  assertEquals(slotAttributeFromInputName("OPT_feeder_audit"), "feeder_audit");
  assertEquals(slotAttributeFromInputName("FLD_magnitude"), "magnitude");
  assertEquals(slotAttributeFromInputName("OPTFLD_precision"), "precision");
  assertEquals(slotAttributeFromInputName("TARGET_items"), "items");
  assertEquals(slotAttributeFromInputName("VALUE"), "value");
  assertEquals(slotAttributeFromInputName("KIND"), "kind");
  assertEquals(slotAttributeFromInputName("VAL0"), undefined);
  assertEquals(slotAttributeFromInputName("DO"), undefined);
});

Deno.test("blocklyJsonDocument keeps full workspace JSON including coordinates", () => {
  const state = {
    blocks: {
      languageVersion: 0,
      blocks: [{
        type: "element",
        id: "el1",
        x: 40,
        y: 80,
        fields: { NAME: "systolic", RM_TYPE: "ELEMENT" },
      }],
    },
  };
  const doc = blocklyJsonDocument(state);
  const parsed = JSON.parse(doc.text);
  assertEquals(parsed.blocks.blocks[0].x, 40);
  assertEquals(parsed.blocks.blocks[0].y, 80);
  assertEquals(doc.text.includes('"x": 40'), true);
  assertEquals(doc.widgets.some((w) => w.line.blockId === "el1"), true);
});

Deno.test("blocklyJsonDocument widget overlay keeps extraState and coordinates in the document", () => {
  const state = {
    blocks: {
      languageVersion: 0,
      blocks: [{
        type: "event",
        id: "ev1",
        x: 24,
        y: 36,
        fields: { RM_TYPE: "EVENT" },
        extraState: { extras: [], attrs: ["time", "data"] },
      }],
    },
  };
  const doc = blocklyJsonDocument(state);
  assertEquals(JSON.parse(doc.text).blocks.blocks[0].x, 24);
  assertStringIncludes(doc.text, '"RM_TYPE": "EVENT"');
  assertStringIncludes(doc.text, '"extraState"');
  assertEquals(doc.widgets.length > 0, true);
});
