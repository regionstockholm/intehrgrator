import { assertEquals, assertStringIncludes, assert } from "@std/assert";
import { join, toFileUrl } from "@std/path";
import { createEmptyModel, applyExpressionEdit } from "@intehrgrator/core/mapping_model/mod.ts";
import {
  generate,
  getExportTargetAdapter,
  jsonDollarPathToLookup,
  emitXQueryExpr,
} from "@intehrgrator/core/codegen/mod.ts";
import { parseExpression } from "@intehrgrator/core/expression/mod.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";
import {
  runGeneratedTypeScript,
  serializedConversionOutput,
} from "@intehrgrator/core/codegen/run_typescript.ts";
import { generateSkeleton, collectValueSlots, collectAllSlotIds } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { getTargetFormatHandler } from "@intehrgrator/core/target/mod.ts";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  initBlocklyGenerators,
  loadSkeletonIntoWorkspace,
  generateTypeScriptFromWorkspace,
  generateTypeScriptFromBlocklyState,
  applyModelExpressions,
} from "@intehrgrator/blockly/mod.ts";
import { importSuggestions } from "@intehrgrator/core/ai/mod.ts";

Deno.test("typescript codegen contains template id", () => {
  const model = applyExpressionEdit(createEmptyModel("vitals"), "s1", 'xpathNumber("/a")', {
    rmType: "DV_QUANTITY",
    returnType: "number",
  });
  const ts = generate(model, "typescript");
  assertEquals(ts.includes("vitals"), true);
  assertEquals(ts.includes("evaluateXPathToNumber"), true);
  assertEquals(ts.includes("defaults: Record<string, unknown> = {}"), true);
  assertEquals(ts.includes("void evalExpr"), false);
  assertEquals(ts.includes("__evalGenerated"), false);
  assertEquals(ts.includes('"defaults" === "defaults"'), false);
});

Deno.test("typescript codegen emits sheetLookup helper for sheet_lookup slots", () => {
  const model = applyExpressionEdit(
    createEmptyModel("terms"),
    "s1",
    'sheet_lookup("icd10_snomed", "code", "I10", "snomed")',
    { rmType: "DV_TEXT", returnType: "string" },
  );
  const ts = generate(model, "typescript");
  assertStringIncludes(ts, "function sheetLookup");
  assertStringIncludes(ts, "sheetLookup(");
  assertStringIncludes(ts, "sheets:");
});

Deno.test("java codegen structure", () => {
  const model = createEmptyModel("vitals");
  const java = generate(model, "java");
  assertEquals(java.includes("class ConversionScript"), true);
});

Deno.test("handlebars export target preserves a user-authored template", () => {
  const model = createEmptyModel("summary");
  const template = "Hello {{patient.name}}";
  assertEquals(generate(model, "handlebars", { handlebarsTemplate: template }), template);
});

Deno.test("xquery codegen emits mapping-result module from Blockly slots", () => {
  const model = applyExpressionEdit(createEmptyModel("vitals"), "s1", 'xpathNumber("$.systolic")', {
    rmType: "DV_QUANTITY",
    returnType: "number",
    label: "Systolic",
  });
  model.slots.push({
    slotId: "s2",
    rmType: "DV_TEXT",
    expression: 'concat(trim(xpathString("$.unit")), " Hg")',
    returnType: "string",
  });

  const xq = generate(model, "xquery");
  assertStringIncludes(xq, 'xquery version "3.1"');
  assertStringIncludes(xq, "vitals");
  assertStringIncludes(xq, "element mapping-result");
  assertStringIncludes(xq, 'attribute id { "s1" }');
  assertStringIncludes(xq, "local:as-value");
  assertStringIncludes(xq, "DV_QUANTITY");
  assertStringIncludes(xq, "$source?systolic");
  assertStringIncludes(xq, "declare variable $defaults");
  assertStringIncludes(xq, "normalize-space");
  assertStringIncludes(xq, "concat(");

  const adapter = getExportTargetAdapter("xquery");
  assertEquals(adapter.extension, "xq");
  assertEquals(adapter.mime, "application/xquery");
});

Deno.test("xquery expression emit maps builtins and JSON paths", () => {
  assertEquals(
    jsonDollarPathToLookup("$.patient.vitals[1].systolic"),
    "$source?patient?vitals?1?systolic",
  );
  assertEquals(
    emitXQueryExpr(parseExpression('xpathString("/patient/name")')),
    'xs:string(($source/patient/name)[1])',
  );
  assertEquals(
    emitXQueryExpr(parseExpression('if(xpathBoolean("$.ok"), "a", "b")')),
    '(if (xs:boolean(($source?ok)[1])) then "a" else "b")',
  );
  assertEquals(
    emitXQueryExpr(parseExpression('maps_get("defaults", "language")')),
    '(if ("defaults" eq "defaults") then map:get($defaults, "language") else ())',
  );
  assertEquals(
    emitXQueryExpr(parseExpression('sheet_lookup("t", "code", "I10", "snomed")')),
    '(: sheet_lookup — bind $sheets at convert time :) ()',
  );
});

