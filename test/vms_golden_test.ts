import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import "blockly/blocks";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  initBlocklyGenerators,
  loadSkeletonIntoWorkspace,
  generateTypeScriptFromWorkspace,
  workspaceToModelJson,
} from "@intehrgrator/blockly/mod.ts";
import { blockToExpression } from "@intehrgrator/blockly/expression_serialize.ts";
import {
  isVmsRemovedBlockType,
  VMS_CANVAS_EMIT_BLOCK_TYPES,
  VMS_EXPRESSION_BLOCK_TYPES,
} from "@intehrgrator/blockly/vms.ts";
import { emitBlockForVmsTest } from "@intehrgrator/blockly/typescript_codegen.ts";
import { buildDemoToolbox, toolboxBlockTypes } from "@intehrgrator/blockly/toolbox_demo.ts";
import {
  applyExpressionEdit,
  createEmptyModel,
} from "@intehrgrator/core/mapping_model/mod.ts";
import { generate } from "@intehrgrator/core/codegen/mod.ts";
import { runTest } from "@intehrgrator/core/test_runner/mod.ts";
import { serializedConversionOutput } from "@intehrgrator/core/codegen/run_typescript.ts";
import {
  collectValueSlots,
  generateSkeleton,
} from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { getTargetFormatHandler } from "@intehrgrator/core/target/mod.ts";
import {
  createTsEmitContext,
  emitTsExpressionSource,
} from "@intehrgrator/core/codegen/typescript.ts";

let ready = false;
function ensure(): void {
  if (ready) return;
  initBlocklyGenerators();
  ready = true;
}

Deno.test("VMS BP mapping: Mapping preview and TypeScript Output agree on clinical values", async () => {
  ensure();
  const opt = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "blood_pressure.opt"),
  );
  const instance = await Deno.readTextFile(
    join(import.meta.dirname!, "fixtures", "legacy-simulated-json", "instances", "bp-inst.json"),
  );
  const { templateId, skeleton } = generateSkeleton(opt);
  const target = getTargetFormatHandler("openehr-template").load("blood_pressure.opt", opt);
  const systolic = collectValueSlots(skeleton).find((slot) =>
    slot.slotId.endsWith("items/at0004/value/value/value")
  );
  assert(systolic, "expected systolic value slot");
  const language = collectValueSlots(skeleton).find((slot) =>
    slot.rmType === "CODE_PHRASE" && slot.slotId.includes("//language/")
  );

  let model = createEmptyModel(templateId);
  model.targetFormat = "openehr-template";
  model = applyExpressionEdit(model, systolic.slotId, 'xpathNumber("$.systolic")', {
    rmType: systolic.rmType,
    returnType: "number",
    label: systolic.label,
  });
  if (language) {
    model = applyExpressionEdit(model, language.slotId, 'maps_get("defaults", "language")', {
      rmType: language.rmType,
      returnType: "string",
    });
  }

  const workspace = new Blockly.Workspace();
  try {
    loadSkeletonIntoWorkspace(workspace, skeleton, model);
    const blocklyState = Blockly.serialization.workspaces.save(workspace);
    const ts = generateTypeScriptFromWorkspace(workspace, model);
    assert(ts, "expected TypeScript from BP canvas");

    const preview = runTest(model, instance, "json", {
      target,
      blocklyState,
      defaults: { language: "en", territory: "GB", time: "2026-08-25T10:00:00Z" },
    });
    assertEquals(preview.error, undefined, preview.error);
    assertEquals(preview.ok, true, (preview.warnings ?? []).join("; "));

    const typescript = runTest(model, instance, "json", {
      target,
      outputMode: "typescript",
      generatedCode: ts,
      blocklyState,
      defaults: { language: "en", territory: "GB", time: "2026-08-25T10:00:00Z" },
    });
    assertEquals(typescript.error, undefined, typescript.error);

    const previewNorm = clinicalFingerprint(preview.output);
    const tsNorm = clinicalFingerprint(typescript.output);
    assertEquals(tsNorm, previewNorm);
    assertEquals(previewNorm.systolic, 120);
    assertEquals(previewNorm.language, "en");
  } finally {
    workspace.dispose();
  }
});

Deno.test("XQuery export lists the same slot ids and loop metadata as Mapping Model IR", async () => {
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

  const workspace = new Blockly.Workspace();
  try {
    loadSkeletonIntoWorkspace(workspace, skeleton, model);
    const ir = workspaceToModelJson(workspace);
    model = {
      ...model,
      slots: ir.slots.map((slot) => ({
        ...slot,
        returnType: slot.rmType === "DV_QUANTITY" ? "number" : "string",
      })),
      loops: ir.loops,
      optionalRm: ir.optionalRm,
      targetSignature: ir.targetSignature,
      unsupported: ir.unsupported,
      sheetNames: ir.sheetNames,
    };

    const xq = generate(model, "xquery");
    for (const slot of model.slots) {
      assertStringIncludes(xq, slot.slotId);
    }
    assertStringIncludes(xq, "element slots");
    for (const loop of model.loops ?? []) {
      assertStringIncludes(xq, loop.attachSlotId);
      assertStringIncludes(xq, loop.varName);
      assertStringIncludes(xq, loop.kind ?? "source");
    }
    if ((model.loops ?? []).length) {
      assertStringIncludes(xq, "element loops");
      assertStringIncludes(xq, "for $");
    }
  } finally {
    workspace.dispose();
  }
});

