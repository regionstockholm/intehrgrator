import { assertEquals, assert } from "@std/assert";
import { join } from "@std/path";
import { generateSkeleton } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import {
  blocklyCheckForDv,
  blocklyCheckForReturnType,
} from "@intehrgrator/blockly/block_checks.ts";
import {
  applyFixedFieldsToDataValueShell,
  configureElementValueSlot,
  dvFieldInputName,
  ensureElementDataValueShell,
  isDataValueBlock,
  orderedRmAttributes,
  registerRmBlocks,
  RM_SPECIALIZATION_INPUT,
  rmAttributeInputName,
  optionalRmInputName,
  applyMutatorItemLabel,
  buildOptionalRmFlyoutContents,
  OPTIONAL_RM_MUTATOR_CONTAINER,
  OPTIONAL_RM_MUTATOR_ITEM,
  DV_FIELDS_MUTATOR_ITEM,
  syncRmAttributeInputs,
  applyEventRmType,
  applyItemStructureRmType,
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
import { isSkeletonTitleField, humanizeRmType } from "@intehrgrator/blockly/field_skeleton_title.ts";
import { loadSkeletonIntoWorkspace, setAllBlocksCollapsed, attachOptionalRmChild } from "@intehrgrator/blockly/skeleton_loader.ts";
import {
  ABSTRACT_EVENT_WARNING,
  ABSTRACT_ITEM_STRUCTURE_WARNING,
  blockConstraintMessages,
  refreshWorkspaceConstraints,
  warningTextOf,
} from "@intehrgrator/blockly/block_constraints.ts";
import {
  formatSlotCardinality,
  isSlotCardinalityField,
} from "@intehrgrator/blockly/slot_cardinality.ts";
import { createTermPickBlock } from "@intehrgrator/blockly/blocks/term_pick.ts";
import { termSetById, termSetForMandatedCode } from "@intehrgrator/core/openehr_term_catalog.ts";
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
  const root = workspace.getTopBlocks(false).find((block) => block.type === "composition");
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

Deno.test("COMPOSITION toolbox block has mandatory RM slots", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock("composition");
  assertEquals(block.getFieldValue("RM_TYPE"), "COMPOSITION");
  assertEquals(
    block.getInput(rmAttributeInputName("language"))?.connection?.getCheck(),
    ["CODE_PHRASE"],
  );
  assertEquals(
    block.getInput(rmAttributeInputName("territory"))?.connection?.getCheck(),
    ["CODE_PHRASE"],
  );
  assertEquals(
    block.getInput(rmAttributeInputName("category"))?.connection?.getCheck(),
    ["DV_CODED_TEXT"],
  );
  assertEquals(
    block.getInput(rmAttributeInputName("composer"))?.connection?.getCheck(),
    ["PARTY_PROXY"],
  );
  assertEquals(block.getInput(rmAttributeInputName("content"))?.connection?.getCheck(), [
    "CONTENT_ITEM",
  ]);
  assert(block.getInput(rmAttributeInputName("context")), "expected context statement");
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

Deno.test("PARTY_PROXY specialization slot accepts PARTY_SELF IDENTIFIED RELATED", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const proxy = workspace.newBlock("party_proxy");
  const kind = proxy.getInput(RM_SPECIALIZATION_INPUT);
  assert(kind?.connection, "expected PARTY_PROXY specialization puzzle");
  assertEquals(kind.connection.getCheck()?.slice().sort(), [
    "PARTY_IDENTIFIED",
    "PARTY_RELATED",
    "PARTY_SELF",
  ]);
  const kindEmoji = kind.fieldRow.at(-1);
  assertEquals(kindEmoji?.getText(), ABSTRACT_SLOT_GLYPH);
  assertEquals(isRmTypeEmojiField(kindEmoji ?? null), true);
  assertEquals(kindEmoji?.getTooltip?.()?.includes("PARTY_PROXY (abstract)"), true);
  assertEquals(kindEmoji?.getTooltip?.()?.includes("PARTY_SELF"), true);
  for (const type of ["party_self", "party_identified", "party_related"]) {
    const child = workspace.newBlock(type);
    assert(child.outputConnection);
    kind.connection.connect(child.outputConnection);
    assertEquals(child.getParent()?.id, proxy.id);
    child.unplug();
  }
  workspace.dispose();
});

Deno.test("PARTY_IDENTIFIED and PARTY_RELATED nest into COMPOSITION composer", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const composition = workspace.newBlock("composition");
  const composer = composition.getInput(rmAttributeInputName("composer"))?.connection;
  assert(composer);
  assertEquals(composer.getCheck(), ["PARTY_PROXY"]);
  for (const type of ["party_identified", "party_related", "party_self"]) {
    const child = workspace.newBlock(type);
    assert(child.outputConnection);
    composer.connect(child.outputConnection);
    assertEquals(child.getParent()?.id, composition.id);
    child.unplug();
  }
  workspace.dispose();
});

