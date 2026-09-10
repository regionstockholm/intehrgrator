/**
 * Constraint Overlay Phase 1: RM vs effective OPT on Attribute mouths and
 * prohibited Optional RM Insertion rows.
 *
 * @see docs/planning/prd-constraint-overlay-on-rm-blocks.md
 * @see docs/adr/0007-constraint-overlay-on-rm-block-mouths.md
 */
import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import type { SkeletonNode } from "@intehrgrator/types/mod.ts";
import { generateSkeleton, generateSkeletonFromOperational } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { OVERLAY_DELTA } from "@intehrgrator/core/cardinality.ts";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import { registerRmBlocks } from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { registerExpressionBlocks } from "@intehrgrator/blockly/blocks/expression_blocks.ts";
import {
  buildOptionalRmFlyoutContents,
  composeOptionalRmExtras,
  optionalRmInputName,
  prohibitedRmInputName,
  rmAttributeInputName,
} from "@intehrgrator/blockly/blocks/rm_blocks.ts";
import { isSlotLabelField, FieldSlotLabel } from "@intehrgrator/blockly/slot_label.ts";
import { loadSkeletonIntoWorkspace } from "@intehrgrator/blockly/skeleton_loader.ts";
import {
  blockConstraintMessages,
  refreshWorkspaceConstraints,
} from "@intehrgrator/blockly/block_constraints.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { formatSlotCardinality } from "@intehrgrator/blockly/slot_cardinality.ts";

const bpOpt = await Deno.readTextFile(
  join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
);

let blocksReady = false;
function ensureBlocks(): void {
  if (blocksReady) return;
  registerRmBlocks();
  registerExpressionBlocks();
  blocksReady = true;
}

function occ(lower: number, upper: number | null) {
  return {
    lower,
    upper: upper ?? undefined,
    upper_unbounded: upper == null,
  };
}

/** Small OPT: mandation overlay, quiet RM-matching mouth, prohibited protocol. */
function overlayFixtureOpt() {
  return {
    template_id: { value: "overlay_fixture" },
    original_language: "en",
    definition: {
      rm_type_name: "COMPOSITION",
      node_id: "at0000",
      occurrences: occ(1, 1),
      attributes: [
        {
          rm_attribute_name: "context",
          existence: occ(1, 1),
          children: [{
            rm_type_name: "EVENT_CONTEXT",
            node_id: "at0001",
            attributes: [],
          }],
        },
        {
          rm_attribute_name: "content",
          children: [{
            rm_type_name: "OBSERVATION",
            node_id: "at0002",
            occurrences: occ(1, 1),
            attributes: [
              {
                rm_attribute_name: "data",
                existence: occ(1, 1),
                children: [{
                  rm_type_name: "HISTORY",
                  node_id: "at0003",
                  occurrences: occ(1, 1),
                  attributes: [{
                    rm_attribute_name: "events",
                    cardinality: { interval: occ(1, 1) },
                    children: [{
                      rm_type_name: "POINT_EVENT",
                      node_id: "at0004",
                      occurrences: occ(1, 1),
                      attributes: [],
                    }],
                  }],
                }],
              },
              {
                rm_attribute_name: "protocol",
                existence: occ(0, 0),
                children: [],
              },
              {
                rm_attribute_name: "state",
                is_prohibited: true,
                children: [],
              },
            ],
          }],
        },
      ],
    },
  };
}

function flatten(nodes: SkeletonNode[]): SkeletonNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

function slotLabelOn(block: Blockly.Block, attr: string) {
  const input = block.getInput(rmAttributeInputName(attr));
  const field = input?.fieldRow.find((item) => isSlotLabelField(item));
  return field && isSlotLabelField(field) ? field : undefined;
}

Deno.test("FieldSlotLabel overlay caption model: Δ, effective, struck-through RM", () => {
  const field = new FieldSlotLabel("context", {
    card: { min: 1, max: 1 },
    rmCard: { min: 0, max: 1 },
  });
  assertEquals(field.hasOverlay, true);
  assertEquals(field.min, 1);
  assertEquals(field.max, 1);
  assertEquals(field.rmMin, 0);
  assertEquals(field.rmMax, 1);
  assertEquals(field.getText().includes(OVERLAY_DELTA), true);
  assertEquals(field.getText().includes(formatSlotCardinality({ min: 1, max: 1 })), true);
  assertEquals(field.getText().includes(formatSlotCardinality({ min: 0, max: 1 })), true);
  assertEquals(
    field.overlayHelp(),
    "RM [0..1] narrowed to [1..1] by the operational template.",
  );

  const quiet = new FieldSlotLabel("data", {
    card: { min: 1, max: 1 },
    rmCard: { min: 1, max: 1 },
  });
  assertEquals(quiet.hasOverlay, false);
  assertEquals(quiet.getText().includes(OVERLAY_DELTA), false);
});

