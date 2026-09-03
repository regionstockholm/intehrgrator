import { assertEquals } from "@std/assert";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { initBlocklyGenerators } from "@intehrgrator/blockly/mod.ts";
import {
  isPlaceholderSourcePath,
  listeningTargetFromBlock,
  PLACEHOLDER_SOURCE_PATH,
} from "@intehrgrator/blockly/listening.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

Deno.test("isPlaceholderSourcePath treats empty and /path as unmapped", () => {
  assertEquals(isPlaceholderSourcePath(""), true);
  assertEquals(isPlaceholderSourcePath("  "), true);
  assertEquals(isPlaceholderSourcePath(PLACEHOLDER_SOURCE_PATH), true);
  assertEquals(isPlaceholderSourcePath("$.systolic"), false);
});

Deno.test("listeningTargetFromBlock: placeholder source query in an ELEMENT arms the slot", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const slot = workspace.newBlock("target_value");
  slot.setFieldValue("slot/systolic", "SLOT_ID");
  const query = workspace.newBlock("source_query_number");
  query.setFieldValue(PLACEHOLDER_SOURCE_PATH, "EXPRESSION");
  slot.getInput("VALUE")?.connection?.connect(query.outputConnection!);

  const fromQuery = listeningTargetFromBlock(query);
  assertEquals(fromQuery, { kind: "slot", slotId: "slot/systolic" });
  workspace.dispose();
});

Deno.test("listeningTargetFromBlock: free-floating placeholder source query arms the block", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const query = workspace.newBlock("source_query");
  query.setFieldValue(PLACEHOLDER_SOURCE_PATH, "EXPRESSION");
  const target = listeningTargetFromBlock(query);
  assertEquals(target?.kind, "source_block");
  assertEquals(target && target.kind === "source_block" ? target.blockId : null, query.id);
  workspace.dispose();
});

Deno.test("listeningTargetFromBlock: mapped source query is selection only", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const query = workspace.newBlock("source_query_number");
  query.setFieldValue("$.systolic", "EXPRESSION");
  assertEquals(listeningTargetFromBlock(query), null);
  workspace.dispose();
});

Deno.test("listeningTargetFromBlock: source_query_node with placeholder arms the block", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const query = workspace.newBlock("source_query_node");
  query.setFieldValue(PLACEHOLDER_SOURCE_PATH, "EXPRESSION");
  const target = listeningTargetFromBlock(query);
  assertEquals(target?.kind, "source_block");
  assertEquals(target && target.kind === "source_block" ? target.blockId : null, query.id);
  workspace.dispose();
});

Deno.test("listeningTargetFromBlock: source_query_node with mapped path is selection only", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const query = workspace.newBlock("source_query_node");
  query.setFieldValue("$.patient", "EXPRESSION");
  assertEquals(listeningTargetFromBlock(query), null);
  workspace.dispose();
});
