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
import { loadSkeletonIntoWorkspace } from "@intehrgrator/blockly/skeleton_loader.ts";
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
  const block = workspace.newBlock("rm_structure");
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
