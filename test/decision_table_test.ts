import { assertEquals, assertThrows } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import "blockly/blocks";
import { registerMapBlocks } from "@intehrgrator/blockly/blocks/map_blocks.ts";
import { registerDecisionTableBlocks } from "@intehrgrator/blockly/blocks/decision_table_blocks.ts";
import { setWorkspaceSheetsProvider } from "@intehrgrator/blockly/sheets_bridge.ts";
import { syncDecisionTableBlocksFromSheets } from "@intehrgrator/blockly/decision_table_sync.ts";
import { blockToExpression } from "@intehrgrator/blockly/expression_serialize.ts";
import { evaluate, createSourceContext } from "@intehrgrator/core/source/query_runtime.ts";
import { parseExpression, validateExpressionSource } from "@intehrgrator/core/expression/mod.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";
import {
  emptyDecisionTable,
  evaluateDecisionTable,
  isDontCare,
  lintDecisionTableSnippets,
  normalizeSheet,
  sheetsToBag,
} from "@intehrgrator/core/sheets/mod.ts";
import { checkVmsMustache } from "@intehrgrator/core/output/vms_hbs.ts";
import { generateTypeScript } from "@intehrgrator/core/codegen/mod.ts";
import { generateXQuery, XQueryExportError } from "@intehrgrator/core/codegen/xquery.ts";
import type { MappingModel } from "@intehrgrator/types/mod.ts";

/** Fixture: laterality × finding → value + VMS-Mustache snippet (don't-care on unused). */
const findings = normalizeSheet({
  name: "findings",
  kind: "decision-table",
  hitPolicy: "FIRST",
  collectJoin: "; ",
  headers: ["finding", "laterality", "term_id", "clause"],
  decisionColumns: [
    { role: "condition" },
    { role: "condition" },
    { role: "output", outputKind: "value" },
    { role: "output", outputKind: "snippet" },
  ],
  values: [
    ["effusion", "left", "T_LEFT", "{{laterality}} effusion"],
    ["effusion", "right", "T_RIGHT", "{{laterality}} effusion"],
    ["effusion", "—", "T_EFF", "effusion"],
    ["nodule", "—", "T_NOD", "{{finding}} present"],
  ],
});

const collectJoin = normalizeSheet({
  name: "positive_findings",
  kind: "decision-table",
  hitPolicy: "COLLECT",
  collectJoin: " and ",
  headers: ["flag", "snippet"],
  decisionColumns: [
    { role: "condition" },
    { role: "output", outputKind: "snippet" },
  ],
  values: [
    ["true", "{{name}}"],
    ["true", "also {{name}}"],
    ["false", "skip"],
  ],
});

function baseModel(expression: string, sheetNames?: string[]): MappingModel {
  return {
    modelVersion: 2,
    templateId: "t",
    slots: [{
      slotId: "note",
      rmType: "DV_TEXT",
      expression,
      returnType: "string",
    }],
    optionalRm: [],
    sheetNames,
  };
}

Deno.test("emptyDecisionTable defaults kind and FIRST hit policy", () => {
  const t = emptyDecisionTable("rules");
  assertEquals(t.kind, "decision-table");
  assertEquals(t.hitPolicy, "FIRST");
  assertEquals(t.decisionColumns?.every((c) => c.role === "condition" || c.role === "output"), true);
});

Deno.test("normalizeSheet preserves decision-table kind and column meta", () => {
  assertEquals(findings.kind, "decision-table");
  assertEquals(findings.hitPolicy, "FIRST");
  assertEquals(findings.decisionColumns?.[3]?.outputKind, "snippet");
});

Deno.test("isDontCare recognizes em dash, hyphen, star, empty", () => {
  assertEquals(isDontCare("—"), true);
  assertEquals(isDontCare("-"), true);
  assertEquals(isDontCare("*"), true);
  assertEquals(isDontCare(""), true);
  assertEquals(isDontCare(null), true);
  assertEquals(isDontCare("left"), false);
});

Deno.test("FIRST hit policy: don't-care row matches after specific rows", () => {
  const left = evaluateDecisionTable(findings, { finding: "effusion", laterality: "left" }, "term_id");
  assertEquals(left, "T_LEFT");
  const anyLat = evaluateDecisionTable(findings, { finding: "effusion", laterality: "bilateral" }, "term_id");
  assertEquals(anyLat, "T_EFF");
  const nodule = evaluateDecisionTable(findings, { finding: "nodule", laterality: "left" }, "term_id");
  assertEquals(nodule, "T_NOD");
});

Deno.test("snippet output interpolates local variable bindings (VMS-Mustache)", () => {
  const clause = evaluateDecisionTable(
    findings,
    { finding: "effusion", laterality: "left" },
    "clause",
  );
  assertEquals(clause, "left effusion");
  const nodule = evaluateDecisionTable(
    findings,
    { finding: "nodule", laterality: "x" },
    "clause",
  );
  assertEquals(nodule, "nodule present");
});

Deno.test("UNIQUE hit policy errors on overlapping matches", () => {
  const unique = normalizeSheet({
    ...findings,
    hitPolicy: "UNIQUE",
    values: [
      ["effusion", "—", "T1", "a"],
      ["effusion", "—", "T2", "b"],
    ],
  });
  assertThrows(
    () => evaluateDecisionTable(unique, { finding: "effusion", laterality: "left" }, "term_id"),
    Error,
    "UNIQUE",
  );
});

Deno.test("COLLECT joins matching snippet cells with collectJoin", () => {
  const out = evaluateDecisionTable(
    collectJoin,
    { flag: "true", name: "edema" },
    "snippet",
  );
  assertEquals(out, "edema and also edema");
});