Deno.test("EVENT_CONTEXT health_care_facility accepts PARTY_IDENTIFIED not PARTY_SELF", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const context = workspace.newBlock("event_context");
  syncRmAttributeInputs(context, "EVENT_CONTEXT", ["start_time", "setting", "health_care_facility"]);
  const facility = context.getInput(rmAttributeInputName("health_care_facility"))?.connection;
  assert(facility);
  assertEquals(facility.getCheck(), ["PARTY_IDENTIFIED"]);
  for (const type of ["party_identified", "party_related"]) {
    const child = workspace.newBlock(type);
    assert(child.outputConnection);
    facility.connect(child.outputConnection);
    assertEquals(child.getParent()?.id, context.id);
    child.unplug();
  }
  const self = workspace.newBlock("party_self");
  assertEquals(
    workspace.connectionChecker.canConnect(facility, self.outputConnection!, false),
    false,
  );
  workspace.dispose();
});

Deno.test("PARTY_PROXY subclasses nest into ENTRY subject", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const observation = workspace.newBlock("observation");
  syncRmAttributeInputs(observation, "OBSERVATION", ["data", "subject"]);
  const subject = observation.getInput(rmAttributeInputName("subject"))?.connection;
  assert(subject);
  assertEquals(subject.getCheck(), ["PARTY_PROXY"]);
  for (const type of ["party_self", "party_identified", "party_related", "party_proxy"]) {
    const child = workspace.newBlock(type);
    assert(child.outputConnection);
    subject.connect(child.outputConnection);
    assertEquals(child.getParent()?.id, observation.id);
    child.unplug();
  }
  workspace.dispose();
});

Deno.test("ELEMENT block is labelled ELEMENT in the header", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const block = workspace.newBlock("element");
  assertEquals(block.getFieldValue("RM_TYPE"), "ELEMENT");
  assertEquals(block.getField(BLOCK_OUT_EMOJI_FIELD)?.getText(), zipehrEmojiForRmType("ELEMENT"));
  const title = block.getField("NAME");
  assert(isSkeletonTitleField(title));
  assertEquals(title.classNameText(), "ELEMENT");
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

  const composer = composition.getInput(rmAttributeInputName("composer"));
  assertEquals(composer?.fieldRow.at(-1)?.getText(), ABSTRACT_SLOT_GLYPH);
  assertEquals(composer?.fieldRow.at(-1)?.getTooltip?.()?.includes("PARTY_PROXY (abstract)"), true);
  assertEquals(composer?.fieldRow.at(-1)?.getTooltip?.()?.includes("PARTY_SELF"), true);

  workspace.dispose();
});

