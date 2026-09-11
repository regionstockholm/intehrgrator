import { assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import "blockly/blocks";
import { registerDecisionTableBlocks } from "@intehrgrator/blockly/blocks/decision_table_blocks.ts";
import { registerSheetBlocks } from "@intehrgrator/blockly/blocks/sheet_blocks.ts";
import {
  FieldGridPreview,
  setGridPreviewActivateHandler,
} from "@intehrgrator/blockly/field_grid_preview.ts";

Deno.test("declaration chips expose a GRID_PREVIEW miniature", () => {
  registerDecisionTableBlocks();
  registerSheetBlocks();
  const workspace = new Blockly.Workspace();
  try {
    const dt = workspace.newBlock("decision_table_decl");
    const sheet = workspace.newBlock("sheet");
    assertEquals(dt.getField("GRID_PREVIEW") instanceof FieldGridPreview, true);
    assertEquals(sheet.getField("GRID_PREVIEW") instanceof FieldGridPreview, true);
  } finally {
    workspace.dispose();
  }
});

Deno.test("activating a Decision table miniature reports that document", () => {
  registerDecisionTableBlocks();
  const workspace = new Blockly.Workspace();
  const hits: Array<[string, string]> = [];
  setGridPreviewActivateHandler((blockType, name) => hits.push([blockType, name]));
  try {
    const decl = workspace.newBlock("decision_table_decl");
    decl.setFieldValue("BMI", "NAME");
    (decl.getField("GRID_PREVIEW") as FieldGridPreview).activate();
    assertEquals(hits, [["decision_table_decl", "BMI"]]);
  } finally {
    setGridPreviewActivateHandler(null);
    workspace.dispose();
  }
});

Deno.test("activating a Sheet miniature reports that document", () => {
  registerSheetBlocks();
  const workspace = new Blockly.Workspace();
  const hits: Array<[string, string]> = [];
  setGridPreviewActivateHandler((blockType, name) => hits.push([blockType, name]));
  try {
    const decl = workspace.newBlock("sheet");
    decl.setFieldValue("icd10", "NAME");
    (decl.getField("GRID_PREVIEW") as FieldGridPreview).activate();
    assertEquals(hits, [["sheet", "icd10"]]);
  } finally {
    setGridPreviewActivateHandler(null);
    workspace.dispose();
  }
});