Deno.test("test runner evaluates json slot", () => {
  const model = applyExpressionEdit(createEmptyModel("vitals"), "s1", 'xpathNumber("$.systolic")', {
    rmType: "DV_QUANTITY",
    returnType: "number",
  });
  const result = runTest(model, JSON.stringify({ systolic: 120 }), "json");
  assertEquals(result.ok || (result.composition as Record<string, unknown>)?.slots !== undefined, true);
});

Deno.test("typescript codegen from BP skeleton uses ehrtslib constructors and lookups", async () => {
  const { model, skeleton, ts } = await mappedBpTypeScript();
  assertStringIncludes(ts, "new COMPOSITION({");
  assertStringIncludes(ts, 'from "ehrtslib/openehr_rm.ts"');
  assertStringIncludes(ts, "xpathNumber");
  assertStringIncludes(ts, "$.systolic");
  assertStringIncludes(ts, 'defaults["language"]');
  assertEquals(ts.includes("void evalExpr"), false);
  assertEquals(ts.includes("TODO: wire to RM path"), false);
  assertEquals(ts.includes("__evalGenerated"), false);
  assertEquals(ts.includes('"defaults" === "defaults"'), false);
  assertStringIncludes(ts, "convertSourceToComposition");
  assertStringIncludes(ts, "ISO_639-1::");
  assert(model.templateId.length > 0);
  assert(skeleton.length > 0);
});

Deno.test("Conversion Test Run JSON comes from the Target format handler, not generated TypeScript", async () => {
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const { model, skeleton, systolic, ts } = await mappedBpTypeScript();
  const target = getTargetFormatHandler("openehr-template").load("blood_pressure.opt", opt);
  const result = runTest(model, JSON.stringify({ systolic: 120 }), "json", { target });
  assertEquals(result.ok, true);
  const output = result.output as Record<string, unknown>;
  assertEquals(output._type, "COMPOSITION");
  assertEquals("slots" in output, false);
  const rendered = JSON.stringify(output);
  assertStringIncludes(rendered, "120");
  assertStringIncludes(ts, "new COMPOSITION({");
  assertEquals(typeof output.convertSourceToComposition, "undefined");
  assert(
    !rendered.includes("xpathNumber"),
    "Test Run JSON is a composition instance, not the generated script",
  );
  assert(systolic);
  assert(skeleton.length > 0);
});

Deno.test("TypeScript Output mode executes the generated conversion script", async () => {
  const { model, ts } = await mappedBpTypeScript();
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const target = getTargetFormatHandler("openehr-template").load("blood_pressure.opt", opt);
  const result = runTest(model, JSON.stringify({ systolic: 118 }), "json", {
    target,
    outputMode: "typescript",
    generatedCode: ts,
    defaults: { language: "en" },
  });
  assertEquals(result.error, undefined, result.error);
  const output = result.output as Record<string, unknown>;
  assertEquals(output._type, "COMPOSITION");
  assertStringIncludes(JSON.stringify(output), "118");
  const rm = runGeneratedTypeScript(ts, { format: "json", data: { systolic: 118 } }, {
    language: "en",
  });
  assertEquals((rm as { constructor: { name: string } }).constructor.name, "COMPOSITION");
  assertEquals((serializedConversionOutput(rm) as { _type?: string })._type, "COMPOSITION");
});

Deno.test("Java Output mode does not execute Conversion Test Run", () => {
  const model = createEmptyModel("vitals");
  const result = runTest(model, "{}", "json", { outputMode: "java" });
  assertEquals(result.ok, false);
  assertStringIncludes(String(result.output), "Java");
  assertStringIncludes(String(result.output), "not implemented");
});

Deno.test("typescript codegen from Blockly canvas updates when a source query is added", async () => {
  initBlocklyGenerators();
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const { templateId, skeleton } = generateSkeleton(opt);
  const systolic = collectValueSlots(skeleton).find((slot) =>
    slot.slotId.endsWith("items/at0004/value/value/value")
  );
  assert(systolic, "expected systolic value slot");

  const workspace = new Blockly.Workspace();
  try {
    const empty = createEmptyModel(templateId);
    empty.targetFormat = "openehr-template";
    loadSkeletonIntoWorkspace(workspace, skeleton, empty);

    const before = generateTypeScriptFromWorkspace(workspace, empty);
    assert(before, "expected generated TypeScript from skeleton canvas");
    assertStringIncludes(before, "new COMPOSITION({");
    assertEquals(before.includes("$.systolic"), false);
    assertStringIncludes(before, "Blockly canvas");
    assertStringIncludes(before, "mm[Hg]");
    assertStringIncludes(before, "new DV_CODED_TEXT");
    assertStringIncludes(before, "at1001");

    const mapped = applyExpressionEdit(empty, systolic.slotId, 'xpathNumber("$.systolic")', {
      rmType: systolic.rmType,
      returnType: "number",
      label: systolic.label,
    });
    loadSkeletonIntoWorkspace(workspace, skeleton, mapped);
    const after = generateTypeScriptFromWorkspace(workspace, mapped);
    assert(after, "expected generated TypeScript after mapping");
    assertStringIncludes(after, "xpathNumber");
    assertStringIncludes(after, "$.systolic");
    assertStringIncludes(after, "DV_QUANTITY");
    assertEquals(after.includes("void evalExpr"), false);

    const saved = Blockly.serialization.workspaces.save(workspace);
    const fromState = generateTypeScriptFromBlocklyState(saved, mapped);
    assert(fromState, "expected TypeScript from serialized Blockly state");
    assertStringIncludes(fromState, "$.systolic");

    const viaGenerate = generate(mapped, "typescript", {
      blocklyState: saved,
      skeleton,
    });
    assertStringIncludes(viaGenerate, "$.systolic");
    assertStringIncludes(viaGenerate, "new COMPOSITION({");
  } finally {
    workspace.dispose();
  }
});

