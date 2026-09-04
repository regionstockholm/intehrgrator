import { assertEquals, assertThrows } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import "blockly/blocks";
import { registerSheetBlocks } from "@intehrgrator/blockly/blocks/sheet_blocks.ts";
import { blockToExpression } from "@intehrgrator/blockly/expression_serialize.ts";
import { evaluate, createSourceContext } from "@intehrgrator/core/source/query_runtime.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";
import {
  coordsToA1,
  emptySheet,
  getCellA1,
  insertColumn,
  insertRow,
  normalizeSheet,
  parseA1,
  parseSpreadsheetText,
  setCellA1,
  sheetLookup,
  sheetToCsv,
  sheetsToBag,
  applySheetMutator,
  evalSheetCall,
} from "@intehrgrator/core/sheets/mod.ts";
import { fireSheetChange } from "@intehrgrator/workbench/sheet_undo.ts";
import { exportBundle, importBundle, BUNDLE_VERSION } from "@intehrgrator/core/persistence/mod.ts";
import { DEFAULT_SETTINGS, type ProjectBundle } from "@intehrgrator/types/mod.ts";

const terms = normalizeSheet({
  name: "icd10_snomed",
  headers: ["code", "snomed", "rubric"],
  rowNames: ["htn", "dm"],
  values: [
    ["I10", "38341003", "Hypertensive disorder"],
    ["E11", "44054006", "Type 2 diabetes mellitus"],
  ],
  columnTypes: ["text", "text", "text"],
});

Deno.test("parseA1 and coordsToA1 round-trip", () => {
  assertEquals(parseA1("A1"), { x: 0, y: 0 });
  assertEquals(parseA1("C2"), { x: 2, y: 1 });
  assertEquals(parseA1("AA10"), { x: 26, y: 9 });
  assertEquals(coordsToA1(0, 0), "A1");
  assertEquals(coordsToA1(26, 9), "AA10");
  assertThrows(() => parseA1("1A"));
});

Deno.test("get/set cell by A1 and lookup by header", () => {
  assertEquals(getCellA1(terms, "A1"), "I10");
  assertEquals(getCellA1(terms, "B2"), "44054006");
  const edited = setCellA1(terms, "C1", "Hypertension");
  assertEquals(getCellA1(edited, "C1"), "Hypertension");
  assertEquals(getCellA1(terms, "C1"), "Hypertensive disorder");
  assertEquals(sheetLookup(terms, "code", "E11", "snomed"), "44054006");
  assertEquals(sheetLookup(terms, "A", "I10", "rubric"), "Hypertensive disorder");
  assertEquals(sheetLookup(terms, "code", "Z99", "snomed"), null);
  const row = sheetLookup(terms, "code", "I10") as Record<string, string>;
  assertEquals(row.code, "I10");
  assertEquals(row.snomed, "38341003");
  assertEquals(row.__row, "htn");
});

Deno.test("insert row/column pads the grid", () => {
  const withRow = insertRow(terms, 1, 1);
  assertEquals(withRow.values.length, 3);
  assertEquals(withRow.values[1], ["", "", ""]);
  assertEquals(withRow.values[2]![0], "E11");
  const withCol = insertColumn(terms, 1, 1);
  assertEquals(withCol.headers.length, 4);
  assertEquals(withCol.values[0]!.length, 4);
  assertEquals(withCol.values[0]![2], "38341003");
});

Deno.test("emptySheet has A/B/C headers", () => {
  const sheet = emptySheet("scratch");
  assertEquals(sheet.name, "scratch");
  assertEquals(sheet.headers, ["A", "B", "C"]);
  assertEquals(sheet.values.length, 4);
});

Deno.test("parseSpreadsheetText reads Excel TSV and quoted CSV", () => {
  const tsv = parseSpreadsheetText("code\tsnomed\nI10\t38341003\n");
  assertEquals(tsv, [["code", "snomed"], ["I10", "38341003"]]);
  const csv = parseSpreadsheetText('code,rubric\nI10,"Hypertensive, disorder"\n');
  assertEquals(csv, [["code", "rubric"], ["I10", "Hypertensive, disorder"]]);
});

Deno.test("sheetToCsv includes headers", () => {
  const csv = sheetToCsv(emptySheet("x", 2, 1));
  assertEquals(csv.split("\n")[0], "A,B");
});

Deno.test("evalSheetCall reads from a named bag", () => {
  const bag = sheetsToBag([terms]);
  assertEquals(evalSheetCall("sheet_lookup", ["icd10_snomed", "code", "I10", "snomed"], bag), "38341003");
  assertEquals(evalSheetCall("sheet_get_cell", ["icd10_snomed", "B2"], bag), "44054006");
  assertEquals(evalSheetCall("sheet_get_header", ["icd10_snomed", 0], bag), "code");
});

