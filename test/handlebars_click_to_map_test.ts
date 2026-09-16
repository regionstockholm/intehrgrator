import { assertEquals, assert } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import { TEXT_CODE_BLOCK_TYPE, TEXT_HANDLEBARS_BLOCK_TYPE } from "@intehrgrator/blockly/blocks/text_blocks.ts";
import { FieldCodeMirror } from "@intehrgrator/blockly/field_codemirror.ts";
import { buildHandlebarsPath, buildHandlebarsTree } from "@intehrgrator/core/output/handlebars_dialect.ts";
import {
  insertHandlebarsPathAtSelection,
  isHandlebarsInsertTarget,
} from "@intehrgrator/workbench/handlebars_click_to_map.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

Deno.test("Click-to-Map inserts {{path}} into a focused Handlebars Code text block", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const script = workspace.newBlock(TEXT_CODE_BLOCK_TYPE);
    script.setFieldValue("handlebars", "LANG");
    script.setFieldValue("Hello ", "TEXT");
    assertEquals(isHandlebarsInsertTarget(script), true);
    assertEquals(insertHandlebarsPathAtSelection(script, "$.patient.name", false), true);
    assertEquals(script.getFieldValue("TEXT"), `Hello {{${buildHandlebarsPath("$.patient.name")}}}`);
  } finally {
    workspace.dispose();
  }
});

Deno.test("Click-to-Map Shift+click inserts nested #with/#each into text_handlebars SCRIPT", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const render = workspace.newBlock(TEXT_HANDLEBARS_BLOCK_TYPE);
    assertEquals(isHandlebarsInsertTarget(render), true);
    assertEquals(insertHandlebarsPathAtSelection(render, "$.items[1].label", true), true);
    const script = render.getInputTargetBlock("SCRIPT");
    assert(script, "expected a Code text block in SCRIPT");
    assertEquals(script.getFieldValue("LANG"), "handlebars");
    assertEquals(script.getFieldValue("TEXT"), buildHandlebarsTree("$.items[1].label"));
  } finally {
    workspace.dispose();
  }
});

Deno.test("Click-to-Map does not insert into a plain Code text block", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const script = workspace.newBlock(TEXT_CODE_BLOCK_TYPE);
    script.setFieldValue("json", "LANG");
    script.setFieldValue("{", "TEXT");
    assertEquals(isHandlebarsInsertTarget(script), false);
    assertEquals(insertHandlebarsPathAtSelection(script, "$.name", false), false);
    assertEquals(script.getFieldValue("TEXT"), "{");
  } finally {
    workspace.dispose();
  }
});

Deno.test("FieldCodeMirror insertAtCaret appends when the editor view is not mounted", () => {
  const field = new FieldCodeMirror("pre ");
  field.insertAtCaret("{{name}}");
  assertEquals(field.getValue(), "pre {{name}}");
});
