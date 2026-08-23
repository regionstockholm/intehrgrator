/**
 * Drive the Web Shell UI for bp-series → Accident report mapping.
 * Writes inspectable artifacts under mappings/bp-series-accident-report/.
 *
 * Usage (dev server already on :5173, dist rebuilt):
 *   deno run -A scripts/map-bp-series-ui.ts
 */
import { dirname, fromFileUrl, join } from "@std/path";
import { chromium, type Page } from "npm:playwright@1.51.0";
import type { IntehrgratorTestApi, WorkbenchTestSnapshot } from "../src/ui_test/test_api.ts";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");
const baseUrl = Deno.env.get("UI_TEST_BASE_URL") ?? "http://127.0.0.1:5173";
const outDir = join(root, "mappings", "bp-series-accident-report");

const injurySuffix =
  "problem_diagnosis.v1/data/at0001/items/at0002/value/value/value";
const pulseRateSuffix =
  "OBSERVATION.pulse.v2/data/at0002/events/at0003/data/at0001/items/at0004/value/value/value";
const pulseTimeSuffix =
  "OBSERVATION.pulse.v2/data/at0002/events/at0003/time/value";
const pulsePositionSuffix =
  "OBSERVATION.pulse.v2/data/at0002/events/at0003/state/at0012/items/at0013/value/value/value";

await Deno.mkdir(outDir, { recursive: true });

async function waitForTestApi(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    return Boolean(
      (globalThis as unknown as { intehrgratorTestApi?: IntehrgratorTestApi })
        .intehrgratorTestApi,
    );
  }, { timeout: 30_000 });
  await page.evaluate(async () => {
    await (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
      .intehrgratorTestApi.ready();
  });
}

async function getSnapshot(page: Page): Promise<WorkbenchTestSnapshot> {
  return await page.evaluate(() => {
    return (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
      .intehrgratorTestApi.getSnapshot();
  });
}

async function findSlot(page: Page, ...suffixes: string[]): Promise<string> {
  for (const s of suffixes) {
    const slotId = await page.evaluate((suffix) => {
      return (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
        .intehrgratorTestApi.findSlotIdBySuffix(suffix);
    }, s);
    if (slotId) return slotId;
  }
  throw new Error(`No slot ending with ${suffixes.join(" | ")}`);
}

async function clickSlotRail(page: Page, slotId: string): Promise<void> {
  const clicked = await page.evaluate((id) => {
    const items = document.querySelectorAll<HTMLElement>(".slot-item");
    for (const el of items) {
      if (el.dataset.slotId === id) {
        el.scrollIntoView({ block: "center" });
        el.click();
        return true;
      }
    }
    return false;
  }, slotId);
  if (!clicked) throw new Error(`slot rail item not found: ${slotId}`);
}

async function clickExamplePath(page: Page, path: string): Promise<void> {
  const clicked = await page.evaluate((p) => {
    const rows = document.querySelectorAll<HTMLElement>("#example-tree .tree-row");
    for (const row of rows) {
      if (row.dataset.path === p) {
        const label = row.querySelector<HTMLElement>(".tree-label");
        if (!label) return false;
        label.scrollIntoView({ block: "center" });
        label.click();
        return true;
      }
    }
    return false;
  }, path);
  if (!clicked) throw new Error(`example tree path not found: ${path}`);
}

async function saveDownload(page: Page, clickSelector: string, destName: string): Promise<string> {
  const dest = join(outDir, destName);
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }),
    page.click(clickSelector),
  ]);
  await download.saveAs(dest);
  return dest;
}

async function fixture(rel: string): Promise<string> {
  return await Deno.readTextFile(join(root, rel));
}

function jsonSectionAfter(markdown: string, heading: string): unknown {
  const start = markdown.indexOf(heading);
  if (start < 0) throw new Error(`missing heading ${heading}`);
  const fence = markdown.slice(start).match(/```json\s*([\s\S]*?)```/);
  if (!fence?.[1]) throw new Error(`missing json fence after ${heading}`);
  return JSON.parse(fence[1]);
}