Deno.test("Optional RM Insertion attaches a typed child without clearing the canvas", () => {
  ensureBlocks();
  const { skeleton } = generateSkeleton(fixture);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  const root = workspace.getTopBlocks(false).find((block) => block.type === "composition");
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

Deno.test("term_pick can be configured to a composition category code", () => {
  ensureBlocks();
  const set = termSetById("openehr:composition_category");
  assert(set, "expected composition_category term set");
  const workspace = new Blockly.Workspace();
  const block = createTermPickBlock(workspace, set, "433", "slot/category");
  assertEquals(block.getFieldValue("SET"), "openehr:composition_category");
  assertEquals(block.getFieldValue("CODE"), "433");
  assertEquals(block.getFieldValue("SLOT_ID"), "slot/category");
  const title = block.getField("NAME");
  assert(isSkeletonTitleField(title), "expected two-line built-in title");
  assertEquals(title.getValue(), "built-in");
  assertEquals(title.classNameText(), "DV_CODED_TEXT");
  workspace.dispose();
});

Deno.test("DATA_VALUE shells use two-line titles with the real RM class name", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const qty = workspace.newBlock("dv_quantity");
  const title = qty.getField("NAME");
  assert(isSkeletonTitleField(title));
  assertEquals(title.classNameText(), "DV_QUANTITY");
  assertEquals(title.getValue(), humanizeRmType("DV_QUANTITY"));
  assertEquals(humanizeRmType("DV_QUANTITY"), "Quantity");
  assertEquals(humanizeRmType("DV_CODED_TEXT"), "Coded Text");

  const phrase = workspace.newBlock("code_phrase");
  const phraseTitle = phrase.getField("NAME");
  assert(isSkeletonTitleField(phraseTitle));
  assertEquals(phraseTitle.classNameText(), "CODE_PHRASE");
  assertEquals(phraseTitle.getValue(), "Code Phrase");
  workspace.dispose();
});

Deno.test("termSetForMandatedCode finds built-in composition category and not local codes", () => {
  const category = termSetForMandatedCode("openehr", "433");
  assertEquals(category?.id, "openehr:composition_category");
  assertEquals(termSetForMandatedCode("local", "at1000"), undefined);
});

Deno.test("skeleton canvas pre-fills RM terminology on language and territory", () => {
  ensureBlocks();
  const { skeleton } = generateSkeleton(fixture);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);

  const composition = workspace.getTopBlocks(false).find((block) => block.type === "composition");
  assertEquals(composition?.type, "composition");
  const languageInput = composition.getInput(rmAttributeInputName("language"));
  assertEquals(languageInput?.connection?.getCheck(), ["CODE_PHRASE"]);
  const language = composition.getInputTargetBlock(rmAttributeInputName("language"));
  assert(language, "expected CODE_PHRASE on COMPOSITION.language");
  assertEquals(language.type, "code_phrase");
  assertEquals(
    language.getInputTargetBlock(dvFieldInputName("terminology_id"))?.getFieldValue("TEXT"),
    "ISO_639-1",
  );
  assertEquals(language.getInputTargetBlock(dvFieldInputName("code_string"))?.type, "maps_get");
  assertEquals(language.type === "element", false);

  const territory = composition.getInputTargetBlock(rmAttributeInputName("territory"));
  assertEquals(territory?.type, "code_phrase");
  assertEquals(
    territory?.getInputTargetBlock(dvFieldInputName("terminology_id"))?.getFieldValue("TEXT"),
    "ISO_3166-1",
  );
  assertEquals(territory?.getInputTargetBlock(dvFieldInputName("code_string"))?.type, "maps_get");

  const category = composition.getInputTargetBlock(rmAttributeInputName("category"));
  assertEquals(category?.type, "term_pick");
  assertEquals(category?.getFieldValue("SET"), "openehr:composition_category");
  assertEquals(category?.getFieldValue("CODE"), "433");
  const categoryTitle = category?.getField("NAME");
  assert(isSkeletonTitleField(categoryTitle));
  assertEquals(categoryTitle.getValue(), "built-in");
  assertEquals(categoryTitle.classNameText(), "DV_CODED_TEXT");

  const observation = workspace.getAllBlocks(false).find(
    (b) => b.getFieldValue("RM_TYPE") === "OBSERVATION",
  );
  assert(observation, "expected observation");
  const encoding = observation.getInputTargetBlock(rmAttributeInputName("encoding"));
  assertEquals(encoding?.type, "code_phrase");
  assertEquals(
    encoding?.getInputTargetBlock(dvFieldInputName("terminology_id"))?.getFieldValue("TEXT"),
    "IANA_character-sets",
  );
  assertEquals(encoding?.getInputTargetBlock(dvFieldInputName("code_string"))?.type, "maps_get");

  workspace.dispose();
});

Deno.test("skeleton canvas pre-fills COMPOSITION.category from the template", () => {
  ensureBlocks();
  const persistent = fixture.replace(
    "<code_list>433</code_list>",
    "<code_list>431</code_list>",
  );
  const { skeleton } = generateSkeleton(persistent);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  const composition = workspace.getTopBlocks(false).find((block) => block.type === "composition");
  const category = composition.getInputTargetBlock(rmAttributeInputName("category"));
  assertEquals(category?.type, "term_pick");
  assertEquals(category?.getFieldValue("CODE"), "431");
  workspace.dispose();
});

Deno.test("optional content observations still scaffold on the canvas", () => {
  ensureBlocks();
  const skeleton: SkeletonNode[] = [{
    slotId: "t",
    blockType: "composition",
    rmType: "COMPOSITION",
    label: "Encounter",
    kind: "container",
    mandatory: true,
    children: [{
      slotId: "t/content/bp",
      blockType: "observation",
      rmType: "OBSERVATION",
      label: "Blood pressure",
      rmAttribute: "content",
      kind: "container",
      mandatory: false,
      children: [],
    }],
  }];
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  const composition = workspace.getTopBlocks(false).find((block) => block.type === "composition");
  const content = composition?.getInputTargetBlock(rmAttributeInputName("content"));
  assertEquals(content?.type, "observation");
  assertEquals(content?.getFieldValue("NAME"), "Blood pressure");
  workspace.dispose();
});

