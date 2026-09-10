import { assert, assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { join } from "@std/path";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  generateTypeScriptFromWorkspace,
  generatedTypeScriptHasSilentUndefined,
  initBlocklyGenerators,
  loadSkeletonIntoWorkspace,
  workspaceToModelJson,
} from "@intehrgrator/blockly/mod.ts";
import { applyExpressionEdit, createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import { generate } from "@intehrgrator/core/codegen/mod.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";
import { collectValueSlots, generateSkeleton, slotReturnType } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { getTargetFormatHandler } from "@intehrgrator/core/target/mod.ts";
import type { MappingModel } from "@intehrgrator/types/mod.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

async function dummyVitalsMapped(): Promise<{
  model: MappingModel;
  blocklyState: unknown;
  target: ReturnType<typeof getTargetFormatHandler> extends never ? never
    : ReturnType<ReturnType<typeof getTargetFormatHandler>["load"]>;
  instance: string;
  workspace: Blockly.Workspace;
}> {
  ensure();
  const schemaText = await Deno.readTextFile(
    join(import.meta.dirname!, "../examples/dummy-json-vitals/target.schema.json"),
  );
  const instance = await Deno.readTextFile(
    join(import.meta.dirname!, "../examples/dummy-json-vitals/instance-1.json"),
  );
  const target = getTargetFormatHandler("json-schema").load("target.schema.json", schemaText);
  const slots = collectValueSlots(target.skeleton);
  const systolic = slots.find((slot) => slot.label === "systolic");
  const diastolic = slots.find((slot) => slot.label === "diastolic");
  assert(systolic, "expected systolic slot");
  assert(diastolic, "expected diastolic slot");

  let model = createEmptyModel(target.targetId);
  model.targetFormat = "json-schema";
  model = applyExpressionEdit(model, systolic.slotId, 'xpathNumber("$.systolic")', {
    rmType: systolic.rmType,
    returnType: "number",
    label: systolic.label,
  });
  model = applyExpressionEdit(model, diastolic.slotId, 'xpathNumber("$.diastolic")', {
    rmType: diastolic.rmType,
    returnType: "number",
    label: diastolic.label,
  });

  const workspace = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(
    workspace,
    target.skeleton,
    model,
    null,
    "en",
    "json-schema",
  );
  const derived = workspaceToModelJson(workspace);
  const systolicSlot = derived.slots.find((slot) => slot.slotId === systolic.slotId);
  assertEquals(systolicSlot?.rmType, "number", JSON.stringify(systolicSlot));
  model = {
    ...model,
    slots: derived.slots.map((slot) => ({
      ...slot,
      returnType: slotReturnType({ rmType: slot.rmType }),
    })),
    loops: derived.loops,
    targetSignature: derived.targetSignature,
    unsupported: derived.unsupported,
    sheetNames: derived.sheetNames,
  };
  const blocklyState = Blockly.serialization.workspaces.save(workspace);
  return { model, blocklyState, target, instance, workspace };
}

function clinicalNumber(output: unknown, key: string): number | undefined {
  if (!output || typeof output !== "object" || Array.isArray(output)) return undefined;
  const value = (output as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

function walkFindMagnitude(node: unknown, nodeId: string): number | undefined {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = walkFindMagnitude(item, nodeId);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const rec = node as Record<string, unknown>;
  const id = String(rec.archetype_node_id ?? rec.archetypeNodeId ?? "");
  if (id === nodeId || id.endsWith(nodeId)) {
    const value = rec.value;
    if (value && typeof value === "object") {
      const mag = (value as Record<string, unknown>).magnitude;
      if (typeof mag === "number") return mag;
    }
  }
  for (const child of Object.values(rec)) {
    const found = walkFindMagnitude(child, nodeId);
    if (found !== undefined) return found;
  }
  return undefined;
}

Deno.test("dummy-json-vitals-mapped Example Set: Mapping preview ≡ TypeScript clinical values", async () => {
  const { model, blocklyState, target, instance, workspace } = await dummyVitalsMapped();
  try {
    const tsCode = generateTypeScriptFromWorkspace(workspace, model);
    assert(tsCode, "expected canvas TypeScript");
    assertEquals(
      generatedTypeScriptHasSilentUndefined(tsCode),
      false,
      tsCode,
    );

    const preview = runTest(model, instance, "json", {
      target,
      blocklyState,
      outputMode: "preview",
    });
    const ts = runTest(model, instance, "json", {
      target,
      blocklyState,
      outputMode: "typescript",
      generatedCode: tsCode,
    });
    assertEquals(preview.error, undefined, preview.error);
    assertEquals(ts.error, undefined, ts.error);
    assertEquals(clinicalNumber(preview.output, "systolic"), 120);
    assertEquals(clinicalNumber(preview.output, "diastolic"), 80);
    assertEquals(clinicalNumber(ts.output, "systolic"), 120);
    assertEquals(clinicalNumber(ts.output, "diastolic"), 80);
  } finally {
    workspace.dispose();
  }
});

Deno.test("committed dummy-json-vitals-mapped Example Set: Mapping preview ≡ TypeScript", async () => {
  ensure();
  const schemaText = await Deno.readTextFile(
    join(import.meta.dirname!, "../examples/dummy-json-vitals/target.schema.json"),
  );
  const instance = await Deno.readTextFile(
    join(import.meta.dirname!, "../examples/dummy-json-vitals/instance-1.json"),
  );
  const mappingText = await Deno.readTextFile(
    join(import.meta.dirname!, "../examples/dummy-json-vitals/mapping.blockly.json"),
  );
  const target = getTargetFormatHandler("json-schema").load("target.schema.json", schemaText);
  const workspace = new Blockly.Workspace();
  try {
    loadSkeletonIntoWorkspace(
      workspace,
      target.skeleton,
      createEmptyModel(target.targetId),
      null,
      "en",
      "json-schema",
    );
    Blockly.serialization.workspaces.load(JSON.parse(mappingText), workspace);
    const derived = workspaceToModelJson(workspace);
    const types = workspace.getTopBlocks(false).map((block) => block.type);
    assert(types.some((type) => type && type !== "defaults_block"), "mapping must include an instance root");
    assert(
      derived.slots.some((slot) => slot.expression.includes("$.systolic")),
      JSON.stringify(derived.slots),
    );

    const model: MappingModel = {
      ...createEmptyModel(target.targetId),
      targetFormat: "json-schema",
      slots: derived.slots.map((slot) => ({
        ...slot,
        returnType: slotReturnType({ rmType: slot.rmType }),
      })),
      loops: derived.loops,
      targetSignature: derived.targetSignature,
      unsupported: derived.unsupported,
      sheetNames: derived.sheetNames,
    };
    const tsCode = generateTypeScriptFromWorkspace(workspace, model);
    assert(tsCode, "expected canvas TypeScript");
    const blocklyState = Blockly.serialization.workspaces.save(workspace);
    const preview = runTest(model, instance, "json", {
      target,
      blocklyState,
      outputMode: "preview",
    });
    const ts = runTest(model, instance, "json", {
      target,
      blocklyState,
      outputMode: "typescript",
      generatedCode: tsCode,
    });
    assertEquals(preview.error, undefined, preview.error);
    assertEquals(ts.error, undefined, ts.error);
    assertEquals(clinicalNumber(preview.output, "systolic"), 120);
    assertEquals(clinicalNumber(preview.output, "diastolic"), 80);
    assertEquals(clinicalNumber(ts.output, "systolic"), 120);
    assertEquals(clinicalNumber(ts.output, "diastolic"), 80);
  } finally {
    workspace.dispose();
  }
});

Deno.test("canvas TypeScript emit does not silently use undefined for kept VMS types", async () => {
  const { model, workspace } = await dummyVitalsMapped();
  try {
    const ts = generateTypeScriptFromWorkspace(workspace, model);
    assert(ts);
    assertEquals(generatedTypeScriptHasSilentUndefined(ts), false, ts);

    const loop = workspace.newBlock("for_each_list");
    loop.setFieldValue("code", "VAR");
    const list = workspace.newBlock("lists_create_with");
    loop.getInput("LIST")!.connection!.connect(list.outputConnection!);
    const loopTs = generateTypeScriptFromWorkspace(workspace, model);
    assert(loopTs);
    assertEquals(generatedTypeScriptHasSilentUndefined(loopTs), false, loopTs);
  } finally {
    workspace.dispose();
  }
});

Deno.test("unhandled Blockly types fail TypeScript codegen instead of emitting undefined", async () => {
  const { model, workspace } = await dummyVitalsMapped();
  try {
    const mystery = workspace.newBlock("math_single");
    const systolicInput = workspace.getAllBlocks(false)
      .flatMap((block) => block.inputList)
      .find((input) => input.name === "TARGET_systolic");
    const existing = systolicInput?.connection?.targetBlock();
    existing?.dispose(false);
    systolicInput?.connection?.connect(mystery.outputConnection!);
    assertThrows(
      () => generateTypeScriptFromWorkspace(workspace, model),
      Error,
      "math_single",
    );
  } finally {
    workspace.dispose();
  }
});

Deno.test("XQuery emit covers IR slots and for_each_source loops", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  try {
    const loop = workspace.newBlock("for_each_source");
    loop.setFieldValue("reading", "VAR");
    loop.setFieldValue("$.readings", "PATH");
    const cluster = workspace.newBlock("cluster");
    cluster.setFieldValue("readings/cluster", "SLOT_ID");
    loop.getInput("DO")!.connection!.connect(cluster.previousConnection!);
    const query = workspace.newBlock("source_query_number");
    query.setFieldValue("pulse", "EXPRESSION");
    cluster.getInput("ATTR_items")?.connection?.connect(query.outputConnection!);

    const ir = workspaceToModelJson(workspace);
    assert(ir.loops.some((item) => item.kind === "source" && item.path === "$.readings"));

    const model = createEmptyModel("vitals");
    model.slots = ir.slots.map((slot) => ({
      ...slot,
      returnType: "number" as const,
    }));
    if (!model.slots.length) {
      model.slots = [{
        slotId: "readings/cluster",
        rmType: "DV_QUANTITY",
        expression: 'xpathNumber("pulse")',
        returnType: "number",
      }];
    }
    model.loops = ir.loops.length
      ? ir.loops
      : [{ attachSlotId: "readings/cluster", varName: "reading", path: "$.readings", kind: "source" }];

    const xq = generate(model, "xquery");
    assertStringIncludes(xq, '(: loop kind=source');
    assertStringIncludes(xq, "var=reading");
    assertStringIncludes(xq, "path=$.readings");
    assertStringIncludes(xq, "for $reading in local:nodes-at");
    assertStringIncludes(xq, "local:nodes-at");
    for (const slot of model.slots) {
      assertStringIncludes(xq, slot.slotId);
    }
  } finally {
    workspace.dispose();
  }
});

Deno.test("blood-pressure VMS mapping: preview and TypeScript agree on systolic magnitude", async () => {
  ensure();
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const { templateId, skeleton } = generateSkeleton(opt);
  const systolic = collectValueSlots(skeleton).find((slot) =>
    slot.slotId.endsWith("items/at0004/value/value/value")
  );
  assert(systolic, "expected systolic value slot");
  let model = createEmptyModel(templateId);
  model.targetFormat = "openehr-template";
  model = applyExpressionEdit(model, systolic.slotId, 'xpathNumber("$.systolic")', {
    rmType: systolic.rmType,
    returnType: "number",
    label: systolic.label,
  });
  const target = getTargetFormatHandler("openehr-template").load("blood_pressure.opt", opt);
  const workspace = new Blockly.Workspace();
  try {
    loadSkeletonIntoWorkspace(workspace, skeleton, model);
    const blocklyState = Blockly.serialization.workspaces.save(workspace);
    const tsCode = generateTypeScriptFromWorkspace(workspace, model);
    assert(tsCode, "expected canvas TypeScript");
    assertEquals(generatedTypeScriptHasSilentUndefined(tsCode), false, tsCode);

    const source = JSON.stringify({ systolic: 120, diastolic: 80 });
    const preview = runTest(model, source, "json", {
      target,
      blocklyState,
      outputMode: "preview",
    });
    const ts = runTest(model, source, "json", {
      target,
      blocklyState,
      outputMode: "typescript",
      generatedCode: tsCode,
    });
    assertEquals(preview.error, undefined, preview.error);
    assertEquals(ts.error, undefined, ts.error);
    assertEquals(walkFindMagnitude(preview.output, "at0004"), 120);
    assertEquals(walkFindMagnitude(ts.output, "at0004"), 120);
  } finally {
    workspace.dispose();
  }
});