type ManifestSlot = {
  slotId: string;
  valueType: string;
  label: string;
  multiplicity?: string;
  archetypeNodeId?: string;
};

type Repeatable = { slotId: string; valueType: string; label: string; multiplicity?: string };

/** Pretend to be the external AI: map only what the source can honestly fill. */
function buildExternalAiEnvelope(prompt: string): string {
  const targetId = /targetId:\s*`([^`]+)`/.exec(prompt)?.[1] ??
    "Accident report including vital signs";
  const manifest = jsonSectionAfter(prompt, "## Slot manifest") as ManifestSlot[];
  const repeatable = jsonSectionAfter(prompt, "## Repeatable containers") as Repeatable[];

  const injury = manifest.find((s) =>
    s.label === "Injury" && s.slotId.includes("problem_diagnosis") && s.valueType === "DV_TEXT"
  );
  const rate = manifest.find((s) =>
    s.label === "Rate" && s.slotId.includes("OBSERVATION.pulse.v2") && s.valueType === "DV_QUANTITY"
  );
  const time = manifest.find((s) =>
    s.slotId.includes("OBSERVATION.pulse.v2") &&
    s.slotId.includes("events/at0003/time/") &&
    (s.valueType === "DV_DATE_TIME" || s.valueType === "DV_TIME" || s.label.toLowerCase() === "time")
  );
  const position = manifest.find((s) =>
    (s.label === "Position" || s.label === "bodyPosition") &&
    s.slotId.includes("OBSERVATION.pulse.v2") &&
    s.valueType === "DV_CODED_TEXT"
  );
  const pulseEvent = repeatable.find((s) =>
    s.valueType === "EVENT" && s.slotId.includes("OBSERVATION.pulse.v2")
  );

  if (!injury || !rate || !time || !position || !pulseEvent) {
    throw new Error(
      `AI envelope missing slots: injury=${!!injury} rate=${!!rate} time=${!!time} position=${!!position} event=${!!pulseEvent}`,
    );
  }

  const envelope = {
    format: "intehrgrator-suggestions",
    version: "2",
    target: { format: "openehr-template", targetId },
    loops: [{
      attachSlotId: pulseEvent.slotId,
      block: {
        type: "for_each_source",
        fields: { VAR: "measurements", PATH: "$.measurements" },
      },
      note: "Each source measurement is one pulse OBSERVATION any_event. Systolic/diastolic mmHg have no quantity slot on this template (NEWS2 is an ordinal score, not mmHg).",
    }],
    suggestions: [
      {
        slotId: injury.slotId,
        block: { type: "source_query", fields: { EXPRESSION: "$.diagnosis.display" } },
        note: "Injury is DV_TEXT; ICD-10 display is the honest fill. Code itself has no coded-text slot here.",
      },
      {
        slotId: rate.slotId,
        loopVar: "measurements",
        block: { type: "source_query_number", fields: { EXPRESSION: "pulse" } },
      },
      {
        slotId: time.slotId,
        loopVar: "measurements",
        block: { type: "source_query", fields: { EXPRESSION: "timestamp" } },
      },
      {
        slotId: position.slotId,
        loopVar: "measurements",
        block: { type: "source_query", fields: { EXPRESSION: "bodyPosition" } },
        note: "Template Position uses local at-codes (Sitting/Lying/Standing). Source is English enum; no recode function yet.",
      },
    ],
  };

  return "```intehrgrator-suggestions\n" + JSON.stringify(envelope, null, 2) + "\n```\n";
}

function summarizePulse(output: unknown): {
  eventCount: number;
  magnitudes: Array<number | undefined>;
  times: Array<string | undefined>;
  positions: Array<string | undefined>;
  injury?: string;
} {
  const injury = findInjuryText(output);
  const events = findPulseEvents(output);
  return {
    eventCount: events.length,
    magnitudes: events.map((e) => {
      const items = e.data?.items ?? [];
      const rateItem = items.find((item) =>
        item.archetype_node_id === "at0004" || item.name?.value === "Rate"
      );
      return rateItem?.value?.magnitude as number | undefined;
    }),
    times: events.map((e) => e.time?.value),
    positions: events.map((e) => {
      const items = e.state?.items ?? [];
      const pos = items.find((item) =>
        item.archetype_node_id === "at0013" || item.name?.value === "Position"
      );
      return (pos?.value?.value ?? pos?.value?.defining_code) as string | undefined;
    }),
    injury,
  };
}

function findInjuryText(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const rec = node as Record<string, unknown>;
  if (
    rec.archetype_node_id === "at0002" &&
    rec._type === "ELEMENT" &&
    (rec.name as { value?: string } | undefined)?.value === "Injury"
  ) {
    return (rec.value as { value?: string } | undefined)?.value;
  }
  for (const [key, value] of Object.entries(rec)) {
    if (key === "slots") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        const hit = findInjuryText(item);
        if (hit) return hit;
      }
    } else {
      const hit = findInjuryText(value);
      if (hit) return hit;
    }
  }
  return undefined;
}

function findPulseEvents(node: unknown): Array<{
  data?: { items?: Array<{ archetype_node_id?: string; name?: { value?: string }; value?: Record<string, unknown> }> };
  state?: { items?: Array<{ archetype_node_id?: string; name?: { value?: string }; value?: Record<string, unknown> }> };
  time?: { value?: string };
}> {
  if (!node || typeof node !== "object") return [];
  const rec = node as Record<string, unknown>;
  if (rec.archetype_node_id === "openEHR-EHR-OBSERVATION.pulse.v2") {
    const data = rec.data as { events?: unknown } | undefined;
    return Array.isArray(data?.events) ? data.events : [];
  }
  const out: ReturnType<typeof findPulseEvents> = [];
  for (const [key, value] of Object.entries(rec)) {
    if (key === "slots") continue;
    if (Array.isArray(value)) {
      for (const item of value) out.push(...findPulseEvents(item));
    } else {
      out.push(...findPulseEvents(value));
    }
  }
  return out;
}

const wt = await fixture(
  "vendor/openEHR-model-examples/local/theme-packs/sport-event-details/templates/Accident report including vital signs.wt.json",
);
const schema = await fixture("test/fixtures/legacy-simulated/bp-series-sche.json");
const inst1 = await fixture("test/fixtures/legacy-simulated/bp-series-inst.json");
const inst2 = await fixture("test/fixtures/legacy-simulated/bp-series-inst-2.json");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(20_000);

const notes: string[] = [];
function note(msg: string) {
  notes.push(msg);
  console.log(msg);
}

async function loadProject(): Promise<void> {
  await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
  await waitForTestApi(page);
  await page.evaluate(
    ({ wt, schema, inst1, inst2 }) => {
      const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
        .intehrgratorTestApi;
      api.loadTemplate("Accident report including vital signs.wt.json", wt);
      api.loadSchema("bp-series-sche.json", schema);
      api.addExample("bp-series-inst.json", inst1);
      api.addExample("bp-series-inst-2.json", inst2);
    },
    { wt, schema, inst1, inst2 },
  );
  await page.waitForTimeout(800);
}

async function installClipboardSpy(): Promise<void> {
  await page.evaluate(() => {
    const w = globalThis as unknown as { __clip?: string };
    w.__clip = "";
    navigator.clipboard.writeText = async (text: string) => {
      w.__clip = text;
    };
    navigator.clipboard.readText = async () => w.__clip ?? "";
  });
}

async function runTestAndSnapshot(filename: string, extra: Record<string, unknown> = {}) {
  await page.click("#btn-run-test");
  await page.waitForFunction(() => {
    return (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
      .intehrgratorTestApi.getSnapshot().testResult != null;
  }, { timeout: 10_000 });
  const snap = await getSnapshot(page);
  const pulse = summarizePulse(snap.testResult?.output);
  await Deno.writeTextFile(
    join(outDir, filename),
    JSON.stringify({
      statusMessage: snap.statusMessage,
      modelSlots: snap.model.slots,
      modelLoops: snap.model.loops ?? [],
      testOk: snap.testResult?.ok,
      testError: snap.testResult?.error,
      testWarnings: snap.testResult?.warnings,
      slotValues: (snap.testResult?.composition as { slots?: unknown } | undefined)?.slots,
      pulse,
      ...extra,
    }, null, 2),
  );
  note(`${filename}: ok=${snap.testResult?.ok} events=${pulse.eventCount} magnitudes=${JSON.stringify(pulse.magnitudes)} injury=${pulse.injury ?? "(none)"}`);
  return snap;
}

try {
  // --- 1. UI Click-to-Map on a fresh project ---
  await loadProject();
  let snap = await getSnapshot(page);
  note(`Loaded targetId=${snap.templateId} examples=${snap.exampleCount} unmappedMandatory=${snap.unmappedMandatory}`);
  await Deno.writeTextFile(
    join(outDir, "01-after-load-snapshot.json"),
    JSON.stringify({
      templateId: snap.templateId,
      exampleCount: snap.exampleCount,
      unmappedMandatory: snap.unmappedMandatory,
      statusMessage: snap.statusMessage,
      slotCount: snap.model.slots.length,
      blockTypes: [...new Set(snap.blocklyBlocks.map((b) => b.type))].sort(),
    }, null, 2),
  );

  const injuryId = await findSlot(page, injurySuffix);
  const pulseRateId = await findSlot(page, pulseRateSuffix);
  const pulseTimeId = await findSlot(
    page,
    pulseTimeSuffix,
    "OBSERVATION.pulse.v2/data/at0002/events/at0003/time/value/value",
  );
  const pulsePosId = await findSlot(page, pulsePositionSuffix);
  note(`injury slot: ${injuryId}`);
  note(`pulse rate slot: ${pulseRateId}`);
  note(`pulse time slot: ${pulseTimeId}`);
  note(`pulse position slot: ${pulsePosId}`);

  const maps: Array<{ slot: string; path: string; label: string }> = [
    { slot: injuryId, path: "$.diagnosis.display", label: "injury←display" },
    { slot: pulseRateId, path: "$.measurements[1].pulse", label: "rate←pulse[1]" },
    { slot: pulseTimeId, path: "$.measurements[1].timestamp", label: "time←timestamp[1]" },
    { slot: pulsePosId, path: "$.measurements[1].bodyPosition", label: "position←bodyPosition[1]" },
  ];

  for (const m of maps) {
    try {
      await clickSlotRail(page, m.slot);
      await page.waitForFunction((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getSnapshot().listeningSlotId === id;
      }, m.slot, { timeout: 5_000 });
      await clickExamplePath(page, m.path);
      await page.waitForFunction((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        const slot = api.getSnapshot().model.slots.find((s) => s.slotId === id);
        return Boolean(slot?.expression);
      }, m.slot, { timeout: 8_000 });
      const after = await getSnapshot(page);
      const mapped = after.model.slots.find((s) => s.slotId === m.slot);
      note(`UI map ${m.label}: ${mapped?.expression ?? "(none)"}`);
    } catch (e) {
      note(`UI map FAILED ${m.label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const uiSnap = await runTestAndSnapshot("02-ui-mapping-snapshot.json");
  note(`UI loops: ${JSON.stringify(uiSnap.model.loops ?? [])}`);
  await saveDownload(page, "#btn-export-project", "ui-mapping.intehrgrator.zip");
  await saveDownload(page, "#btn-download-blockly", "ui-mapping.blockly.json");
  await saveDownload(page, "#btn-download-spec", "ui-mapping-spec.blockly.json");
  note("Saved UI mapping exports");

  // --- 2. Fresh load → Copy AI Prompt → import suggestions ---
  await loadProject();
  await installClipboardSpy();
  await page.click("#btn-copy-ai");
  await page.waitForFunction(() => {
    return Boolean((globalThis as unknown as { __clip?: string }).__clip);
  }, { timeout: 10_000 });
  const prompt = await page.evaluate(() =>
    (globalThis as unknown as { __clip?: string }).__clip ?? ""
  );
  await Deno.writeTextFile(join(outDir, "03-ai-prompt.md"), prompt);
  note(`Copied AI prompt (${prompt.length} chars)`);

  const suggestions = buildExternalAiEnvelope(prompt);
  await Deno.writeTextFile(join(outDir, "04-ai-suggestions.md"), suggestions);
  note("Wrote external-AI suggestion envelope");

  await page.evaluate((text) => {
    (globalThis as unknown as { __clip?: string }).__clip = text;
  }, suggestions);
  await page.click("#btn-import-ai");
  await page.waitForFunction(() => {
    const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
      .intehrgratorTestApi;
    return api.getSnapshot().statusMessage.startsWith("Import:");
  }, { timeout: 10_000 });
  const afterImport = await getSnapshot(page);
  note(`Import status: ${afterImport.statusMessage}`);
  note(`AI slots: ${JSON.stringify(afterImport.model.slots.map((s) => ({ label: s.label, expression: s.expression })))}`);
  note(`AI loops: ${JSON.stringify(afterImport.model.loops ?? [])}`);

  const aiSnap = await runTestAndSnapshot("05-ai-mapping-snapshot.json");
  await saveDownload(page, "#btn-export-project", "ai-mapping.intehrgrator.zip");
  await saveDownload(page, "#btn-download-blockly", "ai-mapping.blockly.json");
  await saveDownload(page, "#btn-download-spec", "ai-mapping-spec.blockly.json");
  note("Saved AI mapping exports");

  const uiPulse = summarizePulse(uiSnap.testResult?.output);
  const aiPulse = summarizePulse(aiSnap.testResult?.output);
  const comparison = [
    "# UI vs AI mapping comparison (semantics, not x/y)",
    "",
    "## Source → target (honest fills)",
    "- `diagnosis.display` → Injury (`DV_TEXT`)",
    "- `measurements[*].pulse` → Pulse Rate (`DV_QUANTITY`)",
    "- `measurements[*].timestamp` → event `time`",
    "- `measurements[*].bodyPosition` → Position (`DV_CODED_TEXT`, English enum not local at-codes)",
    "- systolic/diastolic mmHg: **not mapped** (template NEWS2 systolic is an ordinal score band, not mmHg)",
    "- `patientId`: no matching slot",
    "",
    "## UI Click-to-Map",
    `- expressions: ${JSON.stringify(uiSnap.model.slots.map((s) => s.expression))}`,
    `- loops: ${JSON.stringify(uiSnap.model.loops ?? [])}`,
    `- pulse events: ${uiPulse.eventCount}, magnitudes=${JSON.stringify(uiPulse.magnitudes)}, times=${JSON.stringify(uiPulse.times)}, injury=${uiPulse.injury}`,
    "",
    "## AI Import Suggestions",
    `- import: ${afterImport.statusMessage}`,
    `- expressions: ${JSON.stringify(aiSnap.model.slots.map((s) => s.expression))}`,
    `- loops: ${JSON.stringify(aiSnap.model.loops ?? [])}`,
    `- pulse events: ${aiPulse.eventCount}, magnitudes=${JSON.stringify(aiPulse.magnitudes)}, times=${JSON.stringify(aiPulse.times)}, injury=${aiPulse.injury}`,
    "",
    "## Verdict",
    uiPulse.eventCount === aiPulse.eventCount &&
      JSON.stringify(uiPulse.magnitudes) === JSON.stringify(aiPulse.magnitudes) &&
      uiPulse.injury === aiPulse.injury
      ? "Same composition semantics (injury text, pulse event count and rates)."
      : "Semantic mismatch — inspect 02-ui-mapping-snapshot.json vs 05-ai-mapping-snapshot.json.",
    "",
  ].join("\n");
  await Deno.writeTextFile(join(outDir, "06-comparison.md"), comparison);
  note(comparison);

  await Deno.writeTextFile(join(outDir, "00-notes.txt"), notes.join("\n") + "\n");
  console.log(`Artifacts in ${outDir}`);
} finally {
  await browser.close();
}