Deno.test("applyFixedFieldsToDataValueShell fills CODE_PHRASE terminology", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const shell = workspace.newBlock("code_phrase");
  applyFixedFieldsToDataValueShell(workspace, shell, { terminology_id: "ISO_639-1" });
  const term = shell.getInputTargetBlock(dvFieldInputName("terminology_id"));
  assertEquals(term?.getFieldValue("TEXT"), "ISO_639-1");
  workspace.dispose();
});

Deno.test("skeleton canvas picks Position from a list of complete DV_CODED_TEXT objects", () => {
  ensureBlocks();
  const { skeleton } = generateSkeleton(fixture);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);

  const position = workspace.getAllBlocks(false).find(
    (b) => b.type === "element" && b.getFieldValue("NAME") === "Position",
  );
  assert(position, "expected Position ELEMENT on the canvas");
  const selector = position.getInputTargetBlock("VALUE");
  assertEquals(selector?.type, "lists_getIndex");
  assertEquals(selector?.getFieldValue("MODE"), "GET");
  // Template assumed_value is Sitting (at1001), the second list item (1-based index 2).
  assertEquals(selector?.getFieldValue("WHERE"), "FROM_START");
  assertEquals(selector?.getInputTargetBlock("AT")?.getFieldValue("NUM"), 2);

  const list = selector?.getInputTargetBlock("VALUE");
  assertEquals(list?.type, "lists_create_with");
  assertEquals((list as { itemCount_?: number } | null)?.itemCount_, 6);

  const standing = list?.getInputTargetBlock("ADD0");
  assert(standing && isDataValueBlock(standing), "expected a DV_CODED_TEXT list item");
  assertEquals(standing.getFieldValue("RM_TYPE"), "DV_CODED_TEXT");
  assertEquals(
    standing.getInputTargetBlock(dvFieldInputName("value"))?.getFieldValue("TEXT"),
    "Standing",
  );
  const standingCode = standing.getInputTargetBlock(dvFieldInputName("defining_code"));
  assertEquals(standingCode?.type, "code_phrase");
  assertEquals(
    standingCode?.getInputTargetBlock(dvFieldInputName("code_string"))?.getFieldValue("TEXT"),
    "at1000",
  );
  assertEquals(
    standingCode?.getInputTargetBlock(dvFieldInputName("terminology_id"))?.getFieldValue("TEXT"),
    "local",
  );

  const sitting = list?.getInputTargetBlock("ADD1");
  assertEquals(
    sitting?.getInputTargetBlock(dvFieldInputName("value"))?.getFieldValue("TEXT"),
    "Sitting",
  );
  assertEquals(
    sitting?.getInputTargetBlock(dvFieldInputName("defining_code"))
      ?.getInputTargetBlock(dvFieldInputName("code_string"))
      ?.getFieldValue("TEXT"),
    "at1001",
  );

  workspace.dispose();
});

const ordinalFixture = await Deno.readTextFile(
  new URL(
    "../vendor/ehrtslib/test_data/opt14/constrain_test.opt",
    import.meta.url,
  ),
);

Deno.test("skeleton canvas picks Vocalization from a list of complete DV_ORDINAL objects", () => {
  ensureBlocks();
  const { skeleton } = generateSkeleton(ordinalFixture);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);

  const vocalization = workspace.getAllBlocks(false).find(
    (b) => b.type === "element" && b.getFieldValue("NAME") === "Vocalization",
  );
  assert(vocalization, "expected Vocalization ELEMENT on the canvas");
  const selector = vocalization.getInputTargetBlock("VALUE");
  assertEquals(selector?.type, "lists_getIndex");
  const list = selector?.getInputTargetBlock("VALUE");
  assertEquals(list?.type, "lists_create_with");
  assertEquals((list as { itemCount_?: number } | null)?.itemCount_, 4);

  const absent = list?.getInputTargetBlock("ADD0");
  assert(absent && isDataValueBlock(absent), "expected a DV_ORDINAL list item");
  assertEquals(absent.getFieldValue("RM_TYPE"), "DV_ORDINAL");
  assertEquals(
    absent.getInputTargetBlock(dvFieldInputName("value"))?.getFieldValue("NUM"),
    0,
  );
  const absentSymbol = absent.getInputTargetBlock(dvFieldInputName("symbol"));
  assert(absentSymbol && isDataValueBlock(absentSymbol));
  assertEquals(absentSymbol.getFieldValue("RM_TYPE"), "DV_CODED_TEXT");
  assertEquals(
    absentSymbol.getInputTargetBlock(dvFieldInputName("value"))?.getFieldValue("TEXT"),
    "Absent",
  );
  assertEquals(
    absentSymbol.getInputTargetBlock(dvFieldInputName("defining_code"))
      ?.getInputTargetBlock(dvFieldInputName("code_string"))
      ?.getFieldValue("TEXT"),
    "at0010",
  );

  workspace.dispose();
});