Deno.test("lintDecisionTableSnippets uses checkVmsMustache", () => {
  const bad = normalizeSheet({
    ...findings,
    values: [["effusion", "left", "T", '{{#if (eq x "a")}}bad{{/if}}']],
  });
  const diags = lintDecisionTableSnippets(bad);
  assertEquals(diags.length > 0, true);
  assertEquals(checkVmsMustache('{{#if (eq x "a")}}bad{{/if}}').ok, false);
  assertEquals(lintDecisionTableSnippets(findings).length, 0);
});

Deno.test("decision_table is a Mapping Expression builtin", () => {
  const src =
    'decision_table("findings", map("finding", "effusion", "laterality", "left"), "term_id")';
  assertEquals(validateExpressionSource(src), null);
  const ast = parseExpression(src);
  assertEquals(ast.kind, "call");
  if (ast.kind === "call") assertEquals(ast.name, "decision_table");
});

Deno.test("decision_table expression evaluates via SourceContext.sheets bag", () => {
  const ctx = createSourceContext("{}", "json");
  ctx.sheets = sheetsToBag([findings]);
  assertEquals(
    evaluate(
      'decision_table("findings", map("finding", "effusion", "laterality", "left"), "clause")',
      ctx,
      "string",
    ),
    "left effusion",
  );
});

Deno.test("locals map decomposes complex sources for conditions + snippets", () => {
  const source = { imaging: { finding: "effusion", side: "right" } };
  const ctx = createSourceContext(JSON.stringify(source), "json");
  ctx.sheets = sheetsToBag([findings]);
  ctx.vars = {
    finding: "effusion",
    laterality: "right",
  };
  assertEquals(
    evaluate(
      'decision_table("findings", map("finding", var("finding"), "laterality", var("laterality")), "clause")',
      ctx,
      "string",
    ),
    "right effusion",
  );
});

Deno.test("Blockly decision_table block serializes to Mapping Expression", () => {
  registerMapBlocks();
  registerDecisionTableBlocks();
  const workspace = new Blockly.Workspace();
  try {
    const block = workspace.newBlock("decision_table");
    block.setFieldValue("findings", "NAME");
    block.setFieldValue("clause", "OUTPUT");
    const map = workspace.newBlock("maps_create_with") as Blockly.Block & {
      itemCount_: number;
      updateShape_: () => void;
    };
    map.itemCount_ = 2;
    map.updateShape_();
    map.setFieldValue("finding", "KEY0");
    map.setFieldValue("laterality", "KEY1");
    const f0 = workspace.newBlock("text");
    f0.setFieldValue("effusion", "TEXT");
    map.getInput("VAL0")?.connection?.connect(f0.outputConnection!);
    const f1 = workspace.newBlock("text");
    f1.setFieldValue("left", "TEXT");
    map.getInput("VAL1")?.connection?.connect(f1.outputConnection!);
    block.getInput("INPUTS")?.connection?.connect(map.outputConnection!);
    assertEquals(
      blockToExpression(block),
      'decision_table("findings", map("finding", "effusion", "laterality", "left"), "clause")',
    );
    assertEquals(block.getInputsInline(), false);
    const check = block.getInput("INPUTS")?.connection?.getCheck();
    assertEquals(Array.isArray(check) ? check.includes("Map") : check === "Map", true);
  } finally {
    workspace.dispose();
  }
});

Deno.test("schema sync rewrites locals Map keys from Decision table headers", () => {
  registerMapBlocks();
  registerDecisionTableBlocks();
  const sheet = emptyDecisionTable("Decision1");
  sheet.headers[0] = "age";
  sheet.headers[1] = "weight";
  setWorkspaceSheetsProvider(() => [sheet]);
  const workspace = new Blockly.Workspace();
  try {
    const block = workspace.newBlock("decision_table");
    const map = workspace.newBlock("maps_create_with") as Blockly.Block & {
      itemCount_: number;
      updateShape_: () => void;
    };
    map.itemCount_ = 2;
    map.updateShape_();
    map.setFieldValue("in1", "KEY0");
    map.setFieldValue("in2", "KEY1");
    block.getInput("INPUTS")?.connection?.connect(map.outputConnection!);
    syncDecisionTableBlocksFromSheets(workspace, [sheet]);
    assertEquals(map.getFieldValue("KEY0"), "age");
    assertEquals(map.getFieldValue("KEY1"), "weight");
  } finally {
    setWorkspaceSheetsProvider(null);
    workspace.dispose();
  }
});

Deno.test("TypeScript codegen emits decisionTable helper call", () => {
  const model = baseModel(
    'decision_table("findings", map("finding", "effusion", "laterality", "left"), "term_id")',
    ["findings"],
  );
  const code = generateTypeScript(model);
  assertEquals(code.includes("decisionTable("), true);
  assertEquals(code.includes("function decisionTable"), true);
});

Deno.test("XQuery export rejects decision_table with a clear export error", () => {
  const model = baseModel(
    'decision_table("findings", map("finding", "effusion", "laterality", "left"), "term_id")',
  );
  assertThrows(() => generateXQuery(model), XQueryExportError, "decision_table");
});

Deno.test("Test Run evaluates decision_table against project sheets", () => {
  const model = baseModel(
    'decision_table("findings", map("finding", "effusion", "laterality", "left"), "clause")',
    ["findings"],
  );
  const result = runTest(model, "{}", "json", { sheets: [findings] });
  assertEquals(result.ok, true);
  const output = result.output as { slots?: Record<string, unknown> };
  assertEquals(output.slots?.note, "left effusion");
});
