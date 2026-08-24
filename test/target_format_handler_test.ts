import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  detectTargetFormat,
  getTargetFormatHandler,
  listTargetFormatIds,
} from "@intehrgrator/core/target/mod.ts";
import {
  buildHandlebarsPath,
  buildHandlebarsTree,
  renderHandlebars,
} from "@intehrgrator/core/output/handlebars_dialect.ts";
import {
  applyExpressionEdit,
  createEmptyModel,
} from "@intehrgrator/core/mapping_model/mod.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";

Deno.test("target format handlers cover structured and free-form outputs", () => {
  assertEquals(listTargetFormatIds(), [
    "openehr-template",
    "json-schema",
    "xml-schema",
    "free-form",
  ]);
  assertEquals(detectTargetFormat("target.schema.json", '{"type":"object"}'), "json-schema");
  assertEquals(detectTargetFormat("target.xsd", ""), "xml-schema");
  assertEquals(detectTargetFormat("summary.hbs", ""), "free-form");
});

Deno.test("JSON Schema target produces mappable tree and object output", () => {
  const schema = JSON.stringify({
    $id: "patient-summary",
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string" },
      age: { type: "integer" },
    },
  });
  const target = getTargetFormatHandler("json-schema").load("summary.json", schema);
  const nameSlot = target.skeleton[0].children.find((node) => node.label === "name")!;
  let model = createEmptyModel(target.targetId);
  model.targetFormat = target.format;
  model = applyExpressionEdit(model, nameSlot.slotId, 'xpathString("$.patient.name")', {
    rmType: "string",
    returnType: "string",
  });
  const result = runTest(
    model,
    JSON.stringify({ patient: { name: "Ada" } }),
    "json",
    { target },
  );
  assertEquals(result.ok, true);
  assertEquals(result.output, { name: "Ada" });
});

Deno.test("XML Schema target renders XML", () => {
  const xsd = `<?xml version="1.0"?>
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:element name="message">
        <xs:complexType><xs:sequence>
          <xs:element name="text" type="xs:string"/>
        </xs:sequence></xs:complexType>
      </xs:element>
    </xs:schema>`;
  const target = getTargetFormatHandler("xml-schema").load("message.xsd", xsd);
  const textSlot = target.skeleton[0].children[0]!;
  let model = createEmptyModel(target.targetId);
  model.targetFormat = target.format;
  model = applyExpressionEdit(model, textSlot.slotId, 'xpathString("$.text")', {
    rmType: "string",
    returnType: "string",
  });
  const result = runTest(model, '{"text":"A & B"}', "json", { target });
  assertEquals(result.output, "<message><text>A &amp; B</text></message>");
});

Deno.test("XML Schema target uses xml:lang documentation as labels", () => {
  const xsd = `<?xml version="1.0"?>
    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
      <xs:element name="report">
        <xs:annotation>
          <xs:documentation xml:lang="en">Accident report</xs:documentation>
          <xs:documentation xml:lang="sv">Olycksrapport</xs:documentation>
        </xs:annotation>
        <xs:complexType><xs:sequence>
          <xs:element name="injury" type="xs:string">
            <xs:annotation>
              <xs:documentation xml:lang="en">Injury</xs:documentation>
              <xs:documentation xml:lang="sv">Skada</xs:documentation>
            </xs:annotation>
          </xs:element>
        </xs:sequence></xs:complexType>
      </xs:element>
    </xs:schema>`;
  const en = getTargetFormatHandler("xml-schema").load("report.xsd", xsd, { language: "en" });
  const sv = getTargetFormatHandler("xml-schema").load("report.xsd", xsd, { language: "sv" });
  assertEquals(en.languages?.sort(), ["en", "sv"]);
  assertEquals(en.skeleton[0].label, "Accident report");
  assertEquals(en.skeleton[0].children[0]?.label, "Injury");
  assertEquals(sv.skeleton[0].label, "Olycksrapport");
  assertEquals(sv.skeleton[0].children[0]?.label, "Skada");
});

Deno.test("Kintegrate Handlebars helpers and openEHR keys remain compatible", () => {
  const output = renderHandlebars(
    "{{toUpperCase patient.name}}: {{#if (gte patient.score 5)}}ok{{/if}}",
    { patient: { name: "Ada", score: 7 } },
  );
  assertEquals(output, "ADA: ok");
  assertEquals(
    buildHandlebarsPath('$["ctx/language"]'),
    "[ctx/language]",
  );
  assertEquals(
    buildHandlebarsTree("$.patient.name"),
    "{{#with patient}}\n  {{name}}\n{{/with}}",
  );
  assertEquals(
    buildHandlebarsTree("$.items[1].label"),
    "{{#each items}}\n  {{label}}\n{{/each}}",
  );
  assertEquals(
    buildHandlebarsTree('$.akutmall.abcde[1].spo[1]["|numerator"]'),
    "{{#with akutmall}}\n  {{#each abcde}}\n    {{#each spo}}\n      {{[|numerator]}}\n    {{/each}}\n  {{/each}}\n{{/with}}",
  );
  assertStringIncludes(
    renderHandlebars("{{{json (slot \"target:name\")}}}", {}, {
      slots: { "target:name": "Ada" },
    }),
    '"Ada"',
  );
});

Deno.test("Handlebars Test Run can walk source without a structured target", () => {
  const model = createEmptyModel("narrative");
  model.targetFormat = "free-form";
  const result = runTest(
    model,
    JSON.stringify({ patient: { name: "Ada", score: 7 } }),
    "json",
    {
      exportTarget: "handlebars",
      handlebarsTemplate:
        "{{toUpperCase patient.name}} score={{patient.score}}{{#if (gte patient.score 5)}} ok{{/if}}",
    },
  );
  assertEquals(result.ok, true);
  assertEquals(result.output, "ADA score=7 ok");
});