Deno.test("skeleton canvas scaffolds DV_SCALE choices as complete objects", () => {
  ensureBlocks();
  const skeleton: SkeletonNode[] = [{
    slotId: "borg/content/breathlessness/value",
    blockType: "dv_scale",
    rmType: "DV_SCALE",
    label: "Breathlessness",
    kind: "value",
    mandatory: true,
    children: [],
    allowedOrdinals: [
      { value: 0, code: "at0001", label: "No breathlessness", terminologyId: "local" },
      { value: 0.5, code: "at0002", label: "Very slight", terminologyId: "local", assumed: true },
      { value: 1, code: "at0003", label: "Slight", terminologyId: "local" },
    ],
  }];
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("borg"), null);

  const selector = workspace.getAllBlocks(false).find((b) => b.type === "lists_getIndex");
  assert(selector, "expected lists_getIndex for DV_SCALE choices");
  assertEquals(selector.getFieldValue("WHERE"), "FROM_START");
  assertEquals(selector.getInputTargetBlock("AT")?.getFieldValue("NUM"), 2);

  const list = selector.getInputTargetBlock("VALUE");
  const slight = list?.getInputTargetBlock("ADD2");
  assert(slight && isDataValueBlock(slight));
  assertEquals(slight.getFieldValue("RM_TYPE"), "DV_SCALE");
  assertEquals(
    slight.getInputTargetBlock(dvFieldInputName("value"))?.getFieldValue("NUM"),
    1,
  );

  workspace.dispose();
});

Deno.test("skeleton canvas fills DV_QUANTITY units from the template", () => {
  ensureBlocks();
  const { skeleton } = generateSkeleton(fixture);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);

  const systolic = workspace.getAllBlocks(false).find(
    (b) => b.type === "element" && b.getFieldValue("NAME") === "Systolic",
  );
  assert(systolic, "expected Systolic ELEMENT");
  const shell = systolic.getInputTargetBlock("VALUE");
  assert(shell && isDataValueBlock(shell), "expected DV_QUANTITY shell");
  assertEquals(shell.getFieldValue("RM_TYPE"), "DV_QUANTITY");
  assertEquals(
    shell.getInputTargetBlock(dvFieldInputName("units"))?.getFieldValue("TEXT"),
    "mm[Hg]",
  );

  workspace.dispose();
});

Deno.test("skeleton header stacks RM class and at-code under the node name", () => {
  ensureBlocks();
  const { skeleton } = generateSkeleton(fixture);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);

  const observation = workspace.getAllBlocks(false).find(
    (b) => b.getFieldValue("RM_TYPE") === "OBSERVATION",
  );
  assert(observation, "expected OBSERVATION block");
  const title = observation.getField("NAME");
  assert(isSkeletonTitleField(title), "expected FieldSkeletonTitle on NAME");
  assertEquals(title.classNameText(), "OBSERVATION");
  assert(title.atCode().startsWith("at"), `expected at-code, got ${title.atCode()}`);
  assertEquals(observation.getField("AT_CODE"), null);

  workspace.dispose();
});

Deno.test("mandatory containers do not get a warning triangle just for being mandatory", () => {
  ensureBlocks();
  const { skeleton } = generateSkeleton(fixture);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  const composition = workspace.getTopBlocks(false).find((block) => block.type === "composition");
  assert(composition);
  const warning = (warningTextOf(composition) ?? blockConstraintMessages(composition).join("\n"));
  assertEquals(warning.includes("Mandatory"), false);
  const observation = workspace.getAllBlocks(false).find(
    (b) => b.getFieldValue("RM_TYPE") === "OBSERVATION",
  );
  assert(observation);
  assertEquals(
    (warningTextOf(observation) ?? blockConstraintMessages(observation).join("\n")).includes("Mandatory"),
    false,
  );
  workspace.dispose();
});

