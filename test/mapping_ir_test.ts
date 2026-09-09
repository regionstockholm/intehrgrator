import { assert, assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  applyModelLoops,
  initBlocklyGenerators,
  workspaceToModelJson,
} from "@intehrgrator/blockly/mod.ts";
import { rmAttributeInputName, syncRmAttributeInputs } from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { MODEL_VERSION } from "@intehrgrator/types/mod.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

function connectDo(loop: Blockly.Block, body: Blockly.Block): void {
  loop.getInput("DO")!.connection!.connect(body.previousConnection!);
}

Deno.test("for_each_source + relative source_query appears with grain fields", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const loop = workspace.newBlock("for_each_source");
  loop.setFieldValue("measurements", "VAR");
  loop.setFieldValue("$.measurements", "PATH");

  const event = workspace.newBlock("event");
  event.setFieldValue("evt-1", "SLOT_ID");
  event.setFieldValue("EVENT", "RM_TYPE");
  connectDo(loop, event);

  const slot = workspace.newBlock("target_value");
  slot.setFieldValue("slot/rate", "SLOT_ID");
  slot.setFieldValue("DV_QUANTITY", "TARGET_TYPE");
  event.nextConnection!.connect(slot.previousConnection!);

  const src = workspace.newBlock("source_query_number");
  src.setFieldValue("pulse", "EXPRESSION");
  slot.getInput("VALUE")!.connection!.connect(src.outputConnection!);

  const ir = workspaceToModelJson(workspace);
  assertEquals(ir.loops, [{
    attachSlotId: "evt-1",
    varName: "measurements",
    path: "$.measurements",
    kind: "source",
  }]);
  const rate = ir.slots.find((s) => s.slotId === "slot/rate");
  assertEquals(rate?.expression, 'xpathNumber("pulse")');
  workspace.dispose();
});

Deno.test("for_each_list extracts kind list and collection expression", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const loop = workspace.newBlock("for_each_list");
  loop.setFieldValue("code", "VAR");

  const list = workspace.newBlock("lists_create_with") as Blockly.Block & {
    itemCount_?: number;
    updateShape_?: () => void;
  };
  list.itemCount_ = 2;
  list.updateShape_?.();
  const a = workspace.newBlock("text");
  a.setFieldValue("I10", "TEXT");
  const b = workspace.newBlock("text");
  b.setFieldValue("E11", "TEXT");
  list.getInput("ADD0")!.connection!.connect(a.outputConnection!);
  list.getInput("ADD1")!.connection!.connect(b.outputConnection!);
  loop.getInput("LIST")!.connection!.connect(list.outputConnection!);

  const element = workspace.newBlock("element");
  element.setFieldValue("slot/code", "SLOT_ID");
  element.setFieldValue("DV_TEXT", "RM_TYPE");
  connectDo(loop, element);

  const item = workspace.newBlock("variables_get");
  element.getInput("VALUE")!.connection!.connect(item.outputConnection!);

  const ir = workspaceToModelJson(workspace);
  assertEquals(ir.loops.length, 1);
  assertEquals(ir.loops[0]!.kind, "list");
  assertEquals(ir.loops[0]!.attachSlotId, "slot/code");
  assertEquals(ir.loops[0]!.varName, "code");
  assertEquals(ir.loops[0]!.collection, 'list("I10", "E11")');
  assertEquals(ir.loops[0]!.path, "");
  workspace.dispose();
});

Deno.test("text_code LANG is recorded as an escape hatch, not a silent drop", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const slot = workspace.newBlock("target_value");
  slot.setFieldValue("slot/note", "SLOT_ID");
  slot.setFieldValue("DV_TEXT", "TARGET_TYPE");
  const code = workspace.newBlock("text_code");
  code.setFieldValue("go-template", "LANG");
  code.setFieldValue('{{ index .Data "raw" }}', "TEXT");
  slot.getInput("VALUE")!.connection!.connect(code.outputConnection!);

  const ir = workspaceToModelJson(workspace);
  const mapped = ir.slots.find((s) => s.slotId === "slot/note");
  assertEquals(mapped?.expression, JSON.stringify('{{ index .Data "raw" }}'));
  assertEquals(mapped?.hatch, { kind: "text_code", lang: "go-template" });
  assert(
    ir.unsupported.some((u) =>
      u.blockType === "text_code" && u.reason === "escape" && u.lang === "go-template"
    ),
    `expected text_code escape, got ${JSON.stringify(ir.unsupported)}`,
  );
  workspace.dispose();
});

