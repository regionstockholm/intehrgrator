import { assertEquals, assertStringIncludes } from "@std/assert";
import { projectBlocklyState } from "@intehrgrator/workbench/mapping_spec/mod.ts";

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
