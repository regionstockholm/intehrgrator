/**
 * Slot captions hug mouths on every block type that has a socket row
 * (issue #90): stock lists, CODE_PHRASE / DV fields, XML, and RM.
 * Statement snap sits on the visual C bump (issue #105).
 */
import { assert, assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import { FieldSlotLabel, isSlotLabelField } from "@intehrgrator/blockly/slot_label.ts";
import { enforceMouthCaptionLayout } from "@intehrgrator/blockly/mouth_layout.ts";
import {
  DV_FIELDS_MUTATOR_CONTAINER,
  OPTIONAL_RM_MUTATOR_CONTAINER,
  composeOptionalRmExtras,
  dvFieldInputName,
  registerRmBlocks,
  rmAttributeInputName,
} from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import {
  applyOpenEhrRowAlign_,
  padBeforeTrailingChrome_,
  pinStatementRowNotch_,
  shouldPinSlotCaptionToMouth_,
} from "@intehrgrator/blockly/compact_renderer.ts";
import { SCHEMA_MUTATOR_CONTAINER } from "@intehrgrator/blockly/blocks/schema_mutator.ts";
import { XML_DOCUMENT_MUTATOR_CONTAINER } from "@intehrgrator/blockly/blocks/xml_blocks.ts";
import { MAPS_CREATE_WITH_CONTAINER } from "@intehrgrator/blockly/blocks/map_blocks.ts";
import { XML_ATTRIBUTES_INPUT, XML_ELEMENT_TYPE } from "@intehrgrator/core/xml_shape.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  registerRmBlocks();
  ready = true;
}

const AlignRight = () => Blockly.inputs.Align.RIGHT;
const AlignLeft = () => Blockly.inputs.Align.LEFT;

Deno.test("lists_create_with item sockets hug the right (not a left-aligned C)", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const list = ws.newBlock("lists_create_with") as Blockly.Block & {
    itemCount_: number;
    updateShape_: () => void;
  };
  list.itemCount_ = 3;
  list.updateShape_();
  enforceMouthCaptionLayout(list);
  assertEquals(list.getInputsInline(), false);
  const add0 = list.getInput("ADD0");
  assert(add0, "ADD0");
  assertEquals(add0.align, AlignRight());
  const add2 = list.getInput("ADD2");
  assert(add2, "ADD2");
  assertEquals(add2.align, AlignRight());
  ws.dispose();
});

Deno.test("CODE_PHRASE and DV_CODED_TEXT attribute captions are slot labels hugging mouths", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const phrase = ws.newBlock("code_phrase");
  assertEquals(phrase.getInputsInline(), false);
  const code = phrase.getInput(dvFieldInputName("code_string"));
  const terminology = phrase.getInput(dvFieldInputName("terminology_id"));
  assert(code && terminology);
  assertEquals(code.align, AlignRight());
  assertEquals(terminology.align, AlignRight());
  assert(code.fieldRow.some((f) => isSlotLabelField(f)), "code uses FieldSlotLabel");
  assert(terminology.fieldRow.some((f) => isSlotLabelField(f)), "terminology uses FieldSlotLabel");

  const coded = ws.newBlock("dv_coded_text");
  assertEquals(coded.getInputsInline(), false);
  const value = coded.getInput(dvFieldInputName("value"));
  const defining = coded.getInput(dvFieldInputName("defining_code"));
  assert(value && defining, "DV_CODED_TEXT value + defining_code");
  assertEquals(value.align, AlignRight());
  assertEquals(defining.align, AlignRight());
  assert(value.fieldRow.some((f) => isSlotLabelField(f)), "value uses FieldSlotLabel");
  assert(defining.fieldRow.some((f) => isSlotLabelField(f)), "defining_code uses FieldSlotLabel");
  ws.dispose();
});

Deno.test("XML and RM still hug mouths after the shared layout routine", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const el = ws.newBlock(XML_ELEMENT_TYPE);
  assertEquals(el.getInput(XML_ATTRIBUTES_INPUT)?.align, AlignRight());
  const observation = ws.newBlock("observation");
  assertEquals(observation.getInput("HEADER")?.align, AlignLeft());
  assertEquals(observation.getInput(rmAttributeInputName("data"))?.align, AlignRight());
  assertEquals(observation.getInputsInline(), false);
  ws.dispose();
});

Deno.test("renderer: statement-row captions RIGHT-align so they hug the C", () => {
  const AlignL = -1;
  const AlignR = 1;
  const mouth = {
    hasStatement: true,
    align: AlignL,
    elements: [
      { field: { name: "MUTATOR_COG" } },
      { field: { name: "TEXT" } },
    ],
  };
  applyOpenEhrRowAlign_(mouth, AlignL, AlignR);
  assertEquals(mouth.align, AlignR);

  const header = {
    hasStatement: false,
    hasExternalInput: false,
    hasInlineInput: false,
    align: AlignL,
    elements: [
      { field: { name: "MUTATOR_COG" } },
      { field: { name: "NAME" } },
    ],
  };
  applyOpenEhrRowAlign_(header, AlignL, AlignR);
  assertEquals(header.align, AlignL);
});