Deno.test("sheet_lookup expression evaluates on SourceContext.sheets", () => {
  const ctx = createSourceContext('{"icd10":"I10"}', "json");
  ctx.sheets = sheetsToBag([terms]);
  assertEquals(
    evaluate('sheet_lookup("icd10_snomed", "code", xpathString("$.icd10"), "snomed")', ctx, "string"),
    "38341003",
  );
  assertEquals(evaluate('sheet_get_cell("icd10_snomed", "A2")', ctx, "string"), "E11");
});

Deno.test("runTest Mapping preview resolves sheet_lookup from options.sheets", () => {
  const model = {
    modelVersion: 2,
    templateId: "t",
    slots: [{
      slotId: "code",
      rmType: "DV_TEXT",
      expression: 'sheet_lookup("icd10_snomed", "code", xpathString("$.icd10"), "snomed")',
      returnType: "string",
    }],
    optionalRm: [],
  };
  const result = runTest(model, '{"icd10":"E11"}', "json", { sheets: [terms] });
  assertEquals(result.ok, true);
  const output = result.output as { slots?: Record<string, unknown> };
  assertEquals(output.slots?.code, "44054006");
});

Deno.test("sheet Blockly accessors serialize to expressions and round-trip JSON", () => {
  registerSheetBlocks();
  const workspace = new Blockly.Workspace();
  const lookup = workspace.newBlock("sheet_lookup");
  lookup.setFieldValue("icd10_snomed", "NAME");
  const match = workspace.newBlock("text");
  match.setFieldValue("code", "TEXT");
  lookup.getInput("MATCH_COL")?.connection?.connect(match.outputConnection!);
  const val = workspace.newBlock("text");
  val.setFieldValue("I10", "TEXT");
  lookup.getInput("MATCH_VAL")?.connection?.connect(val.outputConnection!);
  const ret = workspace.newBlock("text");
  ret.setFieldValue("snomed", "TEXT");
  lookup.getInput("RETURN_COL")?.connection?.connect(ret.outputConnection!);
  assertEquals(
    blockToExpression(lookup),
    'sheet_lookup("icd10_snomed", "code", "I10", "snomed")',
  );
  const cell = workspace.newBlock("sheet_get_cell");
  cell.setFieldValue("icd10_snomed", "NAME");
  const a1 = workspace.newBlock("text");
  a1.setFieldValue("B2", "TEXT");
  cell.getInput("A1")?.connection?.connect(a1.outputConnection!);
  assertEquals(blockToExpression(cell), 'sheet_get_cell("icd10_snomed", "B2")');
  const saved = Blockly.serialization.workspaces.save(workspace);
  const workspace2 = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(saved, workspace2);
  const loaded = workspace2.getAllBlocks(false).find((b) => b.type === "sheet_lookup");
  assertEquals(loaded?.getFieldValue("NAME"), "icd10_snomed");
  workspace.dispose();
  workspace2.dispose();
});

Deno.test("terminology fixture loads and lookup matches", async () => {
  const raw = JSON.parse(await Deno.readTextFile("test/fixtures/sheets/icd10_snomed.json"));
  const sheet = normalizeSheet(raw);
  assertEquals(sheetLookup(sheet, "code", "I10", "snomed"), "38341003");
});

Deno.test("project bundle round-trips sheets JSON", () => {
  const bundle: ProjectBundle = {
    version: BUNDLE_VERSION,
    projectId: "p1",
    appVersion: "0.5.0",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    template: null,
    target: null,
    sourceSchema: null,
    examples: [],
    activeExampleId: null,
    mapping: {
      blocklyState: null,
      model: { modelVersion: 2, templateId: "t", slots: [], optionalRm: [] },
      sheets: [terms],
    },
    settings: DEFAULT_SETTINGS,
  };
  const loaded = importBundle(exportBundle(bundle));
  assertEquals(loaded.mapping.sheets?.[0]?.name, "icd10_snomed");
  assertEquals(loaded.mapping.sheets?.[0]?.values[1]?.[0], "E11");
});

Deno.test("applySheetMutator writes into the convert-time bag", () => {
  const bag = sheetsToBag([terms]);
  applySheetMutator("sheet_set_cell", ["icd10_snomed", "A1", "I11"], bag);
  assertEquals(getCellA1(bag.icd10_snomed!, "A1"), "I11");
});

Deno.test("SheetChangeEvent is on the Blockly undo stack and restores JSON", () => {
  const workspace = new Blockly.Workspace();
  let current = [emptySheet("before")];
  fireSheetChange(workspace, [emptySheet("before")], [emptySheet("after")], (sheets) => {
    current = sheets;
  });
  assertEquals((workspace.getUndoStack?.()?.length ?? 0) > 0, true);
  workspace.undo(false);
  assertEquals(current[0]?.name, "before");
  workspace.undo(true);
  assertEquals(current[0]?.name, "after");
  workspace.dispose();
});

