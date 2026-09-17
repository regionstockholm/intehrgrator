import { assertEquals, assert, assertStringIncludes } from "@std/assert";
import { renderHandlebars } from "@intehrgrator/core/output/handlebars_dialect.ts";
import {
  compileVmsHbs,
  renderCompiledVmsHbs,
} from "@intehrgrator/core/output/vms_hbs_compile.ts";

const LUNG_MDT_SHAPED_HBS = `{{#if granskning.imaging.[0].[|value]}}
{{#if (eq (toLowerCase modality) "mr")}}MR{{else}}CT{{/if}}
{{#each findings}}{{@index}}: {{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}`;

Deno.test("compileVmsHbs accepts a greeting interpolation", () => {
  const program = compileVmsHbs("Hello {{name}}!");
  assert(program, "expected compile success");
  assertEquals(program.body.length > 0, true);
});

Deno.test("compiled VMS-Hbs greeting matches Handlebars runtime", () => {
  const source = "Hello {{name}}!";
  const ctx = { name: "Ada" };
  assertEquals(renderCompiledVmsHbs(source, ctx), renderHandlebars(source, ctx));
  assertEquals(renderCompiledVmsHbs(source, ctx), "Hello Ada!");
});

Deno.test("compiled VMS-Hbs interpolations match Handlebars noEscape", () => {
  const source = "{{name}}";
  const ctx = { name: "<Ada>" };
  assertEquals(renderCompiledVmsHbs(source, ctx), renderHandlebars(source, ctx));
  assertEquals(renderCompiledVmsHbs(source, ctx), "<Ada>");
});

Deno.test("compiled VMS-Hbs lung-MDT-shaped snippet matches Handlebars runtime", () => {
  const ctx = {
    granskning: { imaging: [{ "|value": "yes" }] },
    modality: "MR",
    findings: ["a", "b"],
  };
  const native = renderCompiledVmsHbs(LUNG_MDT_SHAPED_HBS, ctx);
  const hbs = renderHandlebars(LUNG_MDT_SHAPED_HBS, ctx);
  assertEquals(native, hbs);
  assertStringIncludes(native ?? "", "MR");
  assertStringIncludes(native ?? "", "0: a, 1: b");
});

Deno.test("compileVmsHbs rejects {{#with}} (falls back to Handlebars runtime)", () => {
  assertEquals(compileVmsHbs("{{#with patient}}{{name}}{{/with}}"), null);
  assertEquals(renderCompiledVmsHbs("{{#with patient}}{{name}}{{/with}}", { patient: { name: "Ada" } }), null);
});