Deno.test("Remove-list blocks are unsupported/removed, not first-class IR", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const iff = workspace.newBlock("controls_if");
  const loop = workspace.newBlock("controls_whileUntil");
  loop.setFieldValue("WHILE", "MODE");

  const ir = workspaceToModelJson(workspace);
  assert(ir.unsupported.some((u) => u.blockType === "controls_if" && u.reason === "removed"));
  assert(ir.unsupported.some((u) => u.blockType === "controls_whileUntil" && u.reason === "removed"));
  assertEquals(ir.loops.some((l) => l.kind === "source" && !l.path), false);
  assertEquals(
    ir.loops.some((l) => (l as { if?: unknown }).if != null),
    false,
    "no If node on loops[]",
  );
  assertEquals(iff.type, "controls_if");
  workspace.dispose();
});

Deno.test("nested target signature walks RM parent/child SLOT_IDs", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const cluster = workspace.newBlock("cluster");
  cluster.setFieldValue("c1", "SLOT_ID");
  cluster.setFieldValue("CLUSTER", "RM_TYPE");
  syncRmAttributeInputs(cluster, "CLUSTER", ["items"]);

  const element = workspace.newBlock("element");
  element.setFieldValue("e1", "SLOT_ID");
  element.setFieldValue("ELEMENT", "RM_TYPE");
  cluster.getInput(rmAttributeInputName("items"))!.connection!.connect(element.previousConnection!);

  const ir = workspaceToModelJson(workspace);
  assertEquals(ir.targetSignature.length, 1);
  assertEquals(ir.targetSignature[0]!.slotId, "c1");
  assertEquals(ir.targetSignature[0]!.rmType, "CLUSTER");
  assertEquals(ir.targetSignature[0]!.children.map((c) => c.slotId), ["e1"]);
  assertEquals(ir.targetSignature[0]!.children[0]!.optional, undefined);
  workspace.dispose();
});

Deno.test("sheet accessors collect sheetNames", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const decl = workspace.newBlock("sheet");
  decl.setFieldValue("icd10_snomed", "NAME");
  const lookup = workspace.newBlock("sheet_lookup");
  lookup.setFieldValue("icd10_snomed", "NAME");
  const ir = workspaceToModelJson(workspace);
  assertEquals(ir.sheetNames, ["icd10_snomed"]);
  workspace.dispose();
});

Deno.test("Blockly JSON round-trip preserves Mapping Model IR", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const loop = workspace.newBlock("for_each_source");
  loop.setFieldValue("item", "VAR");
  loop.setFieldValue("/items", "PATH");
  const event = workspace.newBlock("event");
  event.setFieldValue("evt-1", "SLOT_ID");
  connectDo(loop, event);
  const slot = workspace.newBlock("target_value");
  slot.setFieldValue("slot/name", "SLOT_ID");
  event.nextConnection!.connect(slot.previousConnection!);
  const src = workspace.newBlock("source_query");
  src.setFieldValue("name", "EXPRESSION");
  slot.getInput("VALUE")!.connection!.connect(src.outputConnection!);

  const first = workspaceToModelJson(workspace);
  const saved = Blockly.serialization.workspaces.save(workspace);
  workspace.dispose();

  const loaded = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(saved, loaded);
  const second = workspaceToModelJson(loaded);
  assertEquals(second.loops, first.loops);
  assertEquals(second.slots, first.slots);
  assertEquals(second.targetSignature, first.targetSignature);
  loaded.dispose();
});

Deno.test("applyModelLoops restores for_each_list from IR", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const element = workspace.newBlock("element");
  element.setFieldValue("slot/code", "SLOT_ID");
  const model = createEmptyModel("t1");
  model.loops = [{
    attachSlotId: "slot/code",
    varName: "code",
    path: "",
    kind: "list",
    collection: 'list("I10")',
  }];
  applyModelLoops(workspace, model);
  const parent = element.getParent();
  assertEquals(parent?.type, "for_each_list");
  assertEquals(parent?.getFieldValue("VAR"), "code");
  const ir = workspaceToModelJson(workspace);
  assertEquals(ir.loops[0]?.kind, "list");
  assertEquals(ir.loops[0]?.collection, 'list("I10")');
  workspace.dispose();
});

Deno.test("empty model uses Mapping Model version 3", () => {
  assertEquals(createEmptyModel("t").modelVersion, MODEL_VERSION);
  assertEquals(MODEL_VERSION, 3);
});
