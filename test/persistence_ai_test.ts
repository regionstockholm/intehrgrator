import { assertEquals, assertThrows } from "@std/assert";
import {
  buildPrompt,
  formatMultipart,
  importSuggestions,
  joinLoopPath,
  mimeForFilename,
  parseSuggestionsPayload,
  suggestionBlockToExpression,
} from "@intehrgrator/core/ai/mod.ts";
import { createEmptyModel } from "@intehrgrator/core/mapping_model/mod.ts";
import {
  exportBundle,
  importBundle,
  BUNDLE_VERSION,
  AUTOSAVE_STORAGE_KEY,
  MANUAL_SAVE_KEY_PREFIX,
  formatSaveTime,
} from "@intehrgrator/core/persistence/mod.ts";
import type { ProjectBundle, SkeletonNode } from "@intehrgrator/types/mod.ts";
import { DEFAULT_SETTINGS } from "@intehrgrator/types/mod.ts";

const skeleton: SkeletonNode[] = [
  {
    slotId: "t1:$.name",
    blockType: "target_value",
    rmType: "string",
    label: "name",
    kind: "value",
    mandatory: true,
    targetPath: "$.name",
    children: [],
  },
];

Deno.test("AI import validates targetId", () => {
  const model = createEmptyModel("expected");
  model.targetFormat = "json-schema";
  assertThrows(() => {
    importSuggestions(model, {
      format: "intehrgrator-suggestions",
      version: "2",
      target: { format: "json-schema", targetId: "other" },
      suggestions: [],
    }, new Set(["s1"]));
  });
});

Deno.test("AI import applies Blockly source_query suggestion", () => {
  const model = createEmptyModel("t1");
  model.targetFormat = "json-schema";
  const { model: next, report } = importSuggestions(model, {
    format: "intehrgrator-suggestions",
    version: "2",
    target: { format: "json-schema", targetId: "t1" },
    suggestions: [{
      slotId: "s1",
      block: {
        type: "source_query_number",
        fields: { EXPRESSION: "$.vitals[1].systolic" },
      },
    }],
  }, new Set(["s1"]));
  assertEquals(report.applied, 1);
  assertEquals(report.loopsAccepted, 0);
  assertEquals(next.slots[0].expression, 'xpathNumber("$.vitals[1].systolic")');
});

Deno.test("AI import keeps loopVar relative paths", () => {
  const model = createEmptyModel("t1");
  model.targetFormat = "openehr-template";
  const { model: next, report } = importSuggestions(model, {
    format: "intehrgrator-suggestions",
    version: "2",
    target: { format: "openehr-template", targetId: "t1" },
    loops: [{
      attachSlotId: "t1/events",
      block: {
        type: "for_each_source",
        fields: { VAR: "vital", PATH: "$.vitals" },
      },
    }],
    suggestions: [{
      slotId: "t1/events/systolic",
      loopVar: "vital",
      block: {
        type: "source_query_number",
        fields: { EXPRESSION: "systolic" },
      },
    }],
  }, new Set(["t1/events", "t1/events/systolic"]));
  assertEquals(report.loopsAccepted, 1);
  assertEquals(report.applied, 1);
  assertEquals(next.slots[0].expression, 'xpathNumber("systolic")');
  assertEquals(next.loops, [{ attachSlotId: "t1/events", varName: "vital", path: "$.vitals" }]);
});

Deno.test("joinLoopPath", () => {
  assertEquals(joinLoopPath("$.vitals", "systolic"), "$.vitals[*].systolic");
  assertEquals(joinLoopPath("$.vitals[*]", "systolic"), "$.vitals[*].systolic");
  assertEquals(joinLoopPath("/patient/vitals", "systolic"), "/patient/vitals/systolic");
  assertEquals(joinLoopPath("$.vitals", "$.other"), "$.other");
});

Deno.test("AI import rejects version 1", () => {
  assertThrows(() => {
    parseSuggestionsPayload(`\`\`\`intehrgrator-suggestions
{"format":"intehrgrator-suggestions","version":"1","templateId":"t1","suggestions":[]}
\`\`\``);
  });
});