Deno.test("skeleton records RM vs effective intervals and prohibited attributes", () => {
  const { skeleton } = generateSkeletonFromOperational(overlayFixtureOpt());
  const nodes = flatten(skeleton);
  const composition = nodes.find((n) => n.rmType === "COMPOSITION");
  const observation = nodes.find((n) => n.rmType === "OBSERVATION");
  const history = nodes.find((n) => n.rmType === "HISTORY");
  const context = composition?.children.find((c) => c.rmAttribute === "context");
  assert(composition && observation && history && context);

  assertEquals(context.mandatory, true);
  assertEquals(context.rmCardinality, "0..1");
  assertEquals(context.effectiveCardinality, "1");

  const protocol = observation.attributeConstraints?.find((c) => c.name === "protocol");
  assert(protocol);
  assertEquals(protocol.prohibited, true);
  assertEquals(protocol.rmCardinality, "0..1");
  assertEquals(protocol.effectiveCardinality, "0..0");
  assertEquals(
    observation.children.some((c) => c.rmAttribute === "protocol"),
    false,
  );

  const state = observation.attributeConstraints?.find((c) => c.name === "state");
  assert(state);
  assertEquals(state.prohibited, true);
  assertEquals(state.effectiveCardinality, "0..0");

  const dataChild = observation.children.find((c) => c.rmAttribute === "data");
  assertEquals(dataChild?.rmCardinality, "1");
  assertEquals(dataChild?.effectiveCardinality, "1");

  const events = history.children.find((c) => c.rmAttribute === "events");
  assertEquals(events?.rmCardinality, "0..*");
  assertEquals(events?.effectiveCardinality, "1");
});

Deno.test("mandated mouth shows overlay; quiet sibling has no Δ; protocol is mutator-only", () => {
  ensureBlocks();
  const { skeleton } = generateSkeletonFromOperational(overlayFixtureOpt());
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("overlay_fixture"), null);

  const composition = workspace.getAllBlocks(false).find((b) => b.type === "composition");
  assert(composition);
  const contextLabel = slotLabelOn(composition, "context");
  assert(contextLabel);
  assertEquals(contextLabel.hasOverlay, true);
  assertEquals(contextLabel.min, 1);
  assertEquals(contextLabel.max, 1);
  assertEquals(contextLabel.rmMin, 0);
  assertEquals(contextLabel.rmMax, 1);
  assertEquals(composition.getInput(rmAttributeInputName("context")) != null, true);

  const flyout = buildOptionalRmFlyoutContents(composition, []);
  assertEquals(
    flyout.some((entry) => entry.extraState?.attr === "context"),
    false,
    "mandated context must not be an addable mutator option",
  );
  assertEquals(
    flyout.some((entry) => entry.extraState?.attr === "feeder_audit"),
    true,
    "unconstrained RM-optional feeder_audit stays addable",
  );

  const observation = workspace.getAllBlocks(false).find(
    (b) => b.getFieldValue("RM_TYPE") === "OBSERVATION",
  );
  assert(observation);
  assertEquals(observation.getInput(rmAttributeInputName("protocol")), null);
  assertEquals(
    buildOptionalRmFlyoutContents(observation, []).some((e) =>
      e.extraState?.attr === "protocol"
    ),
    false,
    "prohibited protocol is not addable",
  );
  assertEquals(
    buildOptionalRmFlyoutContents(observation, []).some((e) =>
      e.extraState?.attr === "feeder_audit"
    ),
    true,
  );

  const bubble = new Blockly.Workspace();
  const container = observation.decompose!(bubble);
  const prohibited = container.getInput(prohibitedRmInputName("protocol"));
  assert(prohibited, "protocol appears as a non-addable overlay row in the mutator");
  const prohibitedLabel = prohibited.fieldRow.find((f) => isSlotLabelField(f));
  assert(prohibitedLabel && isSlotLabelField(prohibitedLabel));
  assertEquals(prohibitedLabel.hasOverlay, true);
  assertEquals(prohibitedLabel.min, 0);
  assertEquals(prohibitedLabel.max, 0);
  assertEquals(prohibitedLabel.rmMin, 0);
  assertEquals(prohibitedLabel.rmMax, 1);
  assertEquals(
    prohibitedLabel.overlayHelp().includes("prohibited"),
    true,
  );
  const stateRow = container.getInput(prohibitedRmInputName("state"));
  assert(stateRow, "is_prohibited state appears as a non-addable overlay row");
  const inputNames = container.inputList.map((input) => input.name);
  assertEquals(
    inputNames.indexOf(prohibitedRmInputName("protocol")) <
      inputNames.indexOf(prohibitedRmInputName("state")),
    true,
    "prohibited mutator rows follow RM attribute order (protocol before state)",
  );

  composeOptionalRmExtras(observation, ["protocol"]);
  assertEquals(
    observation.getInput(optionalRmInputName("protocol")),
    null,
    "activating a prohibited row must not create a mouth",
  );
  assertEquals(observation.getInput(rmAttributeInputName("protocol")), null);

  const dataLabel = slotLabelOn(observation, "data");
  assert(dataLabel);
  assertEquals(dataLabel.hasOverlay, false);

  const history = workspace.getAllBlocks(false).find(
    (b) => b.getFieldValue("RM_TYPE") === "HISTORY",
  );
  assert(history);
  const eventsLabel = slotLabelOn(history, "events");
  assert(eventsLabel);
  assertEquals(eventsLabel.hasOverlay, true);
  assertEquals(eventsLabel.min, 1);
  assertEquals(eventsLabel.max, 1);
  assertEquals(eventsLabel.rmMin, 0);
  assertEquals(eventsLabel.rmMax, null);

  workspace.dispose();
  bubble.dispose();
});