Deno.test("VMS expression blocks serialize and do not silently emit bare undefined in TypeScript canvas codegen", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const ctx = createTsEmitContext();
  try {
    for (const type of VMS_EXPRESSION_BLOCK_TYPES) {
      const block = workspace.newBlock(type);
      prepareMinimalExpressionBlock(block, type);
      const expression = blockToExpression(block);
      assert(expression !== null, `${type} must serialize to a Mapping Expression`);
      const fromExpr = emitExpressionBlockForTest(block, ctx);
      assert(
        !isBareUndefinedEmit(fromExpr),
        `${type} must not emit bare undefined (got ${fromExpr})`,
      );
    }
  } finally {
    workspace.dispose();
  }
});
Deno.test("VMS canvas-only blocks do not silently emit bare undefined in TypeScript codegen", () => {
  ensure();
  const workspace = new Blockly.Workspace();
  const ctx = createTsEmitContext();
  try {
    for (const type of VMS_CANVAS_EMIT_BLOCK_TYPES) {
      const block = workspace.newBlock(type);
      prepareMinimalCanvasBlock(block, type);
      const code = emitBlockForVmsTest(block, ctx);
      assert(
        !isBareUndefinedEmit(code),
        `${type} must not emit bare undefined (got ${code})`,
      );
    }
  } finally {
    workspace.dispose();
  }
});

Deno.test("default toolbox kept block types are not VMS-removed", () => {
  const types = toolboxBlockTypes(buildDemoToolbox("en"));
  for (const type of types) {
    assert(!isVmsRemovedBlockType(type), `${type} must not appear in the default toolbox`);
  }
});

function prepareMinimalCanvasBlock(block: import("blockly/core").Block, type: string): void {
  if (type === "term_pick") {
    block.setFieldValue("openehr_languages", "SET");
    block.setFieldValue("en", "CODE");
  }
  if (type === "code_phrase") {
    block.setFieldValue("CODE_PHRASE", "RM_TYPE");
    const code = block.workspace.newBlock("text");
    code.setFieldValue("en", "TEXT");
    block.getInput("FLD_code_string")?.connection?.connect(code.outputConnection!);
    const term = block.workspace.newBlock("text");
    term.setFieldValue("ISO_639-1", "TEXT");
    block.getInput("FLD_terminology_id")?.connection?.connect(term.outputConnection!);
  }
}

function prepareMinimalExpressionBlock(
  block: import("blockly/core").Block,
  type: string,
): void {
  if (type.startsWith("source_query")) {
    block.setFieldValue("$.value", "EXPRESSION");
  }
  if (type === "text") block.setFieldValue("x", "TEXT");
  if (type === "math_number") block.setFieldValue(1, "NUM");
  if (type === "logic_boolean") block.setFieldValue("TRUE", "BOOL");
  if (type === "maps_get") {
    block.setFieldValue("defaults", "NAME");
    const key = block.workspace.newBlock("text");
    key.setFieldValue("language", "TEXT");
    block.getInput("KEY")?.connection?.connect(key.outputConnection!);
  }
  if (type === "lists_create_with") {
    // deno-lint-ignore no-explicit-any
    (block as any).itemCount_ = 1;
    // deno-lint-ignore no-explicit-any
    (block as any).updateShape_?.();
    const child = block.workspace.newBlock("text");
    child.setFieldValue("a", "TEXT");
    block.getInput("ADD0")?.connection?.connect(child.outputConnection!);
  }
  if (type === "lists_getIndex") {
    const list = block.workspace.newBlock("lists_create_with") as import("blockly/core").Block & {
      itemCount_?: number;
      updateShape_?: () => void;
    };
    list.itemCount_ = 0;
    list.updateShape_?.();
    block.getInput("VALUE")?.connection?.connect(list.outputConnection!);
    block.setFieldValue("FIRST", "WHERE");
    block.setFieldValue("GET", "MODE");
  }
  if (type === "sheet_lookup") {
    block.setFieldValue("Sheet1", "NAME");
  }
  if (type === "variables_get") {
    const variable = block.workspace.createVariable("item");
    block.setFieldValue(variable.getId(), "VAR");
  }
}

function emitExpressionBlockForTest(
  block: import("blockly/core").Block,
  ctx: ReturnType<typeof createTsEmitContext>,
): string | null {
  const serialized = blockToExpression(block);
  if (!serialized) return null;
  return emitTsExpressionSource(serialized, ctx);
}

function isBareUndefinedEmit(code: string | null): boolean {
  if (code === null) return false;
  const trimmed = code.trim();
  return trimmed === "undefined" || trimmed.startsWith("undefined /* unhandled");
}

function clinicalFingerprint(output: unknown): { systolic?: number; language?: string } {
  const root = serializedConversionOutput(output) as Record<string, unknown>;
  return {
    systolic: findQuantityMagnitude(root, "at0004"),
    language: findLanguageCode(root),
  };
}

function findQuantityMagnitude(node: unknown, archetypeNodeId: string): number | undefined {
  if (!node || typeof node !== "object") return undefined;
  const rec = node as Record<string, unknown>;
  if (rec.archetype_node_id === archetypeNodeId) {
    const value = rec.value as { magnitude?: number } | undefined;
    if (typeof value?.magnitude === "number") return value.magnitude;
  }
  for (const child of Object.values(rec)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findQuantityMagnitude(item, archetypeNodeId);
        if (found !== undefined) return found;
      }
    } else {
      const found = findQuantityMagnitude(child, archetypeNodeId);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function findLanguageCode(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const rec = node as Record<string, unknown>;
  if (rec._type === "COMPOSITION" && rec.language) {
    const language = rec.language as Record<string, unknown>;
    if (typeof language.code_string === "string") return language.code_string;
    if (typeof language.value === "string") return language.value;
  }
  for (const child of Object.values(rec)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findLanguageCode(item);
        if (found) return found;
      }
    } else {
      const found = findLanguageCode(child);
      if (found) return found;
    }
  }
  return undefined;
}
