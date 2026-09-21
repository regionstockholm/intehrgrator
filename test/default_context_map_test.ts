import { assertEquals, assert } from "@std/assert";
import { join } from "@std/path";
import {
  bindDefaultPoints,
  DEFAULT_CONTEXT_MAP_TYPE,
  factoryDefaultsMapBlockState,
  mapsCreateWithToContextMap,
  migrateDefaultContextMapState,
  namedMapsFromBlocklyState,
  runtimeKeyFromLegacyKey,
  runtimeKeyWarnings,
} from "@intehrgrator/core/defaults/mod.ts";
import { generateSkeleton } from "@intehrgrator/core/skeleton/generate_skeleton.ts";

const opt = await Deno.readTextFile(
  join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
);

Deno.test("runtimeKeyFromLegacyKey splits RM paths from convert-time identifiers", () => {
  assertEquals(runtimeKeyFromLegacyKey("*.language"), "language");
  assertEquals(runtimeKeyFromLegacyKey("COMPOSITION.territory"), "territory");
  assertEquals(runtimeKeyFromLegacyKey("EVENT_CONTEXT.health_care_facility"), "facility");
  assertEquals(runtimeKeyFromLegacyKey("composer_name"), "composer");
  assertEquals(runtimeKeyFromLegacyKey("language"), "language");
});

Deno.test("runtimeKeyWarnings flags empty and duplicate keys", () => {
  assertEquals(
    runtimeKeyWarnings([
      { runtimeKey: "", scaffoldTargets: [] },
      { runtimeKey: "language", scaffoldTargets: ["*.language"] },
      { runtimeKey: "language", scaffoldTargets: ["COMPOSITION.language"] },
    ]),
    [
      "Empty runtime key is invalid",
      "Duplicate runtime key “language” (UNIQUE)",
    ],
  );
});

Deno.test("convert-time bag uses runtime keys; scaffold targets light Default points", () => {
  const { skeleton } = generateSkeleton(opt);
  const block = {
    type: DEFAULT_CONTEXT_MAP_TYPE,
    extraState: { itemCount: 2, targets: [["*.language"], ["EVENT_CONTEXT.health_care_facility"]] },
    fields: { KEY0: "language", KEY1: "facility" },
    inputs: {
      VAL0: { shadow: { type: "text", fields: { TEXT: "sv" } } },
      VAL1: { shadow: { type: "text", fields: { TEXT: "St. Dummy Demo Hospital" } } },
    },
  };
  const maps = namedMapsFromBlocklyState({
    blocks: { blocks: [block] },
  });
  assertEquals(maps.defaults?.language, "sv");
  assertEquals(maps.defaults?.["*.language"], undefined);
  assertEquals(maps.defaults?.facility, "St. Dummy Demo Hospital");

  const bound = bindDefaultPoints(skeleton, [
    { runtimeKey: "language", scaffoldTargets: ["*.language"] },
    { runtimeKey: "facility", scaffoldTargets: ["EVENT_CONTEXT.health_care_facility"] },
  ]);
  assert(bound.some((item) => item.mapKey === "language" && item.point.rmAttribute === "language"));
  assert(bound.some((item) => item.mapKey === "facility" && item.point.rmAttribute === "health_care_facility"));
});

Deno.test("mapsCreateWithToContextMap moves path keys onto scaffold-target chips", () => {
  const converted = mapsCreateWithToContextMap({
    type: "maps_create_with",
    extraState: { itemCount: 1 },
    fields: { KEY0: "*.language" },
    inputs: { VAL0: { shadow: { type: "text", fields: { TEXT: "sv" } } } },
  }) as {
    type: string;
    fields: Record<string, string>;
    extraState: { targets: string[][] };
  };
  assertEquals(converted.type, DEFAULT_CONTEXT_MAP_TYPE);
  assertEquals(converted.fields.KEY0, "language");
  assertEquals(converted.extraState.targets[0], ["*.language"]);
});

Deno.test("migrateDefaultContextMapState rewrites Defaults block and maps_get keys", () => {
  const migrated = migrateDefaultContextMapState({
    blocks: {
      blocks: [
        {
          type: "defaults_block",
          x: 20,
          y: 20,
          inputs: {
            MAP: {
              block: {
                type: "maps_create_with",
                extraState: { itemCount: 1 },
                fields: { KEY0: "*.language" },
                inputs: { VAL0: { shadow: { type: "text", fields: { TEXT: "sv" } } } },
              },
            },
          },
        },
        {
          type: "maps_get",
          fields: { NAME: "defaults" },
          inputs: { KEY: { shadow: { type: "text", fields: { TEXT: "*.language" } } } },
        },
      ],
    },
  }) as {
    blocks: {
      blocks: Array<{
        type: string;
        fields?: Record<string, string>;
        inputs?: { KEY?: { shadow?: { fields?: { TEXT?: string } } } };
      }>;
    };
  };
  assertEquals(migrated.blocks.blocks[0]?.type, DEFAULT_CONTEXT_MAP_TYPE);
  assertEquals(migrated.blocks.blocks[0]?.fields?.KEY0, "language");
  assertEquals(migrated.blocks.blocks[1]?.inputs?.KEY?.shadow?.fields?.TEXT, "language");
});

Deno.test("factory default context map JSON uses runtime keys", () => {
  const state = factoryDefaultsMapBlockState("sv") as {
    type: string;
    fields: Record<string, string>;
    extraState: { targets: string[][] };
  };
  assertEquals(state.type, DEFAULT_CONTEXT_MAP_TYPE);
  assertEquals(state.fields.KEY0, "language");
  assertEquals(state.extraState.targets[0], ["*.language"]);
});