Deno.test("slots show [min..max] cardinality left of the ZipEHR emoji", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const observation = workspace.newBlock("observation");
  syncRmAttributeInputs(observation, "OBSERVATION", ["data"]);
  const data = observation.getInput(rmAttributeInputName("data"));
  assert(data);
  const card = data.fieldRow.find((field) => isSlotCardinalityField(field));
  assert(card);
  assertEquals(card.getText(), formatSlotCardinality({ min: 1, max: 1 }));
  assertEquals(data.fieldRow.at(-1)?.name?.startsWith("SLOT_EMOJI_"), true);
  workspace.dispose();
});

Deno.test("unmapped mandatory ELEMENT shows a constraint warning", () => {
  ensureBlocks();
  const { skeleton } = generateSkeleton(fixture);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  const systolic = workspace.getAllBlocks(false).find(
    (b) => b.getFieldValue("NAME") === "Systolic" && b.type === "element",
  );
  assert(systolic, "expected systolic element");
  assertEquals(systolic.getFieldValue("MANDATORY"), "1");
  const text = warningTextOf(systolic) ?? blockConstraintMessages(systolic).join("\n");
  assertEquals(text.includes("Unmapped mandatory value"), true);
  workspace.dispose();
});

Deno.test("EVENT.data slot accepts ITEM_STRUCTURE (generic T bound)", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const event = workspace.newBlock("event");
  syncRmAttributeInputs(event, "EVENT", ["time", "data"]);
  const dataInput = event.getInput(rmAttributeInputName("data"));
  const check = dataInput?.connection?.getCheck() ?? [];
  assertEquals(check.includes("ITEM_STRUCTURE"), true);
  assertEquals(check.includes("ITEM_TREE"), true);
  workspace.dispose();
});

Deno.test("EVENT block warns while abstract and can switch subtype without dropping children", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const event = workspace.newBlock("event");
  event.setFieldValue("EVENT", "RM_TYPE");
  syncRmAttributeInputs(event, "EVENT", ["time", "data"]);
  const data = workspace.newBlock("item_tree");
  const dataInput = event.getInput(rmAttributeInputName("data"));
  assert(dataInput?.connection && data.previousConnection);
  dataInput.connection.connect(data.previousConnection);
  assertEquals(event.getInputTargetBlock(rmAttributeInputName("data"))?.id, data.id);
  refreshWorkspaceConstraints(workspace);
  assertEquals(blockConstraintMessages(event).includes(ABSTRACT_EVENT_WARNING), true);

  applyEventRmType(event, "POINT_EVENT");
  refreshWorkspaceConstraints(workspace);
  assertEquals(event.getFieldValue("RM_TYPE"), "POINT_EVENT");
  assertEquals(event.getInputTargetBlock(rmAttributeInputName("data"))?.id, data.id);
  assertEquals(blockConstraintMessages(event).includes(ABSTRACT_EVENT_WARNING), false);

  applyEventRmType(event, "INTERVAL_EVENT");
  assertEquals(event.getFieldValue("RM_TYPE"), "INTERVAL_EVENT");
  assertEquals(event.getInputTargetBlock(rmAttributeInputName("data"))?.id, data.id);
  assert(event.getInput(rmAttributeInputName("width")), "INTERVAL_EVENT.width should appear");
  assert(event.getInput(rmAttributeInputName("math_function")), "INTERVAL_EVENT.math_function should appear");
  workspace.dispose();
});

Deno.test("Blockly JSON extraState restores dynamic ATTR_ sockets including EVENT extras", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const observation = workspace.newBlock("observation");
  syncRmAttributeInputs(observation, "OBSERVATION", ["data", "encoding"]);
  const event = workspace.newBlock("event");
  applyEventRmType(event, "INTERVAL_EVENT");
  const tree = workspace.newBlock("item_tree");
  event.getInput(rmAttributeInputName("data"))!.connection!.connect(tree.previousConnection!);

  const saved = Blockly.serialization.workspaces.save(workspace);
  workspace.dispose();

  const loaded = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(saved, loaded);
  const obs2 = loaded.getAllBlocks(false).find((b) => b.type === "observation");
  const ev2 = loaded.getAllBlocks(false).find((b) => b.type === "event");
  assert(obs2?.getInput(rmAttributeInputName("encoding")), "ATTR_encoding must round-trip");
  assertEquals(ev2?.getFieldValue("RM_TYPE"), "INTERVAL_EVENT");
  assert(ev2?.getInput(rmAttributeInputName("width")), "INTERVAL width must round-trip");
  assertEquals(ev2?.getInputTargetBlock(rmAttributeInputName("data"))?.type, "item_tree");
  loaded.dispose();
});