Deno.test("suggestionBlockToExpression handles trim + source_query", () => {
  const expr = suggestionBlockToExpression({
    type: "text_trim",
    fields: { MODE: "BOTH" },
    inputs: {
      TEXT: {
        block: {
          type: "source_query",
          fields: { EXPRESSION: "$.name.family", RETURN_TYPE: "string" },
        },
      },
    },
  });
  assertEquals(expr, 'trim(xpathString("$.name.family"))');
});

Deno.test("buildPrompt inline embeds multipart body", () => {
  const model = createEmptyModel("PatientSchema");
  model.targetFormat = "json-schema";
  const prompt = buildPrompt({
    scope: "full",
    targetId: "PatientSchema",
    targetFormat: "json-schema",
    targetFilename: "patient.schema.json",
    skeleton,
    model,
    formatDocUrl: "https://example.test/docs/AI_SUGGESTION_FORMAT.md",
    delivery: "inline",
    sourceFormat: "json",
    artifacts: [{
      role: "source-schema",
      filename: "patient.schema.json",
      format: "json",
      content: '{"type":"object"}',
    }],
  });
  assertEquals(prompt.includes("valueType"), true);
  assertEquals(prompt.includes("rmType"), false);
  assertEquals(prompt.includes("--intehrgrator-part"), true);
  assertEquals(prompt.includes('X-Intehrgrator-Role: source-schema'), true);
  assertEquals(prompt.includes('{"type":"object"}'), true);
});

Deno.test("buildPrompt uri lists browseable URLs", () => {
  const model = createEmptyModel("t1");
  model.targetFormat = "openehr-template";
  const prompt = buildPrompt({
    scope: "full",
    targetId: "t1",
    targetFormat: "openehr-template",
    targetFilename: "bp.opt",
    skeleton: [],
    model,
    formatDocUrl: "https://example.test/fmt",
    delivery: "uri",
    artifacts: [
      {
        role: "target",
        filename: "bp.opt",
        format: "openehr-template",
        content: "<template/>",
        originUrl: "https://example.test/bp.opt",
      },
      {
        role: "example",
        filename: "local.json",
        format: "json",
        content: "{}",
      },
    ],
  });
  assertEquals(prompt.includes("## Browse URIs"), true);
  assertEquals(prompt.includes("https://example.test/bp.opt"), true);
  assertEquals(prompt.includes("## Attachments (no URI — upload these)"), true);
  assertEquals(prompt.includes("`local.json`"), true);
});

Deno.test("mimeForFilename and formatMultipart", () => {
  assertEquals(mimeForFilename("a.json"), "application/json");
  assertEquals(mimeForFilename("a.opt"), "application/xml");
  const body = formatMultipart([{
    role: "example",
    filename: "x.json",
    format: "json",
    content: "{}",
    originUrl: "https://example.test/x.json",
  }]);
  assertEquals(body.includes("X-Intehrgrator-Origin: https://example.test/x.json"), true);
  assertEquals(body.endsWith("--intehrgrator-part--"), true);
});

Deno.test("project bundle round-trip", () => {
  const bundle: ProjectBundle = {
    version: BUNDLE_VERSION,
    projectId: "p1",
    appVersion: "0.1.0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    template: null,
    sourceSchema: null,
    examples: [],
    activeExampleId: null,
    mapping: { blocklyState: null, model: createEmptyModel("t1") },
    settings: DEFAULT_SETTINGS,
  };
  const restored = importBundle(exportBundle(bundle));
  assertEquals(restored.projectId, "p1");
});

Deno.test("autosave and manual save use distinct storage keys", () => {
  assertEquals(AUTOSAVE_STORAGE_KEY, "__autosave__");
  assertEquals(MANUAL_SAVE_KEY_PREFIX, "manual:");
  assertEquals(AUTOSAVE_STORAGE_KEY.startsWith(MANUAL_SAVE_KEY_PREFIX), false);
});

Deno.test("formatSaveTime renders hh:mm", () => {
  const formatted = formatSaveTime("2026-07-02T14:05:00.000Z");
  assertEquals(/^\d{2}:\d{2}$/.test(formatted), true);
});
