import { assertEquals } from "@std/assert";
import {
  addDecisionColumn,
  alignMapKeys,
  blocklyCheckForDecisionOutput,
  coerceOutputValue,
  conditionHeaders,
  DECISION_ALL_OUTPUTS,
  emptyDecisionTable,
  evaluateDecisionTable,
  outputHeaders,
  previewGrid,
  setDecisionHeader,
  setDecisionValueType,
  trimDecisionTableSpareColumns,
} from "@intehrgrator/core/sheets/mod.ts";
import { normalizeSheet } from "@intehrgrator/core/sheets/mod.ts";

Deno.test("emptyDecisionTable has named condition/output headers only (no spare letter columns)", () => {
  const t = emptyDecisionTable("rules");
  assertEquals(t.headers, ["in1", "in2", "out"]);
  assertEquals(t.headers.length, 3);
  assertEquals(t.values[0]?.length, 3);
  assertEquals(conditionHeaders(t), ["in1", "in2"]);
  assertEquals(outputHeaders(t), ["out"]);
});

Deno.test("trimDecisionTableSpareColumns drops trailing empty letter headers", () => {
  const padded = normalizeSheet({
    name: "rules",
    kind: "decision-table",
    headers: ["in1", "in2", "out", "D", "E"],
    decisionColumns: [
      { role: "condition" },
      { role: "condition" },
      { role: "output", outputKind: "value" },
    ],
    values: [
      ["a", "b", "c", "", ""],
      ["", "", "", "", ""],
    ],
  });
  const trimmed = trimDecisionTableSpareColumns(padded);
  assertEquals(trimmed.headers, ["in1", "in2", "out"]);
});

Deno.test("trimDecisionTableSpareColumns keeps a letter header that has data", () => {
  const sheet = normalizeSheet({
    name: "rules",
    kind: "decision-table",
    headers: ["in1", "out", "D"],
    decisionColumns: [
      { role: "condition" },
      { role: "output" },
      { role: "output" },
    ],
    values: [["x", "1", "keep"]],
  });
  assertEquals(trimDecisionTableSpareColumns(sheet).headers, ["in1", "out", "D"]);
});

Deno.test("alignMapKeys keeps indices on rename and matches names on insert", () => {
  assertEquals(alignMapKeys(["in1", "in2"], ["age", "in2"]), [0, 1]);
  assertEquals(alignMapKeys(["in1", "in2"], ["x", "in1", "in2"]), [null, 0, 1]);
  assertEquals(alignMapKeys(["in1", "in2"], ["in1", "in2", "x"]), [0, 1, null]);
  assertEquals(alignMapKeys(["in1", "in2", "in3"], ["in2", "in3"]), [1, 2]);
});

Deno.test("setDecisionHeader renames a condition column in the document", () => {
  const next = setDecisionHeader(emptyDecisionTable("rules"), 0, "age");
  assertEquals(conditionHeaders(next), ["age", "in2"]);
});

Deno.test("addDecisionColumn grows conditions before the first output", () => {
  const next = addDecisionColumn(emptyDecisionTable("rules"), "condition");
  assertEquals(conditionHeaders(next), ["in1", "in2", "in3"]);
  assertEquals(outputHeaders(next), ["out"]);
  const twoOut = addDecisionColumn(emptyDecisionTable("rules"), "output");
  assertEquals(outputHeaders(twoOut), ["out", "out2"]);
});

Deno.test("coerceOutputValue follows the column type", () => {
  assertEquals(coerceOutputValue("18", "number"), 18);
  assertEquals(coerceOutputValue("true", "boolean"), true);
  assertEquals(coerceOutputValue(9, "string"), "9");
});

Deno.test("evaluateDecisionTable returns a Map of outputs when output is *", () => {
  const sheet = normalizeSheet({
    name: "findings",
    kind: "decision-table",
    hitPolicy: "FIRST",
    headers: ["finding", "term_id", "clause"],
    decisionColumns: [
      { role: "condition" },
      { role: "output", outputKind: "value", valueType: "string" },
      { role: "output", outputKind: "snippet" },
    ],
    values: [["effusion", "T_LEFT", "{{finding}} yes"]],
  });
  const rec = evaluateDecisionTable(sheet, { finding: "effusion" }, DECISION_ALL_OUTPUTS) as Record<
    string,
    unknown
  >;
  assertEquals(rec.term_id, "T_LEFT");
  assertEquals(rec.clause, "effusion yes");
});

Deno.test("evaluateDecisionTable coerces a numeric output column", () => {
  const sheet = setDecisionValueType(emptyDecisionTable("bmi"), 2, "number");
  sheet.values[0] = ["adult", "m", "22"];
  sheet.headers[0] = "group";
  sheet.headers[1] = "sex";
  const n = evaluateDecisionTable(sheet, { group: "adult", sex: "m" }, "out");
  assertEquals(n, 22);
});

Deno.test("blocklyCheckForDecisionOutput is Map for all-outputs and typed for a column", () => {
  const sheet = setDecisionValueType(emptyDecisionTable("bmi"), 2, "number");
  assertEquals(blocklyCheckForDecisionOutput(sheet, DECISION_ALL_OUTPUTS), "Map");
  assertEquals(blocklyCheckForDecisionOutput(sheet, "out"), "Number");
});

Deno.test("previewGrid is a 3x3 window of headers plus first data rows", () => {
  const sheet = emptyDecisionTable("rules");
  sheet.values[0] = ["a", "b", "c"];
  const preview = previewGrid(sheet);
  assertEquals(preview.headers, ["in1", "in2", "out"]);
  assertEquals(preview.rows[0], ["a", "b", "c"]);
  assertEquals(preview.rows.length <= 3, true);
});
