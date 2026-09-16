import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  auditBlocklyState,
  auditRoundTripReload,
  runSnapMatrixAudit,
  snapMatrixCases,
} from "@intehrgrator/blockly/connection_audit.ts";
import {
  configureElementValueSlot,
  restoreElementValueSlot,
} from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { generateSkeleton } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { loadSkeletonIntoWorkspace } from "@intehrgrator/blockly/skeleton_loader.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { ensureSnapBlocks } from "./block_snap_helpers.ts";

const fixture = await Deno.readTextFile(
  join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
);

Deno.test("restoreElementValueSlot re-applies typed ELEMENT.value after Blockly load", () => {
  ensureSnapBlocks();
  const ws = new Blockly.Workspace();
  const element = ws.newBlock("element");
  element.setFieldValue("DV_QUANTITY", "RM_TYPE");
  configureElementValueSlot(element, "DV_QUANTITY");
  ws.newBlock("dv_quantity").outputConnection!.connect(element.getInput("VALUE")!.connection!);

  const saved = Blockly.serialization.workspaces.save(ws);
  ws.dispose();

  const reloaded = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(saved, reloaded);
  assertEquals(
    reloaded.getAllBlocks(false).find((b) => b.type === "element")
      ?.getInput("VALUE")?.connection?.getCheck(),
    ["DATA_VALUE"],
    "generic DATA_VALUE check before restore",
  );
  restoreElementValueSlot(reloaded.getAllBlocks(false).find((b) => b.type === "element")!);
  assertEquals(
    reloaded.getAllBlocks(false).find((b) => b.type === "element")
      ?.getInput("VALUE")?.connection?.getCheck(),
    ["DV_QUANTITY"],
  );
  reloaded.dispose();
});

Deno.test("snap matrix audit passes for core block families", () => {
  ensureSnapBlocks();
  const ws = new Blockly.Workspace();
  try {
    const matrix = runSnapMatrixAudit(ws);
    assertEquals(matrix.failed, 0, matrix.failures.map((f) => f.detail ?? f.label).join("; "));
    assert(matrix.passed, matrix.total);
  } finally {
    ws.dispose();
  }
});

Deno.test("round-trip reload keeps connections and typed ELEMENT.value checks", () => {
  ensureSnapBlocks();
  const ws = new Blockly.Workspace();
  try {
    const roundTrip = auditRoundTripReload(ws);
    assertEquals(roundTrip.failed, 0, roundTrip.failures.map((f) => f.detail ?? f.label).join("; "));
  } finally {
    ws.dispose();
  }
});

Deno.test("blood pressure skeleton Blockly JSON passes connection audit after reload", () => {
  ensureSnapBlocks();
  const { skeleton } = generateSkeleton(fixture);
  const ws = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(ws, skeleton, createEmptyModel("t"), null);
  const saved = Blockly.serialization.workspaces.save(ws);
  ws.dispose();

  const report = auditBlocklyState(saved, { includeRoundTrip: false });
  assert(report.ok, report.failures.map((f) => `${f.label}: ${f.detail ?? ""}`).join("\n"));
  assert(report.connected.total > 0, "expected live connections on scaffold");
});

Deno.test("snap matrix case catalog stays in sync with exported expectations", () => {
  assert(snapMatrixCases().length >= 15);
  assert(snapMatrixCases().some((c) => c.label.includes("Conversion start")));
});
