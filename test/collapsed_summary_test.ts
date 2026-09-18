import { assertEquals, assertStringIncludes } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { registerCollapsedSummaries, COLLAPSED_TEXT_LIMIT } from "@intehrgrator/blockly/collapsed_summary.ts";
import { registerRmBlocks } from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { registerTermPickBlock } from "@intehrgrator/blockly/blocks/term_pick.ts";
import { registerMapBlocks } from "@intehrgrator/blockly/blocks/map_blocks.ts";
import "blockly/blocks";

Deno.test("collapsed summaries list all RM statement children", () => {
  registerRmBlocks();
  registerCollapsedSummaries();
  const workspace = new Blockly.Workspace();
  const section = workspace.newBlock("section");
  section.setFieldValue("Vitals", "NAME");
  const obsA = workspace.newBlock("observation");
  obsA.setFieldValue("Respirations", "NAME");
  const obsB = workspace.newBlock("observation");
  obsB.setFieldValue("Pulse", "NAME");
  section.getInput("ATTR_items")?.connection?.connect(obsA.previousConnection!);
  obsA.nextConnection?.connect(obsB.previousConnection!);

  const text = section.toString(COLLAPSED_TEXT_LIMIT);
  assertStringIncludes(text, "Respirations");
  assertStringIncludes(text, "Pulse");
  workspace.dispose();
});

Deno.test("collapsed map summary includes keys and value roots", () => {
  registerMapBlocks();
  registerTermPickBlock();
  registerCollapsedSummaries();
  const workspace = new Blockly.Workspace();
  const map = workspace.newBlock("maps_create_with") as Blockly.Block & {
    itemCount_: number;
    updateShape_: () => void;
  };
  map.itemCount_ = 1;
  map.updateShape_();
  map.setFieldValue("language", "KEY0");
  const pick = workspace.newBlock("term_pick");
  pick.setFieldValue("ISO_639-1", "SET");
  (pick as Blockly.Block & { syncTermPick_?: () => void }).syncTermPick_?.();
  const codeField = pick.getField("CODE") as Blockly.FieldDropdown;
  const options = codeField.getOptions(false);
  const en = options.find(([, value]) => value === "en")?.[1] ?? options[1]?.[1];
  if (en) pick.setFieldValue(en, "CODE");
  map.getInput("VAL0")?.connection?.connect(pick.outputConnection!);

  const text = map.toString(COLLAPSED_TEXT_LIMIT);
  assertStringIncludes(text, "language:");
  assertStringIncludes(text, "en");
  workspace.dispose();
});

Deno.test("Blockly COLLAPSE_CHARS is raised for richer summaries", () => {
  registerCollapsedSummaries();
  assertEquals(Blockly.COLLAPSE_CHARS, COLLAPSED_TEXT_LIMIT);
});
