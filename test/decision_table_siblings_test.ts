/**
 * #70 sibling Example Sets: lung-MDT Handlebars and chemo Go, Decision tables
 * with VMS-Mustache snippets. Gold directories stay untouched.
 */
import { assert, assertEquals } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import { WorkbenchService } from "@intehrgrator/workbench/service.ts";
import { callAgentTool } from "@intehrgrator/agent/tools.ts";
import {
  assertVmsMustacheSnippets,
  chemoDecisionSheets,
  lungMdtDecisionSheets,
} from "../scripts/decision_table_example_sheets.ts";
import { ensureGoTemplateWasm } from "@intehrgrator/core/output/go_template_runtime.ts";
import type { TestResult } from "@intehrgrator/types/mod.ts";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");
const catalogPath = join(root, "examples", "example-sets.json");
const fixtures = join(root, "test", "fixtures");

function normalizeWs(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function keywordPairs(xml: string): Array<{ termId: string; note: string }> {
  const pairs: Array<{ termId: string; note: string }> = [];
  const re =
    /<TextKeyWord>\s*<TermId>\s*([^<]*?)\s*<\/TermId>\s*<Note>([\s\S]*?)<\/Note>\s*<\/TextKeyWord>/gi;
  for (const match of xml.matchAll(re)) {
    pairs.push({ termId: match[1]!.trim(), note: normalizeWs(match[2] ?? "") });
  }
  return pairs.sort((a, b) => a.termId.localeCompare(b.termId) || a.note.localeCompare(b.note));
}

function outputText(output: unknown): string {
  if (typeof output === "string") return output;
  try {
    return JSON.stringify(output);
  } catch {
    return String(output ?? "");
  }
}

async function runMapped(
  setId: string,
  outputMode: "handlebars" | "go-template" | "typescript",
  filename?: string,
): Promise<TestResult> {
  const service = new WorkbenchService();
  await callAgentTool(service, "register_agent", {
    agentId: `issue-70-${setId}`,
    displayName: `Issue 70 ${setId}`,
  });
  await callAgentTool(service, "load_example_set", {
    catalogPath,
    setId,
    includeMapping: true,
  });
  if (filename) {
    const tree = await callAgentTool(service, "get_source_tree", {}) as {
      examples: Array<{ id: string; filename: string }>;
    };
    const hit = tree.examples.find((ex) => ex.filename === filename);
    if (!hit) throw new Error(`${setId} missing ${filename}`);
    await callAgentTool(service, "set_active_example", { id: hit.id });
  }
  if (outputMode === "go-template") await ensureGoTemplateWasm();
  const tested = await callAgentTool(service, "run_test", { outputMode }) as {
    testResult: TestResult;
  };
  return tested.testResult;
}

Deno.test("#70 sibling Decision table snippets are VMS-Mustache only", () => {
  assertEquals(assertVmsMustacheSnippets(lungMdtDecisionSheets()), []);
  assertEquals(assertVmsMustacheSnippets(chemoDecisionSheets()), []);
  const lungSheets = JSON.parse(
    Deno.readTextFileSync(
      join(fixtures, "lung-MDT-form-decision-tables", "mapping", "mapping.sheets.json"),
    ),
  );
  const chemoSheets = JSON.parse(
    Deno.readTextFileSync(
      join(fixtures, "patient-reported-chemotherapy-symptoms-decision-tables", "mapping", "mapping.sheets.json"),
    ),
  );
  const lungDocs = Array.isArray(lungSheets) ? lungSheets : [lungSheets];
  const chemoDocs = Array.isArray(chemoSheets) ? chemoSheets : [chemoSheets];
  assertEquals(assertVmsMustacheSnippets(lungDocs), []);
  assertEquals(assertVmsMustacheSnippets(chemoDocs), []);
});

Deno.test("#70 sibling mappings keep gold directories and one free-text helper", () => {
  const goldLung = Deno.readTextFileSync(
    join(fixtures, "lung-MDT-form", "mapping", "mapping.blockly.json"),
  );
  const goldChemo = Deno.readTextFileSync(
    join(fixtures, "patient-reported-chemotherapy-symptoms", "mapping", "mapping.blockly.json"),
  );
  const siblingLung = Deno.readTextFileSync(
    join(fixtures, "lung-MDT-form-decision-tables", "mapping", "mapping.blockly.json"),
  );
  const siblingChemo = Deno.readTextFileSync(
    join(fixtures, "patient-reported-chemotherapy-symptoms-decision-tables", "mapping", "mapping.blockly.json"),
  );
  assertEquals(goldLung.includes('"NAME": "imaging_term"'), false);
  assertEquals(goldChemo.includes('"NAME": "fatigue_note"'), false);
  assert(siblingLung.includes('"NAME": "imaging_term"'));
  assert(siblingLung.includes("decision_table"));
  assert(siblingChemo.includes('"NAME": "fatigue_note"'));
  const defines = siblingChemo.split('define \\"cleanAndQuoteFreeTextInput\\"').length - 1;
  assertEquals(defines, 1, `expected one cleanAndQuoteFreeTextInput define, got ${defines}`);
  assertEquals(goldChemo.includes("define \\\"cleanAndQuoteFreeTextInput\\\""), true);
});

Deno.test("#70 lung-MDT sibling TermIds and Notes match gold (whitespace-normalized)", async () => {
  const files = [
    "1-mdt-review-never-smoked-mr.json",
    "2-mdt-review-smoker-ultrasound.json",
  ];
  for (const filename of files) {
    const gold = await runMapped("lung-mdt-form-to-tc-xml", "handlebars", filename);
    const sibling = await runMapped(
      "lung-mdt-form-to-tc-xml-decision-tables",
      "handlebars",
      filename,
    );
    assertEquals(gold.error, undefined, `${filename} gold: ${gold.error}`);
    assertEquals(sibling.error, undefined, `${filename} sibling: ${sibling.error}`);
    assertEquals(gold.ok, true, `${filename} gold not ok`);
    assertEquals(sibling.ok, true, `${filename} sibling not ok`);
    const goldPairs = keywordPairs(outputText(gold.output));
    const siblingPairs = keywordPairs(outputText(sibling.output));
    assertEquals(
      siblingPairs,
      goldPairs,
      `${filename}\ngold=${JSON.stringify(goldPairs, null, 2)}\nsibling=${JSON.stringify(siblingPairs, null, 2)}`,
    );
  }
});

Deno.test("#70 chemo sibling TermIds and Notes match gold (whitespace-normalized)", async () => {
  await ensureGoTemplateWasm();
  const files = [
    "1. Ex.composition.txt",
    "3. Ex.composition (Full).txt",
    "6. Ex.composition (Nightly).txt",
  ];
  for (const filename of files) {
    const gold = await runMapped("chemo-symptoms-flat-to-tc-xml", "go-template", filename);
    const sibling = await runMapped(
      "chemo-symptoms-flat-to-tc-xml-decision-tables",
      "go-template",
      filename,
    );
    assertEquals(gold.error, undefined, `${filename} gold: ${gold.error}`);
    assertEquals(sibling.error, undefined, `${filename} sibling: ${sibling.error}`);
    assertEquals(gold.ok, true, `${filename} gold not ok`);
    assertEquals(sibling.ok, true, `${filename} sibling not ok`);
    const goldPairs = keywordPairs(outputText(gold.output));
    const siblingPairs = keywordPairs(outputText(sibling.output));
    assertEquals(
      siblingPairs,
      goldPairs,
      `${filename}\ngold=${JSON.stringify(goldPairs, null, 2)}\nsibling=${JSON.stringify(siblingPairs, null, 2)}`,
    );
  }
});