Deno.test("unmet effective cardinality still warns on an overlay mouth", () => {
  ensureBlocks();
  const { skeleton } = generateSkeletonFromOperational(overlayFixtureOpt());
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("overlay_fixture"), null);
  const history = workspace.getAllBlocks(false).find(
    (b) => b.getFieldValue("RM_TYPE") === "HISTORY",
  );
  assert(history);
  const eventsInput = history.getInput(rmAttributeInputName("events"));
  const child = eventsInput?.connection?.targetBlock();
  child?.dispose(true);
  refreshWorkspaceConstraints(workspace);
  const label = slotLabelOn(history, "events");
  assert(label);
  assertEquals(label.hasOverlay, true);
  assertEquals(label.unmet, true);
  const messages = blockConstraintMessages(history);
  assert(
    messages.some((m) => m.includes("events") && m.includes("[1..1]")),
    `expected unmet effective [1..1], got ${messages.join(" | ")}`,
  );
  workspace.dispose();
});

Deno.test("blood-pressure HISTORY.events is an overlay vs RM 0..*", () => {
  ensureBlocks();
  const { skeleton } = generateSkeleton(bpOpt);
  const history = flatten(skeleton).find((n) => n.rmType === "HISTORY");
  assert(history);
  const events = history.children.find((c) => c.rmAttribute === "events");
  assertEquals(events?.rmCardinality, "0..*");
  assertEquals(events?.effectiveCardinality, "1..*");

  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  const historyBlock = workspace.getAllBlocks(false).find(
    (b) => b.getFieldValue("RM_TYPE") === "HISTORY",
  );
  assert(historyBlock);
  const label = slotLabelOn(historyBlock, "events");
  assert(label);
  assertEquals(label.hasOverlay, true);
  assertEquals(label.min, 1);
  assertEquals(label.max, null);
  assertEquals(label.rmMin, 0);
  assertEquals(label.rmMax, null);
  workspace.dispose();
});

Deno.test("HISTORY.events overlay survives Blockly workspace JSON round-trip", () => {
  ensureBlocks();
  const { skeleton } = generateSkeleton(bpOpt);
  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(workspace, skeleton, createEmptyModel("t"), null);
  const saved = Blockly.serialization.workspaces.save(workspace);
  workspace.clear();
  Blockly.serialization.workspaces.load(saved as Record<string, unknown>, workspace);
  const historyBlock = workspace.getAllBlocks(false).find(
    (b) => b.getFieldValue("RM_TYPE") === "HISTORY",
  );
  assert(historyBlock);
  const label = slotLabelOn(historyBlock, "events");
  assert(label);
  assertEquals(label.hasOverlay, true);
  assertEquals(label.min, 1);
  assertEquals(label.max, null);
  assertEquals(label.rmMin, 0);
  assertEquals(label.rmMax, null);
  workspace.dispose();
});
