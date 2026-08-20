import { assertEquals, assert } from "@std/assert";
import { join } from "@std/path";
import { generateSkeleton } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import {
  blocklyCheckForDv,
  blocklyCheckForReturnType,
} from "@intehrgrator/blockly/block_checks.ts";
import {
  configureElementValueSlot,
  dvFieldInputName,
  ensureElementDataValueShell,
  isDataValueBlock,
  orderedRmAttributes,
  registerRmBlocks,
  rmAttributeInputName,
  syncRmAttributeInputs,
} from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { registerExpressionBlocks } from "@intehrgrator/blockly/blocks/expression_blocks.ts";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { zipehrEmojiForRmType } from "@intehrgrator/core/rm_emoji.ts";
import {
  ABSTRACT_SLOT_GLYPH,
  BLOCK_OUT_EMOJI_FIELD,
  isRmTypeEmojiField,
  RM_EMOJI_FONT_PX,
  RM_EMOJI_LARGE_FONT_PX,
  rmTypeConnectionTooltip,
  slotEmojiFieldName,
} from "@intehrgrator/blockly/rm_type_emoji.ts";
import { loadSkeletonIntoWorkspace, setAllBlocksCollapsed, attachOptionalRmChild } from "@intehrgrator/blockly/skeleton_loader.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import {
  attributesFor,
  dataValueLeafTypes,
  getValidAttachments,
  isDataValueType,
  primaryMappingAttribute,
} from "@intehrgrator/core/rm_meta.ts";
import type { SkeletonNode } from "@intehrgrator/types/mod.ts";

const fixture = await Deno.readTextFile(
  join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
);

let blocksReady = false;
function ensureBlocks(): void {
  if (blocksReady) return;
  registerRmBlocks();
  registerExpressionBlocks();
  blocksReady = true;
}

Deno.test("ehrtslib meta exposes DATA_VALUE leaves and DV_QUANTITY fields", () => {
  assert(dataValueLeafTypes().includes("DV_QUANTITY"));
  assert(isDataValueType("DV_CODED_TEXT"));
  const qty = attributesFor("DV_QUANTITY");
  assert(qty.some((a) => a.name === "magnitude" && a.mandatory));
  assert(qty.some((a) => a.name === "units" && a.mandatory));
  assertEquals(primaryMappingAttribute("DV_QUANTITY")?.name, "magnitude");
});

Deno.test("composition optional attachments exclude present attrs", () => {
  const opts = getValidAttachments("COMPOSITION", {
    presentAttributes: new Set(["context"]),
    templateConstrained: new Set(),
  });
  assertEquals(opts.some((o) => o.attributeName === "context"), false);
  assertEquals(opts.some((o) => o.attributeName === "feeder_audit"), true);
});

Deno.test("skeleton children carry rmAttribute from OPT walk", () => {
  const { skeleton } = generateSkeleton(fixture);
  const observation = skeleton.flatMap(function walk(n): SkeletonNode[] {
    const self = n.rmType === "OBSERVATION" ? [n] : [];
    return [...self, ...n.children.flatMap((c) => walk(c))];
  })[0];
  assert(observation, "expected OBSERVATION node");
  const attrs = new Set(observation.children.map((c) => c.rmAttribute));
  assert(attrs.has("data"), `expected data attribute, got ${[...attrs].join(", ")}`);
});

Deno.test("blocklyCheckForDv maps DV types to typed shell checks", () => {
  assertEquals(blocklyCheckForDv("DV_TEXT"), ["DV_TEXT", "DV_CODED_TEXT"]);
  assertEquals(blocklyCheckForDv("DV_QUANTITY"), ["DV_QUANTITY"]);
  assertEquals(blocklyCheckForDv("DV_BOOLEAN"), ["DV_BOOLEAN"]);
  assertEquals(blocklyCheckForReturnType("string"), "String");
});

Deno.test("orderedRmAttributes puts mandatory RM attrs first", () => {
  assertEquals(
    orderedRmAttributes("OBSERVATION", ["protocol", "data"]),
    ["data", "protocol"],
  );
});

Deno.test("syncRmAttributeInputs labels statement mouths with RM attribute names", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock("observation");
  syncRmAttributeInputs(block, "OBSERVATION", ["protocol", "data"]);
  const labels = block.inputList
    .filter((input) => input.name.startsWith("ATTR_"))
    .map((input) => input.fieldRow[0]?.getText?.() ?? "");
  assertEquals(labels, ["data", "protocol"]);
  assert(block.getInput(rmAttributeInputName("data")));
  workspace.dispose();
});

Deno.test("configureElementValueSlot applies typed DATA_VALUE checks", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock("element");
  configureElementValueSlot(block, "DV_QUANTITY");
  assertEquals(block.getInput("VALUE")?.connection?.getCheck(), ["DV_QUANTITY"]);
  configureElementValueSlot(block, "DV_CODED_TEXT");
  assertEquals(block.getInput("VALUE")?.connection?.getCheck(), ["DV_CODED_TEXT"]);
  workspace.dispose();
});