Deno.test("renderer leftover on HEADER sits before the cog and type glyph", () => {
  const spacer = { width: 4 };
  const row = {
    elements: [
      { field: { name: "NAME" } },
      spacer,
      { field: { name: "MUTATOR_COG" } },
      { field: { name: "RM_OUT_EMOJI" } },
    ],
  };
  assertEquals(padBeforeTrailingChrome_(row, 40), true);
  assertEquals(spacer.width, 44);
});

Deno.test("renderer leftover splices a spacer when chrome has no leftover element", () => {
  const row = {
    elements: [
      { field: { name: "NAME" } },
      { field: { name: "MUTATOR_COG" } },
      { field: { name: "RM_OUT_EMOJI" } },
    ],
  };
  assertEquals(padBeforeTrailingChrome_(row, 32), true);
  assertEquals(row.elements[1], { width: 32 });
  assertEquals(row.elements[2]?.field?.name, "MUTATOR_COG");
});

Deno.test("renderer pins ordinary mouth captions, not only FieldSlotLabel", () => {
  const plain = { field: { name: "TEXT" } };
  assertEquals(
    shouldPinSlotCaptionToMouth_({ hasStatement: true }, plain),
    true,
  );
  assertEquals(
    shouldPinSlotCaptionToMouth_({ hasExternalInput: true }, { field: new FieldSlotLabel("value") }),
    true,
  );
  assertEquals(
    shouldPinSlotCaptionToMouth_({ hasStatement: false, hasExternalInput: false, hasInlineInput: false }, plain),
    false,
  );
});

Deno.test("RIGHT-packed statement mouths snap at the visual C bump, not the leftover left column", () => {
  // Caption 80px + compact C 40px, leftover 60px padded left (openEHR pack).
  // Blockly computeBounds_ left statementEdge at the caption column (80).
  const row = {
    xPos: 10,
    width: 180,
    statementEdge: 80,
    getLastInput: () => ({ width: 40, notchOffset: 15 }),
  };
  pinStatementRowNotch_(row);
  assertEquals(row.statementEdge, 140);
  const connX = Number(row.xPos) + Number(row.statementEdge) + 15;
  assertEquals(connX, 165);
});

Deno.test("LEFT-packed statement mouths snap after the caption, not at ownWidth", () => {
  // COMPOSITION.content (issue #150): caption ~66px, outline 316px, leftover
  // on the right of the C. Pin to the drawn tooth, not the far outline edge.
  const row = {
    xPos: 0,
    width: 316,
    statementEdge: 316,
    getLastInput: () => ({ width: 40, xPos: 66, notchOffset: 15 }),
  };
  pinStatementRowNotch_(row);
  assertEquals(row.statementEdge, 66);
});

Deno.test("stretched C still snaps at the drawn tooth xPos, not width-minus-C = 0", () => {
  // Mutator STACK / XML document: Thrasos stretched input.width to the row,
  // then compact packing moved the C right. Visual tooth is input.xPos.
  const row = {
    xPos: 0,
    width: 120,
    statementEdge: 14,
    getLastInput: () => ({ width: 120, xPos: 88, notchOffset: 15 }),
  };
  pinStatementRowNotch_(row);
  assertEquals(row.statementEdge, 88);
  assertEquals(Number(row.xPos) + Number(row.statementEdge) + 15, 103);
});

Deno.test("mutator STACK mouths hug the C (RIGHT, leftover left of the caption)", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const types = [
    OPTIONAL_RM_MUTATOR_CONTAINER,
    DV_FIELDS_MUTATOR_CONTAINER,
    SCHEMA_MUTATOR_CONTAINER,
    XML_DOCUMENT_MUTATOR_CONTAINER,
    MAPS_CREATE_WITH_CONTAINER,
  ];
  for (const type of types) {
    const block = ws.newBlock(type);
    const stack = block.getInput("STACK");
    assertEquals(
      stack?.align,
      AlignRight(),
      `${type} STACK caption should hug the C`,
    );
    assert(
      (stack?.fieldRow.length ?? 0) > 0,
      `${type} STACK title sits on the statement row, not a dummy row`,
    );
  }
  ws.dispose();
});

Deno.test("ITEM_TREE items statement mouth hugs the C (RIGHT)", () => {
  ensure();
  const ws = new Blockly.Workspace();
  const tree = ws.newBlock("item_tree");
  composeOptionalRmExtras(tree, ["items"]);
  const items = tree.getInput("ATTR_items") ?? tree.getInput("OPT_items");
  assert(items, "items mouth");
  assertEquals(items.align, AlignRight());
  ws.dispose();
});
