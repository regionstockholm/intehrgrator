import { assertEquals, assert } from "@std/assert";
import {
  checkVmsHbs,
  checkVmsMustache,
  isVmsHbs,
} from "@intehrgrator/core/output/vms_hbs.ts";
import {
  checkVmsGo,
  isVmsGo,
} from "@intehrgrator/core/output/vms_go.ts";
import { ensureGoTemplateWasm } from "@intehrgrator/core/output/go_template_runtime.ts";

/** Lung-MDT-shaped Handlebars: presence #if, bracket FLAT keys, eq, toLowerCase, each. */
const LUNG_MDT_SHAPED_HBS = `{{#if granskning.imaging.[0].[|value]}}
{{#if (eq (toLowerCase modality) "mr")}}MR{{else}}CT{{/if}}
{{#each findings}}{{@index}}: {{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}`;

/** Hostile Handlebars: #with / lookup must warn. */
const HOSTILE_HBS_WITH = `{{#with patient}}{{name}}{{/with}}`;
const HOSTILE_HBS_LOOKUP = `{{lookup map key}}`;

/** Chemo-shaped Go: if/eq/index, curated FuncMap, acyclic define. */
const CHEMO_SHAPED_GO = `{{- define "cleanAndQuoteFreeTextInput" -}}
  {{- $input := . -}}
  {{- $step1 := $input | replace "\\n" " " | trim -}}
  {{- $step1 | quote -}}
{{- end -}}
{{if eq (index .Data "symptom|value") "yes"}}
{{template "cleanAndQuoteFreeTextInput" (index .Data "note|value")}}
{{end}}`;

const HOSTILE_GO_CALL = `{{call .Fn "x"}}`;
const HOSTILE_GO_WITH = `{{with .Patient}}{{.Name}}{{end}}`;

Deno.test("VMS-Hbs: lung-MDT-shaped snippet does not warn", () => {
  const result = checkVmsHbs(LUNG_MDT_SHAPED_HBS);
  assertEquals(result.ok, true, JSON.stringify(result.diagnostics));
  assertEquals(isVmsHbs(LUNG_MDT_SHAPED_HBS), true);
});

Deno.test("VMS-Hbs: {{#with}} and lookup warn", () => {
  const withResult = checkVmsHbs(HOSTILE_HBS_WITH);
  assertEquals(withResult.ok, false);
  assert(withResult.diagnostics.some((d) => /with/i.test(d.message)));

  const lookupResult = checkVmsHbs(HOSTILE_HBS_LOOKUP);
  assertEquals(lookupResult.ok, false);
  assert(lookupResult.diagnostics.some((d) => /lookup/i.test(d.message)));
});

Deno.test("VMS-Mustache rejects helpers used by VMS-Hbs", () => {
  const ok = checkVmsMustache("{{regim}} {{#items}}{{.}}{{/items}}");
  assertEquals(ok.ok, true, JSON.stringify(ok.diagnostics));

  const bad = checkVmsMustache('{{#if (eq x "MR")}}yes{{/if}}');
  assertEquals(bad.ok, false);
});

Deno.test("VMS-Go: chemo-shaped snippet does not warn", async () => {
  await ensureGoTemplateWasm();
  const result = await checkVmsGo(CHEMO_SHAPED_GO);
  assertEquals(result.ok, true, JSON.stringify(result.diagnostics));
  assertEquals(await isVmsGo(CHEMO_SHAPED_GO), true);
});

Deno.test("VMS-Go: {{call}} and {{with}} warn", async () => {
  await ensureGoTemplateWasm();
  const callResult = await checkVmsGo(HOSTILE_GO_CALL);
  assertEquals(callResult.ok, false);
  assert(callResult.diagnostics.some((d) => /call/i.test(d.message)));

  const withResult = await checkVmsGo(HOSTILE_GO_WITH);
  assertEquals(withResult.ok, false);
  assert(withResult.diagnostics.some((d) => /with/i.test(d.message)));
});