Deno.test("DATA_VALUE shell exposes mandatory fields from meta", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const shell = workspace.newBlock("dv_quantity");
  assert(shell.getInput(dvFieldInputName("magnitude")));
  assert(shell.getInput(dvFieldInputName("units")));
  assertEquals(shell.outputConnection?.getCheck(), ["DV_QUANTITY"]);
  workspace.dispose();
});

Deno.test("loadSkeletonIntoWorkspace auto-attaches mandatory DV shells", () => {
  ensureBlocks();
  const { skeleton } = generateSkeleton(fixture);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);

  const observation = workspace.getAllBlocks(false).find(
    (b) => b.getFieldValue("RM_TYPE") === "OBSERVATION",
  );
  assert(observation, "expected observation block");
  assertEquals(observation.type, "observation");
  const root = workspace.getTopBlocks(false)[0];
  assertEquals(root?.type, "composition");
  assertEquals(
    workspace.getAllBlocks(false).some((b) => b.type === "rm_structure"),
    false,
  );
  assert(observation.getInput(rmAttributeInputName("data")), "expected data statement input");
  assert(!observation.getInput("BODY"), "generic children input should not be used");

  const systolic = workspace.getAllBlocks(false).find(
    (b) => b.getFieldValue("SLOT_ID")?.includes("at0004") && b.type === "element",
  );
  assert(systolic, "expected systolic element block");
  assertEquals(systolic.getInput("VALUE")?.connection?.getCheck(), ["DV_QUANTITY"]);

  const shell = systolic.getInputTargetBlock("VALUE");
  assert(shell && isDataValueBlock(shell), "expected auto-attached DV shell");
  assertEquals(shell.getFieldValue("RM_TYPE"), "DV_QUANTITY");
  assert(shell.getInput(dvFieldInputName("magnitude")));

  workspace.dispose();
});

Deno.test("imported skeleton starts expanded; collapse-all skips the root", () => {
  ensureBlocks();
  const { skeleton } = generateSkeleton(fixture);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);

  const roots = workspace.getTopBlocks(false);
  assert(roots.length >= 1, "expected a root block");
  const root = roots[0];
  assertEquals(root.isCollapsed(), false);

  const nested = workspace.getAllBlocks(false).filter((block) => {
    if (block === root) return false;
    return typeof block.isShadow !== "function" || !block.isShadow();
  });
  assert(nested.length > 0, "expected nested blocks under the root");
  assert(
    nested.every((block) => !block.isCollapsed()),
    "imported nested blocks should start expanded",
  );

  setAllBlocksCollapsed(workspace, true);
  assertEquals(root.isCollapsed(), false, "root must stay expanded after collapse-all");
  assert(
    nested.some((block) => block.isCollapsed()),
    "collapse-all should collapse at least one nested block",
  );

  root.setCollapsed(true);
  assertEquals(root.isCollapsed(), false, "root must not be collapsible");

  setAllBlocksCollapsed(workspace, false);
  assert(
    nested.every((block) => !block.isCollapsed()),
    "expand-all should expand nested blocks",
  );

  workspace.dispose();
});

Deno.test("ensureElementDataValueShell is idempotent", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const element = workspace.newBlock("element");
  element.setFieldValue("DV_TEXT", "RM_TYPE");
  configureElementValueSlot(element, "DV_TEXT");
  const a = ensureElementDataValueShell(workspace, element, "DV_TEXT");
  const b = ensureElementDataValueShell(workspace, element, "DV_TEXT");
  assert(a && b);
  assertEquals(a.id, b.id);
  workspace.dispose();
});

Deno.test("COMPOSITION toolbox block has RM content/context mouths", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock("composition");
  assertEquals(block.getFieldValue("RM_TYPE"), "COMPOSITION");
  assert(block.getInput(rmAttributeInputName("content")), "expected content statement");
  assert(block.getInput(rmAttributeInputName("context")), "expected context statement");
  assertEquals(block.getInput(rmAttributeInputName("content"))?.connection?.getCheck(), [
    "CONTENT_ITEM",
  ]);
  assertEquals(block.previousConnection, null);
  workspace.dispose();
});

Deno.test("SECTION and OBSERVATION nest into COMPOSITION content", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const composition = workspace.newBlock("composition");
  const section = workspace.newBlock("section");
  const observation = workspace.newBlock("observation");
  const content = composition.getInput(rmAttributeInputName("content"))?.connection;
  assert(content && section.previousConnection);
  content.connect(section.previousConnection);
  assertEquals(section.getParent()?.id, composition.id);
  assert(observation.previousConnection);
  section.nextConnection?.connect(observation.previousConnection);
  assertEquals(observation.getRootBlock().id, composition.id);
  workspace.dispose();
});

Deno.test("ENTRY subclasses EVALUATION INSTRUCTION ACTION ADMIN_ENTRY nest as CONTENT_ITEM", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const composition = workspace.newBlock("composition");
  const content = composition.getInput(rmAttributeInputName("content"))?.connection;
  assert(content);
  for (const type of ["evaluation", "instruction", "action", "admin_entry"]) {
    const child = workspace.newBlock(type);
    assertEquals(child.getFieldValue("RM_TYPE"), type.toUpperCase());
    assert(child.previousConnection);
    content.connect(child.previousConnection);
    assertEquals(child.getParent()?.id, composition.id);
    child.unplug();
  }
  workspace.dispose();
});

