/**
 * Drive the Agent API dispatcher (same as embedded MCP) to produce
 * AI-created mapping artefacts under test/fixtures/<use-case>/mapping/.
 */
import { dirname, fromFileUrl, join } from "@std/path";
import { ensureDir } from "@std/fs";
import { WorkbenchService } from "../src/workbench/service.ts";
import { callAgentTool } from "../src/agent/tools.ts";
import { LocalAgentClient } from "../src/agent/mcp_stdio.ts";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");
const fixtures = join(root, "test", "fixtures");

async function writeJson(path: string, value: unknown): Promise<void> {
  await ensureDir(dirname(path));
  await Deno.writeTextFile(path, JSON.stringify(value, null, 2) + "\n");
}

async function dummyJsonVitals(): Promise<void> {
  const dir = join(fixtures, "dummy-json-vitals");
  const mappingDir = join(dir, "mapping");
  const service = new WorkbenchService();
  const client = new LocalAgentClient(service);
  await client.registerAgent({ displayName: "AI fixture mapper" });

  await client.callTool("load_target", {
    filename: "target.schema.json",
    content: await Deno.readTextFile(join(dir, "target.schema.json")),
  });
  await client.callTool("load_source_schema", {
    filename: "source.schema.json",
    content: await Deno.readTextFile(join(dir, "source.schema.json")),
  });
  await client.callTool("add_example", {
    filename: "instance-1.json",
    content: await Deno.readTextFile(join(dir, "instance-1.json")),
  });

  const sbpBand = {
    name: "sbp_band",
    kind: "decision-table",
    headers: ["sbp", "band"],
    values: [
      ["< 90", "low"],
      ["90..139", "normal"],
      [">= 140", "high"],
    ],
    hitPolicy: "FIRST",
    decisionColumns: [
      { role: "condition" },
      { role: "output", outputKind: "value", valueType: "string" },
    ],
  };
  await client.callTool("replace_sheets", { sheets: [sbpBand] });

  const slots = await client.callTool("list_slots", {}) as {
    slots: Array<{ slotId: string }>;
  };
  const id = (part: string) => {
    const row = slots.slots.find((s) => s.slotId.includes(part));
    if (!row) throw new Error(`missing slot ${part}: ${slots.slots.map((s) => s.slotId)}`);
    return row.slotId;
  };
  const snap = await client.callTool("get_snapshot", {}) as {
    revision: string;
    templateId: string;
  };
  const envelope = {
    format: "intehrgrator-suggestions",
    version: "2",
    target: { format: "json-schema", targetId: snap.templateId },
    suggestions: [
      {
        slotId: id("systolic"),
        block: { type: "source_query_number", fields: { EXPRESSION: "$.systolic" } },
        note: "AI-created: direct source path",
      },
      {
        slotId: id("diastolic"),
        block: { type: "source_query_number", fields: { EXPRESSION: "$.diastolic" } },
      },
      {
        slotId: id("unit"),
        block: { type: "source_query", fields: { EXPRESSION: "$.unit" } },
      },
    ],
  };
  const imported = await client.callTool("import_suggestions", {
    text: JSON.stringify(envelope),
    revision: snap.revision,
  }) as { report: { applied: number; errors: string[] } };
  if (imported.report.applied !== 3) {
    throw new Error(`json-schema import: ${imported.report.errors.join("; ")}`);
  }
  const tested = await client.callTool("run_test", {}) as { testResult: { ok: boolean; error?: string } };
  if (!tested.testResult.ok) throw new Error(`json-schema test: ${tested.testResult.error}`);

  const script = await client.callTool("generate_script", {
    language: "typescript",
    path: join(mappingDir, "ai-created-json-schema.ts"),
  }) as { code: string };
  await writeJson(join(mappingDir, "ai-created-json-schema.intehrgrator-suggestions.json"), envelope);
  await writeJson(join(mappingDir, "ai-created-sbp-band.decision-table.json"), sbpBand);
  const exported = await client.callTool("export_bundle", { format: "json" }) as { bundle: unknown };
  await writeJson(join(mappingDir, "ai-created-json-schema.bundle.json"), exported.bundle);
  if (!script.code.includes("systolic")) throw new Error("generated script missing systolic");
}

