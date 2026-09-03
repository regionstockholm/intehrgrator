import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import { renderHandlebars } from "@intehrgrator/core/output/handlebars_dialect.ts";
import {
  extractHandlebarsPaths,
  handlebarsTemplateToBlocklyState,
  toFontoxpathHint,
} from "@intehrgrator/core/output/handlebars_to_blockly.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { getTargetFormatHandler } from "@intehrgrator/core/target/mod.ts";
import { projectBlocklyState } from "@intehrgrator/workbench/mapping_spec/mod.ts";

const fixtureDir = join(import.meta.dirname!, "fixtures", "kintegrate");

async function readFixture(name: string): Promise<string> {
  return await Deno.readTextFile(join(fixtureDir, name));
}

Deno.test("Kintegrate intro.json (plain JSON) Handlebars tips block", async () => {
  const source = await readFixture("intro.json");
  const template = await readFixture("intro_tips.hbs");
  const output = renderHandlebars(template, JSON.parse(source));

  assertStringIncludes(
    output,
    "Generate hierarchical nesting structure showing or iterating over this node",
  );
  assertStringIncludes(output, "Click a checkbox in the tree to select a node");
  assertStringIncludes(output, "Right-click to pop up a menu");
  assertStringIncludes(output, "----- Start -----");
  assertStringIncludes(output, "----- The end -----");
});

Deno.test("Kintegrate MDK_Rek_demo1.json (openEHR STRUCTURED) Handlebars clinical block", async () => {
  const source = await readFixture("MDK_Rek_demo1.json");
  const template = await readFixture("mdk_rek_demo.hbs");
  const output = renderHandlebars(template, JSON.parse(source));

  assertStringIncludes(output, "andnöd vid ansträngning, smärta");
  assertStringIncludes(output, "FEV1/FVC: 69");
  assertStringIncludes(output, "FEV1/FVC kvot är under 70%");
  assertStringIncludes(output, "Dr Dängroth");
  assertStringIncludes(output, "Dr Alban");
});

Deno.test("intro Handlebars → Blockly path inventory matches saved one-time conversion", async () => {
  const template = await readFixture("intro_tips.hbs");
  const refs = extractHandlebarsPaths(template);
  assert(refs.some((ref) => ref.path.includes("Right_click_explanations")));
  assert(refs.some((ref) => ref.kind === "each" && ref.path.includes("tip_array")));

  const generated = handlebarsTemplateToBlocklyState(template);
  const saved = JSON.parse(await readFixture("intro_tips.blockly.json"));
  assertEquals(generated, saved);

  const projection = projectBlocklyState(saved);
  assertStringIncludes(projection.text, "source_query");
  assertStringIncludes(projection.text, "for_each_source");
});

Deno.test("MDK Handlebars → Blockly path inventory includes FLAT |value keys", async () => {
  const template = await readFixture("mdk_rek_demo.hbs");
  const generated = handlebarsTemplateToBlocklyState(template);
  const saved = JSON.parse(await readFixture("mdk_rek_demo.blockly.json"));
  assertEquals(generated, saved);

  const blocks = saved.blocks.blocks as Array<{ type: string; fields?: Record<string, string> }>;
  const expressions = blocks
    .filter((block) => block.type === "source_query")
    .map((block) => block.fields?.EXPRESSION ?? "");

  assert(
    expressions.some((expr) => expr.includes("|value")),
    `expected a |value path, got: ${expressions.slice(0, 8).join(" | ")}`,
  );
  assertEquals(toFontoxpathHint("starter_tips.tip_array"), "$.starter_tips.tip_array");
  assertEquals(toFontoxpathHint("namn.0.[|value]"), '$.namn[1]["|value"]');
  assertEquals(
    toFontoxpathHint("starter_tips.tip_object.Right_click_explanations.[⤡]"),
    '$.starter_tips.tip_object.Right_click_explanations["⤡"]',
  );
});

Deno.test("Workbench-style Test Run: intro free-form Handlebars dialect", async () => {
  const source = await readFixture("intro.json");
  const template = await readFixture("intro_tips.hbs");
  const target = getTargetFormatHandler("free-form").load("intro_tips.hbs", template);
  const model = createEmptyModel(target.targetId);
  model.targetFormat = "free-form";
  const result = runTest(model, source, "json", {
    target,
    exportTarget: "handlebars",
    handlebarsTemplate: template,
  });
  assertEquals(result.ok, true);
  assertStringIncludes(String(result.output), "Click a checkbox");
});

