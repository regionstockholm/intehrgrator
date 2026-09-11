import { assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import {
  applyExpressionEdit,
  createEmptyModel,
} from "@intehrgrator/core/mapping_model/mod.ts";
import {
  basexAvailable,
  jsonToBasexMapExpr,
  runGeneratedXQuery,
} from "../scripts/run-xquery-basex.ts";

const hasBasex = await basexAvailable();

Deno.test("jsonToBasexMapExpr builds map and array literals", () => {
  assertStringIncludes(
    jsonToBasexMapExpr({ measurements: [{ pulse: 72 }] }),
    "measurements",
  );
  assertStringIncludes(jsonToBasexMapExpr({ measurements: [{ pulse: 72 }] }), "array {");
  assertEquals(jsonToBasexMapExpr("x"), '"x"');
});

Deno.test({
  name: "BaseX runs for_each_source XQuery export against JSON fixture",
  ignore: !hasBasex,
  fn: async () => {
    let model = createEmptyModel("vitals-series");
    model.loops = [{
      attachSlotId: "evt-1",
      varName: "measurements",
      path: "$.measurements",
      kind: "source",
    }];
    model = applyExpressionEdit(model, "slot/rate", 'xpathNumber("pulse")', {
      rmType: "DV_QUANTITY",
      returnType: "number",
    });
    model.targetSignature = [{
      slotId: "evt-1",
      rmType: "EVENT",
      children: [{ slotId: "slot/rate", rmType: "DV_QUANTITY", children: [] }],
    }];

    const instance = JSON.parse(
      await Deno.readTextFile(
        join(
          import.meta.dirname!,
          "fixtures",
          "legacy-simulated-json",
          "instances-series",
          "bp-series-inst.json",
        ),
      ),
    );

    const xml = await runGeneratedXQuery(model, instance);
    assertStringIncludes(xml, "mapping-result");
    assertStringIncludes(xml, 'slot id="slot/rate"');
    assertStringIncludes(xml, "72");
    assertStringIncludes(xml, "76");
    const slotCount = (xml.match(/slot id="slot\/rate"/g) ?? []).length;
    assertEquals(slotCount, 3, "expected one slot per measurement item");
  },
});

Deno.test({
  name: "BaseX runs flat slot XQuery export",
  ignore: !hasBasex,
  fn: async () => {
    const model = applyExpressionEdit(
      createEmptyModel("vitals"),
      "s1",
      'xpathNumber("$.systolic")',
      { rmType: "DV_QUANTITY", returnType: "number" },
    );
    const xml = await runGeneratedXQuery(model, { systolic: 120 });
    assertStringIncludes(xml, 'slot id="s1"');
    assertStringIncludes(xml, ">120<");
  },
});