async function dummyVitalsOpenEhrBp(): Promise<void> {
  const dir = join(fixtures, "dummy-json-vitals");
  const mappingDir = join(dir, "mapping");
  const service = new WorkbenchService();
  await callAgentTool(service, "load_target", {
    filename: "blood_pressure.opt",
    content: await Deno.readTextFile(join(fixtures, "blood_pressure.opt")),
  });
  await callAgentTool(service, "load_source_schema", {
    filename: "source.schema.json",
    content: await Deno.readTextFile(join(dir, "source.schema.json")),
  });
  await callAgentTool(service, "add_example", {
    filename: "instance-1.json",
    content: await Deno.readTextFile(join(dir, "instance-1.json")),
  });

  const slots = await callAgentTool(service, "list_slots", {}) as {
    slots: Array<{ slotId: string }>;
  };
  const systolic = slots.slots.find((s) => s.slotId.endsWith("items/at0004/value/value/value"))?.slotId;
  const diastolic = slots.slots.find((s) => s.slotId.endsWith("items/at0005/value/value/value"))?.slotId;
  if (!systolic || !diastolic) {
    throw new Error(`BP slots: ${slots.slots.map((s) => s.slotId).join("\n")}`);
  }
  const snap = await callAgentTool(service, "get_snapshot", {}) as {
    revision: string;
    templateId: string;
  };
  const envelope = {
    format: "intehrgrator-suggestions",
    version: "2",
    target: { format: "openehr-template", targetId: snap.templateId },
    suggestions: [
      {
        slotId: systolic,
        block: { type: "source_query_number", fields: { EXPRESSION: "$.systolic" } },
        note: "AI-created: OPT magnitude from dummy JSON vitals",
      },
      {
        slotId: diastolic,
        block: { type: "source_query_number", fields: { EXPRESSION: "$.diastolic" } },
      },
    ],
  };
  const imported = await callAgentTool(service, "import_suggestions", {
    text: JSON.stringify(envelope),
    revision: snap.revision,
  }) as { report: { applied: number; errors: string[] } };
  if (imported.report.applied !== 2) {
    throw new Error(`openEHR import: ${imported.report.errors.join("; ")}`);
  }
  const tested = await callAgentTool(service, "run_test", {}) as { testResult: { ok: boolean; error?: string } };
  if (!tested.testResult.ok) throw new Error(`openEHR test: ${tested.testResult.error}`);

  await writeJson(join(mappingDir, "ai-created-openehr-blood-pressure.intehrgrator-suggestions.json"), envelope);
  const exported = await callAgentTool(service, "export_bundle", { format: "json" }) as { bundle: unknown };
  await writeJson(join(mappingDir, "ai-created-openehr-blood-pressure.bundle.json"), exported.bundle);
}

async function icd10SheetLookup(): Promise<void> {
  const mappingDir = join(fixtures, "sheets", "mapping");
  const sheet = JSON.parse(
    await Deno.readTextFile(join(fixtures, "sheets", "icd10_snomed.json")),
  );
  const envelope = {
    format: "intehrgrator-suggestions",
    version: "2",
    target: { format: "openehr-template", targetId: "{loaded-target-id}" },
    suggestions: [
      {
        slotId: "{loaded-target-id}/content/data/items/at0002/value/value/defining_code/code_string/value",
        block: {
          type: "sheet_lookup",
          fields: { NAME: "icd10_snomed" },
          inputs: {
            MATCH_COL: { block: { type: "text", fields: { TEXT: "code" } } },
            MATCH_VAL: {
              block: { type: "source_query", fields: { EXPRESSION: "$.diagnosis.icd10" } },
            },
            RETURN_COL: { block: { type: "text", fields: { TEXT: "snomed" } } },
          },
        },
        note: "AI-created pattern: 1-key terminology Sheet (not a Decision table)",
      },
    ],
  };
  await writeJson(join(mappingDir, "ai-created-icd10-snomed.sheet.json"), sheet);
  await writeJson(join(mappingDir, "ai-created-icd10-snomed.intehrgrator-suggestions.json"), envelope);
}

if (import.meta.main) {
  await dummyJsonVitals();
  await dummyVitalsOpenEhrBp();
  await icd10SheetLookup();
  console.log("Wrote AI-created mappings under test/fixtures mapping directories");
}