Deno.test("PARTY_IDENTIFIED exposes identity slots for compositions", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const party = workspace.newBlock("party_identified");
  assert(party.getInput(rmAttributeInputName("name")), "party_identified should expose name");
  assert(party.getInput(rmAttributeInputName("identifiers")), "party_identified should expose identifiers");
  assert(party.getInput(rmAttributeInputName("external_ref")), "party_identified should expose external_ref");
  const idInput = party.getInput(rmAttributeInputName("identifiers"));
  const idCheck = idInput?.connection?.getCheck() ?? [];
  assert(
    Array.isArray(idCheck) && idCheck.includes("lists_create_with"),
    "identifiers accepts lists_create_with for List<DV_IDENTIFIER>",
  );
  const refInput = party.getInput(rmAttributeInputName("external_ref"));
  const refCheck = refInput?.connection?.getCheck();
  assert(
    refCheck === "party_ref" || (Array.isArray(refCheck) && refCheck.includes("party_ref")),
    `external_ref should accept party_ref, got ${JSON.stringify(refCheck)}`,
  );
  workspace.dispose();
});

Deno.test("party_ref and dv_identifier blocks are registered", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const ref = workspace.newBlock("party_ref");
  assert(ref.getInput(rmAttributeInputName("id")));
  assert(ref.getInput(rmAttributeInputName("namespace")));
  assert(ref.getInput(rmAttributeInputName("type")));
  const ident = workspace.newBlock("dv_identifier");
  assert(ident.getInput(dvFieldInputName("id")));
  workspace.dispose();
});

Deno.test("ITEM_STRUCTURE block warns while abstract and morphs without dropping children", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const structure = workspace.newBlock("item_structure");
  structure.setFieldValue("ITEM_STRUCTURE", "RM_TYPE");
  syncRmAttributeInputs(structure, "ITEM_STRUCTURE", ["name", "items"]);
  const tree = workspace.newBlock("cluster");
  const itemsInput = structure.getInput(rmAttributeInputName("items"));
  assert(itemsInput?.connection && tree.previousConnection);
  itemsInput.connection.connect(tree.previousConnection);
  refreshWorkspaceConstraints(workspace);
  assertEquals(blockConstraintMessages(structure).includes(ABSTRACT_ITEM_STRUCTURE_WARNING), true);

  applyItemStructureRmType(structure, "ITEM_TREE");
  refreshWorkspaceConstraints(workspace);
  assertEquals(structure.getFieldValue("RM_TYPE"), "ITEM_TREE");
  assertEquals(structure.getInputTargetBlock(rmAttributeInputName("items"))?.id, tree.id);
  assertEquals(blockConstraintMessages(structure).includes(ABSTRACT_ITEM_STRUCTURE_WARNING), false);

  applyItemStructureRmType(structure, "ITEM_TABLE");
  assertEquals(structure.getFieldValue("RM_TYPE"), "ITEM_TABLE");
  assertEquals(structure.getInputTargetBlock(rmAttributeInputName("items"))?.id, tree.id);
  assert(structure.getInput(rmAttributeInputName("rows")), "ITEM_TABLE.rows should appear");
  workspace.dispose();
});

Deno.test("optional RM mutator flyout lists one labeled block per option", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const composition = workspace.newBlock("composition");
  assert(composition.getField("MUTATOR_COG"), "cogwheel belongs after skeleton title");
  const flyout = buildOptionalRmFlyoutContents(composition, []);
  assert(flyout.length > 1, `expected multiple flyout options, got ${flyout.length}`);
  assert(
    flyout.every((entry) => entry.extraState?.attr && entry.extraState?.label),
    "each flyout block carries attr + human label",
  );
  const withoutFeeder = buildOptionalRmFlyoutContents(composition, ["feeder_audit"]);
  assertEquals(
    withoutFeeder.some((entry) => entry.extraState?.attr === "feeder_audit"),
    false,
    "already-added options disappear from the flyout",
  );

  const bubble = new Blockly.Workspace();
  const item = bubble.newBlock(OPTIONAL_RM_MUTATOR_ITEM);
  applyMutatorItemLabel(item, "feeder_audit", "Feeder audit (feeder_audit)");
  assertEquals(item.getFieldValue("ATTR"), "feeder_audit");
  assertEquals(item.getFieldValue("LABEL"), "Feeder audit (feeder_audit)");
  workspace.dispose();
  bubble.dispose();
});