Deno.test("typescript codegen updates after Import Suggestions apply to Blockly", async () => {
  initBlocklyGenerators();
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const { templateId, skeleton } = generateSkeleton(opt);
  const systolic = collectValueSlots(skeleton).find((slot) =>
    slot.slotId.endsWith("items/at0004/value/value/value")
  );
  assert(systolic, "expected systolic value slot");

  const workspace = new Blockly.Workspace();
  try {
    const empty = createEmptyModel(templateId);
    empty.targetFormat = "openehr-template";
    loadSkeletonIntoWorkspace(workspace, skeleton, empty);
    const staleState = Blockly.serialization.workspaces.save(workspace);

    const { model, report } = importSuggestions(empty, {
      format: "intehrgrator-suggestions",
      version: "2",
      target: { format: "openehr-template", targetId: templateId },
      suggestions: [{
        slotId: systolic.slotId,
        block: {
          type: "source_query_number",
          fields: { EXPRESSION: "$.systolic" },
        },
      }],
    }, new Set(collectAllSlotIds(skeleton)), new Map([
      [systolic.slotId, {
        rmType: systolic.rmType,
        returnType: "number",
        label: systolic.label,
        mandatory: systolic.mandatory,
      }],
    ]));
    assertEquals(report.applied, 1);
    assertEquals(model.slots[0]?.expression, 'xpathNumber("$.systolic")');

    const fromStaleCanvas = generate(model, "typescript", {
      blocklyState: staleState,
      skeleton,
    });
    assertEquals(
      fromStaleCanvas.includes("$.systolic"),
      false,
      "stale Blockly snapshot must not be treated as the applied mapping",
    );

    applyModelExpressions(workspace, model);
    const after = generateTypeScriptFromWorkspace(workspace, model);
    assert(after, "expected TypeScript after applying imported expressions to the canvas");
    assertStringIncludes(after, "xpathNumber");
    assertStringIncludes(after, "$.systolic");
    assertStringIncludes(after, "DV_QUANTITY");
    assertStringIncludes(after, "new COMPOSITION({");
    assertEquals(after.includes("void evalExpr"), false);
  } finally {
    workspace.dispose();
  }
});

Deno.test("generated TypeScript conversion script is executable with ehrtslib", async () => {
  const { ts } = await mappedBpTypeScript();
  const outDir = join(import.meta.dirname!, "..", "tmp");
  await Deno.mkdir(outDir, { recursive: true });
  const genPath = join(outDir, `generated_convert_${crypto.randomUUID()}.ts`);
  await Deno.writeTextFile(genPath, ts);
  try {
    const mod = await import(toFileUrl(genPath).href) as {
      convertSourceToComposition: (
        sourceCtx: { format: string; data: unknown },
        defaults?: Record<string, unknown>,
      ) => { language?: { code_string?: string }; content?: unknown };
    };
    const composition = mod.convertSourceToComposition(
      { format: "json", data: { systolic: 118, diastolic: 76 } },
      { language: "en", territory: "GB", time: "2026-08-25T10:00:00Z" },
    );
    assertEquals(composition?.constructor?.name, "COMPOSITION");
    const languageCode = composition.language?.code_string;
    assertEquals(languageCode, "en");
    const tree = JSON.stringify(composition);
    assertStringIncludes(tree, "118");
  } finally {
    await Deno.remove(genPath);
  }
});

async function mappedBpTypeScript() {
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const { templateId, skeleton } = generateSkeleton(opt);
  const systolic = collectValueSlots(skeleton).find((slot) =>
    slot.slotId.endsWith("items/at0004/value/value/value")
  );
  assert(systolic, "expected systolic value slot");
  let model = createEmptyModel(templateId);
  model.targetFormat = "openehr-template";
  model = applyExpressionEdit(model, systolic.slotId, 'xpathNumber("$.systolic")', {
    rmType: systolic.rmType,
    returnType: "number",
    label: systolic.label,
  });
  const language = collectValueSlots(skeleton).find((slot) =>
    slot.rmType === "CODE_PHRASE" && slot.slotId.includes("//language/")
  );
  if (language) {
    model = applyExpressionEdit(model, language.slotId, 'maps_get("defaults", "language")', {
      rmType: language.rmType,
      returnType: "string",
    });
  }
  const ts = generate(model, "typescript", { skeleton });
  return { model, skeleton, systolic, ts, templateId };
}
