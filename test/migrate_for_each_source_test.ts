import { assertEquals } from "@std/assert";
import { migrateForEachSourceState } from "@intehrgrator/blockly/migrate_for_each_source.ts";

Deno.test("migrateForEachSourceState rewrites a PATH loop to for_each_list + source_query_node", () => {
  const migrated = migrateForEachSourceState({
    blocks: {
      languageVersion: 0,
      blocks: [{
        type: "for_each_source",
        id: "loop1",
        fields: { VAR: "item", PATH: "$.tip_array" },
        inputs: {
          DO: { block: { type: "event", id: "evt", fields: { SLOT_ID: "evt-1" } } },
        },
      }],
    },
  });
  assertEquals(migrated.blocks.blocks[0], {
    type: "for_each_list",
    id: "loop1",
    fields: { VAR: "item" },
    inputs: {
      LIST: {
        block: {
          type: "source_query_node",
          id: "loop1_src",
          fields: { EXPRESSION: "$.tip_array" },
        },
      },
      DO: { block: { type: "event", id: "evt", fields: { SLOT_ID: "evt-1" } } },
    },
  });
});

Deno.test("migrateForEachSourceState rewrites extraState connection checks", () => {
  const migrated = migrateForEachSourceState({
    extraState: { check: ["schema_TextKeyWord", "controls_if", "for_each_source"] },
  });
  assertEquals(migrated.extraState.check, [
    "schema_TextKeyWord",
    "controls_if",
    "for_each_list",
  ]);
});
