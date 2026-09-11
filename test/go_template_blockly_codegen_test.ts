import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import { Blockly } from "@intehrgrator/blockly/blockly_core.ts";
import {
  generateGoTemplateFromBlocklyState,
  generateGoTemplateFromWorkspace,
  initBlocklyGenerators,
  loadSkeletonIntoWorkspace,
} from "@intehrgrator/blockly/mod.ts";
import { attachStartToInstanceRoot } from "@intehrgrator/blockly/conversion_start_canvas.ts";
import { generate, generateGoTemplate } from "@intehrgrator/core/codegen/mod.ts";
import {
  applyExpressionEdit,
  createEmptyModel,
} from "@intehrgrator/core/mapping_model/mod.ts";
import { generateSkeleton } from "@intehrgrator/core/skeleton/generate_skeleton.ts";
import { getTargetFormatHandler } from "@intehrgrator/core/target/mod.ts";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");

Deno.test("go-template Blockly adapter walks Conversion start to xml root", () => {
  initBlocklyGenerators();
  const ws = new Blockly.Workspace();
  const rootBlock = ws.newBlock("xml_element");
  rootBlock.setFieldValue("Note", "NAME");
  const text = ws.newBlock("text");
  text.setFieldValue("hello", "TEXT");
  const xmlText = ws.newBlock("xml_text");
  xmlText.getInput("VALUE")?.connection?.connect(text.outputConnection!);
  rootBlock.getInput("TARGET_children")?.connection?.connect(xmlText.previousConnection!);
  attachStartToInstanceRoot(ws, rootBlock);
  const model = createEmptyModel("free-form");
  model.targetFormat = "xml-schema";
  const output = generateGoTemplateFromWorkspace(ws, model);
  ws.dispose();
  assert(output, "expected Go template from Blockly workspace");
  assertStringIncludes(output, "<Note>");
  assertStringIncludes(output, "hello");
  assertEquals(output.includes("unsupported block: conversion_start"), false);
});

Deno.test("go-template Blockly adapter emits preamble text_code defines", async () => {
  initBlocklyGenerators();
  const xsd = await Deno.readTextFile(join(root, "examples/TakeCare/TakeCare-CasenoteWrite-edit01.xsd"));
  const target = getTargetFormatHandler("xml-schema").load(
    "TakeCare-CasenoteWrite-edit01.xsd",
    xsd,
  );
  const blocklyState = JSON.parse(
    await Deno.readTextFile(
      join(root, "examples/patient-reported-chemotherapy-symptoms/mapping/mapping.blockly.json"),
    ),
  );
  const model = createEmptyModel("chemo-symptoms");
  const output = generate(model, "go-template", {
    blocklyState,
    skeleton: target.skeleton,
  });
  assertStringIncludes(output, '{{- define "cleanAndQuoteFreeTextInput"');
  assertStringIncludes(output, "<ProfdocHISMessage");
  assertEquals(output.includes("unsupported block:"), false);
});

Deno.test("go-template Blockly adapter falls back to slots for openEHR composition root", async () => {
  initBlocklyGenerators();
  const opt = await Deno.readTextFile(join(root, "test/fixtures/blood_pressure.opt"));
  const { templateId, skeleton } = generateSkeleton(opt);
  let model = createEmptyModel(templateId);
  model.targetFormat = "openehr-template";
  const systolicSlot = "ehrbase_blood_pressure_simple.de.v0/content[openEHR-EHR-OBSERVATION.blood_pressure.v1]/data[at0001]/events[at0006]/data[at0003]/items[at0004]/value[at0004]/magnitude";
  model = applyExpressionEdit(model, systolicSlot, 'xpathNumber("$.systolic")', {
    rmType: "DV_QUANTITY",
    returnType: "number",
  });
  const ws = new Blockly.Workspace();
  loadSkeletonIntoWorkspace(ws, skeleton, model);
  const state = Blockly.serialization.workspaces.save(ws);
  ws.dispose();
  const output = generateGoTemplateFromBlocklyState(state, model, skeleton);
  assert(output, "expected slot fallback for openEHR canvas");
  assertStringIncludes(output, "index .Data");
  assertStringIncludes(output, "$.systolic");
  assertEquals(output.includes("unsupported block: composition"), false);
  assertEquals(output.includes("unsupported block: conversion_start"), false);
});

Deno.test("go-template JSON walker skips conversion_start and walks instance root", () => {
  const model = createEmptyModel("test");
  const output = generateGoTemplate(model, {
    blocklyState: {
      blocks: {
        blocks: [
          {
            type: "conversion_start",
            next: {
              block: {
                type: "xml_element",
                fields: { NAME: "Note" },
                extraState: { childGroups: ["children"] },
                inputs: {
                  TARGET_children: {
                    block: {
                      type: "xml_text",
                      inputs: {
                        VALUE: {
                          block: { type: "text", fields: { TEXT: "hello" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    },
  });
  assertStringIncludes(output, "<Note>");
  assertStringIncludes(output, "hello");
  assertEquals(output.includes("unsupported block: conversion_start"), false);
});