Deno.test("Workbench-style Test Run: MDK openEHR-as-source + Handlebars", async () => {
  const source = await readFixture("MDK_Rek_demo1.json");
  const template = await readFixture("mdk_rek_demo.hbs");
  const target = getTargetFormatHandler("free-form").load("mdk_rek_demo.hbs", template);
  const model = createEmptyModel(target.targetId);
  model.targetFormat = "free-form";
  const result = runTest(model, source, "openehr-structured-json", {
    target,
    exportTarget: "handlebars",
    handlebarsTemplate: template,
  });
  assertEquals(result.ok, true);
  assertStringIncludes(String(result.output), "FEV1/FVC: 69");
  assertStringIncludes(String(result.output), "Dr Dängroth");
});

Deno.test("Kintegrate emergency-ward + air-oxygenation Handlebars block", async () => {
  const source = await readFixture("emergency-ward-example-20260212.json");
  const template = await readFixture("air-oxygenation.hbs");
  const output = renderHandlebars(template, JSON.parse(source));

  assertStringIncludes(output, "Syresättning 98");
  assertStringIncludes(output, "Andningsfrekvens: 16 /min");
  assertStringIncludes(output, "Tillförd syrgas: 6 l/min");
});

Deno.test("Full handlebars-script1.hbs: intro tip block on intro.json", async () => {
  const source = await readFixture("intro.json");
  const template = await readFixture("handlebars-script1.hbs");
  const output = renderHandlebars(template, JSON.parse(source));

  assertStringIncludes(output, "----- Start -----");
  assertStringIncludes(
    output,
    "Generate hierarchical nesting structure showing or iterating over this node",
  );
  assertStringIncludes(output, "Click a checkbox in the tree to select a node");
  assertStringIncludes(output, "----- The end -----");
  assertStringIncludes(output, "----- Another example block -----");
});

Deno.test("Full handlebars-script1.hbs: MDK clinical block on MDK_Rek_demo1.json", async () => {
  const source = await readFixture("MDK_Rek_demo1.json");
  const template = await readFixture("handlebars-script1.hbs");
  const output = renderHandlebars(template, JSON.parse(source));

  assertStringIncludes(output, "andnöd vid ansträngning, smärta");
  assertStringIncludes(output, "FEV1/FVC: 69");
  assertStringIncludes(output, "FEV1/FVC kvot är under 70%");
  assertStringIncludes(output, "Dr Dängroth");
  assertStringIncludes(output, "Dr Alban");
});

Deno.test("Full handlebars-script1.hbs → Blockly path inventory is regeneratable", async () => {
  const template = await readFixture("handlebars-script1.hbs");
  const generated = handlebarsTemplateToBlocklyState(template);
  const saved = JSON.parse(await readFixture("handlebars-script1.blockly.json"));
  assertEquals(generated, saved);

  const projection = projectBlocklyState(saved);
  assertStringIncludes(projection.text, "source_query");
  assertStringIncludes(projection.text, "for_each_source");
});

Deno.test("Workbench-style Test Run: emergency-ward free-form Handlebars", async () => {
  const source = await readFixture("emergency-ward-example-20260212.json");
  const template = await readFixture("air-oxygenation.hbs");
  const target = getTargetFormatHandler("free-form").load("air-oxygenation.hbs", template);
  const model = createEmptyModel(target.targetId);
  model.targetFormat = "free-form";
  const result = runTest(model, source, "openehr-structured-json", {
    target,
    exportTarget: "handlebars",
    handlebarsTemplate: template,
  });
  assertEquals(result.ok, true);
  assertStringIncludes(String(result.output), "Syresättning 98");
});

Deno.test("extractHandlebarsPaths handles {{~#with and {{~#each (whitespace trim markers)", () => {
  const template = `{{~#with granskning}}
  {{~#each bakgrund}}
    {{namn}}
  {{/each}}
{{/with}}`;
  const paths = extractHandlebarsPaths(template);
  const kinds = paths.map((p) => p.kind);
  assert(kinds.includes("with"), "should extract {{~#with as a with path");
  assert(kinds.includes("each"), "should extract {{~#each as an each path");
  const pathStrings = paths.map((p) => p.path);
  assert(pathStrings.includes("granskning"), "with path should be granskning");
  assert(pathStrings.includes("bakgrund"), "each path should be bakgrund");
});
