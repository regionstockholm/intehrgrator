import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { generate } from "@intehrgrator/core/codegen/mod.ts";
import {
  findBasexExecutable,
  materializeXQueryExternals,
  runXQueryOnBasex,
} from "@intehrgrator/core/codegen/xquery_engine.ts";
import { applyExpressionEdit, createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";

const basex = findBasexExecutable();

Deno.test("materializeXQueryExternals rewrites external maps to parse-json", () => {
  const script = [
    'declare variable $source external;',
    'declare variable $defaults as map(*) external := map {};',
    'declare variable $sheets as map(*) external := map {};',
    "local:convert($source)",
  ].join("\n");
  const out = materializeXQueryExternals(script, {
    sourceUri: "file:///tmp/source.json",
    defaultsUri: "file:///tmp/defaults.json",
    sheetsUri: "file:///tmp/sheets.json",
  });
  assertStringIncludes(out, 'parse-json(unparsed-text("file:///tmp/source.json"))');
  assertStringIncludes(out, "defaults.json");
  assertStringIncludes(out, "sheets.json");
  assertEquals(out.includes("$source external"), false);
});

Deno.test("materializeXQueryExternals matches generate() external declarations", () => {
  const xq = generate(createEmptyModel("vitals"), "xquery");
  const out = materializeXQueryExternals(xq, {
    sourceUri: "file:///tmp/source.json",
    sheetsUri: "file:///tmp/sheets.json",
  });
  assertEquals(out.includes("$source external"), false);
  assertStringIncludes(out, 'parse-json(unparsed-text("file:///tmp/source.json"))');
  assertStringIncludes(out, 'parse-json(unparsed-text("file:///tmp/sheets.json"))');
  assertStringIncludes(out, "declare variable $defaults as map(*) := map {};");
});

Deno.test({
  name: "BaseX executes generated XQuery for-each and sheet lookup when installed",
  ignore: !basex,
  fn: async () => {
    const model = applyExpressionEdit(
      createEmptyModel("vitals-series"),
      "slot/rate",
      'xpathNumber("pulse")',
      { rmType: "DV_QUANTITY", returnType: "number" },
    );
    model.slots.push({
      slotId: "slot/term",
      rmType: "DV_TEXT",
      expression: 'sheet_lookup("icd10_snomed", "code", "I10", "snomed")',
      returnType: "string",
    });
    model.loops = [{
      attachSlotId: "slot/rate",
      varName: "measurements",
      path: "$.measurements",
      kind: "source",
    }];
    const xq = generate(model, "xquery");
    assertStringIncludes(xq, "for $measurements in");
    const result = await runXQueryOnBasex(xq, {
      source: { measurements: [{ pulse: 72 }, { pulse: 80 }] },
      sheets: {
        icd10_snomed: {
          headers: ["code", "snomed"],
          values: [["I10", "38341003"]],
        },
      },
    }, { basex: basex! });
    assertEquals(result.ok, true, result.stderr || result.stdout);
    assertStringIncludes(result.stdout, "72");
    assertStringIncludes(result.stdout, "80");
    assertStringIncludes(result.stdout, "38341003");
    assert(result.stdout.includes('xsi:type="DV_QUANTITY"') || result.stdout.includes("xsi:type=\"DV_QUANTITY\"") ||
      result.stdout.includes("DV_QUANTITY"));
  },
});