Deno.test("optional RM mutator cogwheel adds extras and orphans on remove", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const composition = workspace.newBlock("composition");
  assertEquals(composition.getInput("PLUS"), null);
  assertEquals(typeof composition.decompose, "function");
  assertEquals(typeof composition.compose, "function");

  const bubble = new Blockly.Workspace();
  const container = composition.decompose!(bubble);
  const item = bubble.newBlock(OPTIONAL_RM_MUTATOR_ITEM);
  applyMutatorItemLabel(item, "feeder_audit", "Feeder audit (feeder_audit)");
  container.getInput("STACK")!.connection!.connect(item.previousConnection!);
  composition.compose!(container);
  assert(composition.getInput(optionalRmInputName("feeder_audit")));

  const audit = workspace.newBlock("feeder_audit");
  composition.getInput(optionalRmInputName("feeder_audit"))!.connection!
    .connect(audit.previousConnection!);
  const auditId = audit.id;

  composition.saveConnections?.(container);
  composition.compose!(container);
  assertEquals(
    composition.getInput(optionalRmInputName("feeder_audit"))?.connection
      ?.targetBlock()?.id,
    auditId,
  );

  const emptyWs = new Blockly.Workspace();
  const empty = emptyWs.newBlock(OPTIONAL_RM_MUTATOR_CONTAINER);
  composition.compose!(empty);
  assertEquals(composition.getInput(optionalRmInputName("feeder_audit")), null);
  assertEquals(workspace.getBlockById(auditId)?.id, auditId);

  workspace.dispose();
  bubble.dispose();
  emptyWs.dispose();
});

Deno.test("DATA_VALUE mutator adds optional fields and has no plus-fields button", () => {
  ensureBlocks();
  const workspace = new Blockly.Workspace();
  const qty = workspace.newBlock("dv_quantity");
  assertEquals(qty.getInput("PLUS_FIELDS"), null);
  assertEquals(typeof qty.decompose, "function");

  const bubble = new Blockly.Workspace();
  const container = qty.decompose!(bubble);
  const item = bubble.newBlock(DV_FIELDS_MUTATOR_ITEM);
  const fieldName = item.getFieldValue("ATTR") || "normal_status";
  applyMutatorItemLabel(item, fieldName, fieldName);
  container.getInput("STACK")!.connection!.connect(item.previousConnection!);
  qty.compose!(container);
  assert(
    qty.inputList.some((input) => input.name.startsWith("OPTFLD_")),
    `expected optional DV field, inputs=${qty.inputList.map((i) => i.name).join(",")}`,
  );
  workspace.dispose();
  bubble.dispose();
});

Deno.test("mutator cogwheel anchor is positioned on MUTATOR_COG field and toggles", async () => {
  ensureBlocks();
  const { openBlockMutator, getCogwheelAnchorLocation } = await import(
    "@intehrgrator/blockly/dynamic_mutator.ts"
  );
  const workspace = new Blockly.Workspace();
  const composition = workspace.newBlock("composition");
  const field = composition.getField("MUTATOR_COG");
  assert(field, "MUTATOR_COG field exists");

  const anchor = getCogwheelAnchorLocation(composition as unknown as import("blockly/core").BlockSvg);
  assert(anchor, "anchor coordinate returned");

  let visible = false;
  const fakeIcon = {
    bubbleIsVisible: () => visible,
    setBubbleVisible: (v: boolean) => {
      visible = v;
      return Promise.resolve();
    },
  };
  (composition as unknown as { getIcons: () => unknown[] }).getIcons = () => [fakeIcon];

  openBlockMutator(composition);
  assertEquals(visible, true, "openBlockMutator opens when closed");
  openBlockMutator(composition);
  assertEquals(visible, false, "openBlockMutator closes when already open");

  workspace.dispose();
});

Deno.test("autoSizeMutatorBubble calculates content bounds and enlarges bubble", async () => {
  ensureBlocks();
  const { autoSizeMutatorBubble } = await import(
    "@intehrgrator/blockly/dynamic_mutator.ts"
  );
  const miniWs = new Blockly.Workspace();
  let appliedSize: { width: number; height: number } | null = null;
  const fakeBubble = {
    getWorkspace: () => miniWs as unknown as import("blockly/core").WorkspaceSvg,
    setSize: (size: { width: number; height: number }) => {
      appliedSize = size;
    },
    getSize: () => appliedSize ?? { width: 300, height: 200 },
  };

  autoSizeMutatorBubble(fakeBubble);
  assert(appliedSize, "applied size to bubble");
  assert((appliedSize as { width: number }).width >= 380, "width at least 380");
  assert((appliedSize as { height: number }).height >= 240, "height at least 240");
  miniWs.dispose();
});
