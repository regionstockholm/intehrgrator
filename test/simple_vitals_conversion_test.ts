import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import * as enMsg from "blockly/msg/en";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  initBlocklyGenerators,
  generateTypeScriptFromWorkspace,
  workspaceToModelJson,
} from "@intehrgrator/blockly/mod.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";
import {
  runGeneratedTypeScript,
  stripGeneratedTypeScript,
} from "@intehrgrator/core/codegen/run_typescript.ts";
import { getTargetFormatHandler } from "@intehrgrator/core/target/mod.ts";
import { normalizeSheet } from "@intehrgrator/core/sheets/mod.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  const anyMod = enMsg as { default?: Record<string, string> } & Record<string, string>;
  const table = anyMod.default && typeof anyMod.default === "object" ? anyMod.default : anyMod;
  Blockly.setLocale(table);
  initBlocklyGenerators();
  ready = true;
}

async function loadSimpleVitalsFixture() {
  ensure();
  const mappingPath = join(
    import.meta.dirname!,
    "fixtures/legacy-simulated-json/mapping/simple-diagnose-and-vitals-to-openEHR-mapped-and-pruned.blockly.json",
  );
  const instancePath = join(
    import.meta.dirname!,
    "fixtures/legacy-simulated-json/instances/bp-inst.json",
  );
  const sheetPath = join(
    import.meta.dirname!,
    "fixtures/legacy-simulated-json/mapping/body_position.decision-table.json",
  );
  const optPath = join(import.meta.dirname!, "fixtures/simple-diagnose-and-vitals.opt");

  const mapping = JSON.parse(await Deno.readTextFile(mappingPath));
  const instance = await Deno.readTextFile(instancePath);
  const bodyPosition = normalizeSheet(JSON.parse(await Deno.readTextFile(sheetPath)));
  let opt: string;
  try {
    opt = await Deno.readTextFile(optPath);
  } catch {
    throw new Error(
      `Missing ${optPath}. Fetch it from Ehrlibs/openEHR-model-examples (simple-diagnose-and-vitals.opt).`,
    );
  }

  const workspace = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(mapping, workspace);
  const extract = workspaceToModelJson(workspace);
  const model = {
    ...createEmptyModel("simple-diagnose-and-vitals"),
    targetFormat: "openehr-template" as const,
    slots: extract.slots,
    loops: extract.loops,
    optionalRm: extract.optionalRm,
  };
  const ts = generateTypeScriptFromWorkspace(workspace, model);
  assert(ts, "expected TypeScript from polished mapping canvas");
  const blocklyState = Blockly.serialization.workspaces.save(workspace);
  const target = getTargetFormatHandler("openehr-template").load("simple-diagnose-and-vitals.opt", opt);
  workspace.dispose();

  return { model, ts, instance, blocklyState, bodyPosition, target };
}

Deno.test("stripGeneratedTypeScript keeps sheets parameter when decision-table helper is emitted", () => {
  const source = [
    "export function convertSourceToComposition(",
    "  sourceCtx: SourceContext,",
    "  defaults: Record<string, unknown> = {},",
    "  sheets: Record<string, unknown> = {},",
    "): COMPOSITION {",
    "  return null as unknown as COMPOSITION;",
    "}",
  ].join("\n");
  const { body } = stripGeneratedTypeScript(source);
  assertStringIncludes(body, "sheets");
  assertStringIncludes(body, "{}");
  assertEquals(body.includes("sheets, )"), false);
  assertEquals(body.includes("name?: string"), false);
  assertEquals(body.includes(": string"), false);
});

Deno.test("polished Simple-vitals mapping: preview and TypeScript Test Run execute", async () => {
  const { model, ts, instance, blocklyState, bodyPosition, target } =
    await loadSimpleVitalsFixture();

  assertStringIncludes(ts, 'defaults["language"]');
  assertEquals(ts.includes('("language" === "defaults"'), false);
  assertStringIncludes(ts, "decisionTable(");

  runGeneratedTypeScript(
    ts,
    { format: "json", data: JSON.parse(instance) },
    { language: "en", territory: "SE", encoding: "UTF-8", time: "2026-07-02T08:30:00Z" },
    undefined,
    { body_position: bodyPosition },
  );

  const preview = runTest(model, instance, "json", {
    target,
    blocklyState,
    sheets: [bodyPosition],
  });
  assertEquals(preview.error, undefined, preview.error);
  assertEquals(preview.ok, true, (preview.warnings ?? []).join("; "));

  const typescript = runTest(model, instance, "json", {
    target,
    outputMode: "typescript",
    generatedCode: ts,
    blocklyState,
    sheets: [bodyPosition],
  });
  assertEquals(typescript.error, undefined, typescript.error);
  assertEquals(typescript.ok, true);

  const rendered = JSON.stringify(preview.output);
  assertStringIncludes(rendered, "120");
  assertStringIncludes(rendered, "80");
  assertStringIncludes(rendered, "72");
});