Deno.test("ELEMENT block is labelled ELEMENT in the header", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock("element");
  assertEquals(block.getFieldValue("RM_TYPE"), "ELEMENT");
  const header = block.getInput("HEADER");
  const labels = header?.fieldRow.map((field) => field.getText()) ?? [];
  assertEquals(block.getField(BLOCK_OUT_EMOJI_FIELD)?.getText(), zipehrEmojiForRmType("ELEMENT"));
  assertEquals(labels.includes("ELEMENT"), true);
  workspace.dispose();
});

Deno.test("ZipEHR emojis sit on block output and slot connections", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();

  const qty = workspace.newBlock("dv_quantity");
  const qtyOut = qty.getField(BLOCK_OUT_EMOJI_FIELD);
  assertEquals(qtyOut?.getText(), zipehrEmojiForRmType("DV_QUANTITY"));
  assertEquals(qtyOut?.getTooltip?.(), "DV_QUANTITY");
  assertEquals(isRmTypeEmojiField(qtyOut), true);
  qtyOut?.updateSize_?.();
  assertEquals(qtyOut?.getSize()?.height, RM_EMOJI_FONT_PX);
  const magnitude = qty.getInput(dvFieldInputName("magnitude"));
  magnitude?.fieldRow.at(-1)?.updateSize_?.();
  assertEquals(magnitude?.fieldRow.at(-1)?.getSize()?.height, RM_EMOJI_FONT_PX);
  assertEquals(
    magnitude?.fieldRow.at(-1)?.getText(),
    zipehrEmojiForRmType("Real"),
  );
  assertEquals(magnitude?.fieldRow.at(-1)?.name, slotEmojiFieldName(dvFieldInputName("magnitude")));

  const dvText = workspace.newBlock("dv_text");
  const textOut = dvText.getField(BLOCK_OUT_EMOJI_FIELD);
  textOut?.updateSize_?.();
  assertEquals(textOut?.getSize()?.height, RM_EMOJI_LARGE_FONT_PX);

  const observation = workspace.newBlock("observation");
  assertEquals(
    observation.getField(BLOCK_OUT_EMOJI_FIELD)?.getText(),
    zipehrEmojiForRmType("OBSERVATION"),
  );
  const data = observation.getInput(rmAttributeInputName("data"));
  assertEquals(data?.fieldRow[0]?.getText(), "data");
  assertEquals(data?.fieldRow.at(-1)?.getText(), zipehrEmojiForRmType("HISTORY"));

  const element = workspace.newBlock("element");
  const value = element.getInput("VALUE");
  assertEquals(value?.fieldRow.at(-1)?.getText(), ABSTRACT_SLOT_GLYPH);
  assertEquals(value?.fieldRow.at(-1)?.getTooltip?.(), rmTypeConnectionTooltip("DATA_VALUE"));
  configureElementValueSlot(element, "DV_QUANTITY");
  assertEquals(value?.fieldRow.at(-1)?.getText(), zipehrEmojiForRmType("DV_QUANTITY"));
  assertEquals(value?.fieldRow.at(-1)?.getTooltip?.(), "DV_QUANTITY");
  configureElementValueSlot(element, "DV_CODED_TEXT");
  assertEquals(value?.fieldRow.at(-1)?.getText(), zipehrEmojiForRmType("DV_CODED_TEXT"));
  assertEquals(value?.fieldRow.at(-1)?.getTooltip?.(), "DV_CODED_TEXT");

  const composition = workspace.newBlock("composition");
  const content = composition.getInput(rmAttributeInputName("content"));
  assertEquals(content?.fieldRow.at(-1)?.getText(), ABSTRACT_SLOT_GLYPH);
  assertEquals(isRmTypeEmojiField(content?.fieldRow.at(-1) ?? null), true);
  assertEquals(content?.fieldRow.at(-1)?.getTooltip?.()?.includes("CONTENT_ITEM (abstract)"), true);

  workspace.dispose();
});

Deno.test("Optional RM Insertion attaches a typed child without clearing the canvas", () => {
  ensureBlocks();
  const { skeleton } = generateSkeleton(fixture);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  const root = workspace.getTopBlocks(false)[0];
  assert(root);
  const beforeIds = new Set(workspace.getAllBlocks(false).map((b) => b.id));
  const child = attachOptionalRmChild(workspace as unknown as Blockly.WorkspaceSvg, root, {
    rmType: "FEEDER_AUDIT",
    attributeName: "feeder_audit",
    label: "Feeder Audit",
  });
  assert(child, "expected feeder_audit child block");
  assertEquals(child.type, "feeder_audit");
  assertEquals(child.getParent()?.id, root.id);
  assertEquals(root.type, "composition");
  for (const id of beforeIds) {
    assert(workspace.getBlockById(id), `existing block ${id} should stay on the canvas`);
  }
  workspace.dispose();
});
