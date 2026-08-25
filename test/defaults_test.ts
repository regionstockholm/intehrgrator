import { assertEquals, assert, assertExists } from "@std/assert";
import { join } from "@std/path";
import {
  bindDefaultPoints,
  createMemoryDefaultsCatalog,
  DEFAULTS_MAP_NAME,
  FACTORY_HEALTH_CARE_FACILITY,
  FACTORY_TERRITORY,
  factoryDefaultsEntries,
  mapBlockFromDefaultsJson,
  mapsGetExpression,
  migrateBlocklyMapsJson,
  namedMapsFromBlocklyState,
} from "@intehrgrator/core/defaults/mod.ts";
import { evaluate, createSourceContext } from "@intehrgrator/core/source/query_runtime.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";
import { applyExpressionEdit, createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { generateSkeleton } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { parseExpression, serialize } from "@intehrgrator/core/expression/mod.ts";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { registerRmBlocks } from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { registerMapBlocks } from "@intehrgrator/blockly/blocks/map_blocks.ts";
import { loadSkeletonIntoWorkspace } from "@intehrgrator/blockly/skeleton_loader.ts";
import {
  ensureDefaultsBlock,
  findDefaultsBlock,
} from "@intehrgrator/blockly/defaults_canvas.ts";
import { workspaceToModelJson } from "@intehrgrator/blockly/mod.ts";

const opt = await Deno.readTextFile(
  join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
);

Deno.test("factory Defaults Map seeds UI language once and dummy facility", () => {
  const entries = factoryDefaultsEntries("sv");
  const byKey = Object.fromEntries(entries.map((entry) => [entry.key, entry.value]));
  assertEquals(byKey.language, "sv");
  assertEquals(byKey.territory, FACTORY_TERRITORY);
  assertEquals(byKey.time, "");
  assertEquals(byKey.composer_name, "");
  assertEquals(byKey.health_care_facility, FACTORY_HEALTH_CARE_FACILITY);
  assertEquals(factoryDefaultsEntries("de").find((e) => e.key === "language")?.value, "de");
});

Deno.test("namedMapsFromBlocklyState reads the Defaults block Map argument", () => {
  const state = {
    blocks: {
      blocks: [
        {
          type: "defaults_block",
          inputs: {
            MAP: {
              block: {
                type: "maps_create_with",
                extraState: { itemCount: 2 },
                inputs: {
                  KEY0: { shadow: { type: "text", fields: { TEXT: "language" } } },
                  VAL0: { shadow: { type: "text", fields: { TEXT: "sv" } } },
                  KEY1: { shadow: { type: "text", fields: { TEXT: "territory" } } },
                  VAL1: { shadow: { type: "text", fields: { TEXT: "SE" } } },
                },
              },
            },
          },
        },
      ],
    },
  };
  const maps = namedMapsFromBlocklyState(state);
  assertEquals(maps[DEFAULTS_MAP_NAME]?.language, "sv");
  assertEquals(maps[DEFAULTS_MAP_NAME]?.territory, "SE");
});

Deno.test("namedMapsFromBlocklyState reads compact KEY fields on maps_create_with", () => {
  const state = {
    blocks: {
      blocks: [
        {
          type: "defaults_block",
          inputs: {
            MAP: {
              block: {
                type: "maps_create_with",
                extraState: { itemCount: 1, keys: ["language"] },
                fields: { KEY0: "language" },
                inputs: {
                  VAL0: { shadow: { type: "text", fields: { TEXT: "de" } } },
                },
              },
            },
          },
        },
      ],
    },
  };
  assertEquals(namedMapsFromBlocklyState(state)[DEFAULTS_MAP_NAME]?.language, "de");
});

Deno.test("migrateBlocklyMapsJson turns stacked KEY sockets into fields", () => {
  const old = {
    type: "maps_create_with",
    extraState: { itemCount: 1 },
    inputs: {
      KEY0: { shadow: { type: "text", fields: { TEXT: "territory" } } },
      VAL0: { shadow: { type: "text", fields: { TEXT: "SE" } } },
    },
  };
  const migrated = migrateBlocklyMapsJson(old) as {
    fields?: Record<string, string>;
    extraState?: { keys?: string[] };
    inputs?: Record<string, unknown>;
  };
  assertEquals(migrated.fields?.KEY0, "territory");
  assertEquals(migrated.extraState?.keys, ["territory"]);
  assertEquals(migrated.inputs?.KEY0, undefined);
  assertEquals(old.inputs.KEY0.shadow.fields.TEXT, "territory");
  const lookup = migrateBlocklyMapsJson({
    type: "maps_get",
    fields: { NAME: "defaults" },
    inputs: { KEY: { shadow: { type: "text", fields: { TEXT: "language" } } } },
  }) as { fields?: Record<string, string>; inputs?: Record<string, unknown> };
  assertEquals(lookup.fields?.KEY, "language");
  assertEquals(lookup.inputs?.KEY, undefined);
});

Deno.test("mapBlockFromDefaultsJson accepts a maps_create_with block or a workspace", () => {
  const block = { type: "maps_create_with", extraState: { itemCount: 0 } };
  assertEquals(
    mapBlockFromDefaultsJson(block),
    { type: "maps_create_with", extraState: { itemCount: 0, keys: [] } },
  );
  const wrapped = {
    blocks: { blocks: [{ type: "defaults_block", inputs: { MAP: { block } } }] },
  };
  assertEquals(
    (mapBlockFromDefaultsJson(wrapped) as { type?: string }).type,
    "maps_create_with",
  );
  assertEquals(mapBlockFromDefaultsJson({ nope: true }), null);
});

Deno.test("maps_get evaluates against namedMaps on SourceContext", () => {
  const ctx = createSourceContext("{}", "json");
  ctx.namedMaps = { defaults: { language: "sv" } };
  assertEquals(evaluate('maps_get("defaults", "language")', ctx, "string"), "sv");
  assertEquals(evaluate('maps_get("defaults", "missing")', ctx, "string"), null);
});

Deno.test("Test Run resolves maps_get from Blockly Defaults Map JSON", () => {
  const model = applyExpressionEdit(
    createEmptyModel("vitals"),
    "s1",
    mapsGetExpression("defaults", "language"),
    { rmType: "DV_TEXT", returnType: "string" },
  );
  const result = runTest(model, "{}", "json", {
    blocklyState: {
      blocks: {
        blocks: [
          {
            type: "defaults_block",
            inputs: {
              MAP: {
                block: {
                  type: "maps_create_with",
                  extraState: { itemCount: 1 },
                  inputs: {
                    KEY0: { shadow: { type: "text", fields: { TEXT: "language" } } },
                    VAL0: { shadow: { type: "text", fields: { TEXT: "sv" } } },
                  },
                },
              },
            },
          },
        ],
      },
    },
  });
  assertEquals(result.ok, true);
  const output = result.output as { slots?: Record<string, unknown> };
  assertEquals(output.slots?.s1, "sv");
});

Deno.test("maps_get expression round-trips", () => {
  const src = 'maps_get("defaults", "territory")';
  assertEquals(serialize(parseExpression(src)), src);
});

Deno.test("memory Defaults catalog save/load", async () => {
  const catalog = createMemoryDefaultsCatalog();
  const saved = await catalog.save("Clinic", { type: "maps_create_with" });
  assertEquals(saved.displayName, "Clinic");
  const listed = await catalog.list();
  assertEquals(listed[0]?.id, saved.id);
  assertEquals(await catalog.load(saved.id), { type: "maps_create_with" });
});

Deno.test("bindDefaultPoints matches COMPOSITION language on a BP OPT", () => {
  const { skeleton } = generateSkeleton(opt);
  const bound = bindDefaultPoints(skeleton);
  assert(bound.some((item) => item.point.mapKey === "language" && item.parent.rmType === "COMPOSITION"));
  assert(bound.some((item) => item.point.mapKey === "territory"));
  assert(bound.some((item) => item.point.mapKey === "composer_name"));
});

Deno.test("skeleton scaffolding joins an existing Defaults block and plugs language lookup", () => {
  registerRmBlocks();
  registerMapBlocks();
  const workspace = new Blockly.Workspace();
  ensureDefaultsBlock(workspace, "sv");
  const beforeId = findDefaultsBlock(workspace)?.id;
  assertExists(beforeId);
  const { skeleton } = generateSkeleton(opt);
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null, "sv");
  const defaults = findDefaultsBlock(workspace);
  assertExists(defaults);
  assertEquals(defaults.id, beforeId);
  const maps = namedMapsFromBlocklyState(Blockly.serialization.workspaces.save(workspace));
  assertEquals(maps[DEFAULTS_MAP_NAME]?.language, "sv");
  const lookups = workspace.getAllBlocks(false).filter((block) => block.type === "maps_get");
  assert(lookups.length > 0, "expected Default point Map lookups on the skeleton");
  assert(
    lookups.some((block) =>
      block.getFieldValue("NAME") === "defaults" &&
      block.getFieldValue("KEY") === "language"
    ),
    "expected a language Default point lookup",
  );
  const derived = workspaceToModelJson(workspace);
  assert(
    derived.slots.some((slot) => slot.expression.includes('maps_get("defaults", "language")')),
    "language lookup should appear in the Mapping Model",
  );
  workspace.dispose();
});
