import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { WorkbenchService } from "@intehrgrator/workbench/service.ts";
import { callAgentTool } from "@intehrgrator/agent/tools.ts";

const fixtures = join(
  import.meta.dirname!,
  "fixtures",
  "administrerad-medicinsk-onkologisk-behandling",
);
const adminOpt = join(
  fixtures,
  "target-schema",
  "AdministreradMedicinskOnkologiskBehandlingPerSubstans.1.0.0-alpha.5.sv.en.opt",
);

function walkDv(
  node: unknown,
  visit: (rec: Record<string, unknown>) => void,
): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walkDv(item, visit);
    return;
  }
  const rec = node as Record<string, unknown>;
  visit(rec);
  for (const value of Object.values(rec)) walkDv(value, visit);
}

Deno.test("pass-2 envelope maps TESTFALL-A towards the golden FLAT instance", async () => {
  const service = new WorkbenchService();
  await callAgentTool(service, "load_target", { path: adminOpt });
  await callAgentTool(service, "load_source_schema", {
    path: join(fixtures, "source-schema", "AdministrationRCCV1_source_schema.json"),
  });
  await callAgentTool(service, "add_example", {
    path: join(fixtures, "source-instance", "administration-TESTFALL-A-source-example.json"),
  });
  const listedRm = await callAgentTool(service, "list_optional_rm", {}) as {
    catalog: Array<{
      parentSlotId: string;
      attachments: Array<{ attributeName: string; rmType: string }>;
    }>;
  };
  const context = listedRm.catalog.find((row) =>
    row.parentSlotId.endsWith("//context/EVENT_CONTEXT") &&
    row.attachments.some((a) => a.attributeName === "health_care_facility")
  );
  if (!context) throw new Error("missing EVENT_CONTEXT health_care_facility catalog row");
  await callAgentTool(service, "optional_rm_add", {
    parentSlotId: context.parentSlotId,
    rmType: "PARTY_IDENTIFIED",
    attributeName: "health_care_facility",
  });
  const sheets = JSON.parse(
    await Deno.readTextFile(join(fixtures, "mapping", "pass-2-ai.sheets.json")),
  ) as { sheets: unknown[] };
  await callAgentTool(service, "replace_sheets", { sheets: sheets.sheets });
  const envelope = await Deno.readTextFile(
    join(fixtures, "mapping", "pass-2-ai.intehrgrator-suggestions.json"),
  );
  const imported = await callAgentTool(service, "import_suggestions", { text: envelope }) as {
    report: { applied: number; errors: string[]; loopsAccepted?: number };
  };
  assertEquals(imported.report.errors, [], imported.report.errors.join("; "));
  assertEquals(imported.report.applied >= 20, true, `applied ${imported.report.applied}`);
  assertEquals(imported.report.loopsAccepted, 1);

  const tested = await callAgentTool(service, "run_test", {}) as {
    testResult: { output?: unknown; error?: string };
  };
  if (tested.testResult.error) throw new Error(tested.testResult.error);

  const names: string[] = [];
  const texts: string[] = [];
  const ids: string[] = [];
  const codes: string[] = [];
  const mags: number[] = [];
  const units: string[] = [];
  const settings: string[] = [];
  walkDv(tested.testResult.output, (rec) => {
    if (rec._type === "PARTY_IDENTIFIED") {
      if (typeof rec.name === "string") names.push(rec.name);
      if (Array.isArray(rec.identifiers)) {
        for (const row of rec.identifiers) {
          if (row && typeof row === "object" && "id" in row) {
            ids.push(String((row as { id: unknown }).id));
          }
        }
      }
    }
    if (rec._type === "DV_TEXT" && typeof rec.value === "string") texts.push(rec.value);
    if (rec._type === "DV_CODED_TEXT") {
      const phrase = rec.defining_code;
      if (phrase && typeof phrase === "object" && "code_string" in phrase) {
        codes.push(String((phrase as { code_string: unknown }).code_string));
      }
      if (typeof rec.value === "string") codes.push(rec.value);
    }
    if (rec._type === "DV_QUANTITY") {
      if (rec.magnitude != null) mags.push(Number(rec.magnitude));
      if (typeof rec.units === "string") units.push(rec.units);
    }
    if (rec._type === "DV_IDENTIFIER" && rec.id != null) ids.push(String(rec.id));
    if (rec._type === "EVENT_CONTEXT" && rec.setting && typeof rec.setting === "object") {
      const setting = rec.setting as { value?: unknown; defining_code?: { code_string?: unknown } };
      if (typeof setting.value === "string") settings.push(setting.value);
      if (setting.defining_code?.code_string != null) {
        settings.push(String(setting.defining_code.code_string));
      }
    }
  });

  assertEquals(names.includes("TakeCare_Test"), true, JSON.stringify(names));
  assertEquals(names.includes("S MBA A10"), true, JSON.stringify(names));
  assertEquals(texts.includes("OO Cancer TC"), true, JSON.stringify(texts));
  assertEquals(texts.includes("PDL-vårdgivare SLL IdP TEST"), true, JSON.stringify(texts));
  assertEquals(ids.includes("A1D8"), true, JSON.stringify(ids));
  assertEquals(ids.includes("SE2321000016-C4DS"), true, JSON.stringify(ids));
  assertEquals(ids.includes("SE2321000016-BW01"), true, JSON.stringify(ids));
  assertEquals(ids.includes("SE2321000016-I1MN"), true, JSON.stringify(ids));
  assertEquals(ids.includes("73821234"), true, JSON.stringify(ids));
  assertEquals(codes.includes("C342"), true, JSON.stringify(codes));
  assertEquals(codes.includes("L01FF02"), true, JSON.stringify(codes));
  assertEquals(codes.includes("L01FF05"), true, JSON.stringify(codes));
  assertEquals(codes.includes("238") || settings.includes("238") || settings.includes("other care"), true, JSON.stringify({ codes, settings }));
  assertEquals(mags.includes(150) && mags.includes(1104), true, JSON.stringify(mags));
  assertEquals(units.includes("mg"), true, JSON.stringify(units));
});
