import { assertEquals, assertStringIncludes } from "@std/assert";
import { blocklyJsonDocument, projectBlocklyState } from "@intehrgrator/workbench/mapping_spec/mod.ts";

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
