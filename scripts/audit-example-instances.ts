/**
 * Audit every fixture source instance against its corresponding schema.
 * Prints a markdown table and writes JSON to stdout when --json is passed.
 *
 * Usage: deno run -A --no-check scripts/audit-example-instances.ts
 */
import { dirname, fromFileUrl, join } from "@std/path";
import { loadJsonSchema } from "../src/core/source/schema_loader.ts";
import { detectSourceFormat } from "../src/core/source/format_handler.ts";
import { validateInstanceAgainstSchema } from "../src/core/source/instance_validation.ts";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");
const catalogPath = join(root, "examples", "example-sets.json");
const fixtures = join(root, "test", "fixtures");

const NAME_BROKEN = /invalid|broken|fail|bad/i;

interface CatalogSet {
  id: string;
  title: string;
  source?: { schema?: string; instances?: string[] };
  mapping?: string;
  target?: string;
}

interface Row {
  setId: string;
  sourceSet: string;
  instance: string;
  inCatalog: boolean;
  namedBroken: boolean;
  schemaRel: string | null;
  ok: boolean;
  issueCount: number;
  issues: string[];
  notes: string[];
}

function resolveCatalogRef(ref: string): string {
  return join(dirname(catalogPath), ref);
}

function namedBroken(name: string): boolean {
  return NAME_BROKEN.test(name);
}

async function validatePair(
  instancePath: string,
  schemaPath: string | null,
): Promise<{ ok: boolean; issues: string[]; notes: string[] }> {
  const notes: string[] = [];
  const content = await Deno.readTextFile(instancePath);
  if (!schemaPath) {
    try {
      JSON.parse(stripPreamble(content));
      return { ok: true, issues: [], notes: ["no source schema; parsed as JSON"] };
    } catch {
      return { ok: false, issues: ["instance is not JSON and has no schema"], notes };
    }
  }
  const schemaText = await Deno.readTextFile(schemaPath);
  const schema = loadJsonSchema(schemaText, "root");
  const format = detectSourceFormat(instancePath, content);
  const payload = format === "json" ? stripPreamble(content) : content;
  const issues = validateInstanceAgainstSchema(payload, format, schema, schemaText);
  if (schemaPath.endsWith(".avsc") && issues.length) {
    notes.push("validated against Avro field tree (not JSON Schema draft)");
  }
  return {
    ok: issues.length === 0,
    issues: issues.slice(0, 12).map((i) => `${i.path}: ${i.message}`),
    notes,
  };
}

/** Chemo FLAT files have a prose preamble before the JSON object. */
function stripPreamble(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  const obj = text.indexOf("\n{");
  const arr = text.indexOf("\n[");
  const idx = [obj, arr].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (idx == null) return text;
  return text.slice(idx + 1).trim();
}

async function listJsonFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  try {
    for await (const e of Deno.readDir(dir)) {
      if (!e.isFile) continue;
      if (/\.(json|txt)$/i.test(e.name)) out.push(join(dir, e.name));
    }
  } catch {
    // missing dir
  }
  return out.sort();
}

async function extraFieldsVsSchema(
  instancePath: string,
  schemaPath: string,
): Promise<string[]> {
  const schemaText = await Deno.readTextFile(schemaPath);
  let schema: unknown;
  try {
    schema = JSON.parse(schemaText);
  } catch {
    return [];
  }
  if (!schema || typeof schema !== "object") return [];
  const rec = schema as Record<string, unknown>;
  const props = rec.properties && typeof rec.properties === "object"
    ? Object.keys(rec.properties as Record<string, unknown>)
    : rec.fields && Array.isArray(rec.fields)
    ? (rec.fields as Array<{ name?: string }>).map((f) => f.name).filter((n): n is string => !!n)
    : [];
  if (!props.length) return [];
  const allowed = new Set(props);
  const instance = JSON.parse(stripPreamble(await Deno.readTextFile(instancePath))) as unknown;
  const obj = Array.isArray(instance) ? instance[0] : instance;
  if (!obj || typeof obj !== "object") return [];
  return Object.keys(obj as Record<string, unknown>).filter((k) => !allowed.has(k));
}

const catalog = JSON.parse(await Deno.readTextFile(catalogPath)) as { sets: CatalogSet[] };

const rows: Row[] = [];
const schemaFlags: string[] = [];

const cataloguedInstanceAbs = new Set<string>();
for (const set of catalog.sets) {
  const schemaRel = set.source?.schema ?? null;
  const schemaAbs = schemaRel ? resolveCatalogRef(schemaRel) : null;
  for (const instRel of set.source?.instances ?? []) {
    const instAbs = resolveCatalogRef(instRel);
    cataloguedInstanceAbs.add(instAbs);
    const name = instRel.split("/").pop() ?? instRel;
    const result = await validatePair(instAbs, schemaAbs);
    if (schemaAbs?.endsWith(".json") && result.ok === false) {
      const extras = await extraFieldsVsSchema(instAbs, schemaAbs).catch(() => []);
      if (extras.length) {
        schemaFlags.push(
          `${set.id}: instance ${name} has fields not in JSON Schema: ${extras.join(", ")}`,
        );
      }
    }
    rows.push({
      setId: set.id,
      sourceSet: set.id,
      instance: name,
      inCatalog: true,
      namedBroken: namedBroken(name),
      schemaRel,
      ok: result.ok,
      issueCount: result.issues.length,
      issues: result.issues,
      notes: result.notes,
    });
  }
  if ((set.source?.instances ?? []).length === 0) {
    rows.push({
      setId: set.id,
      sourceSet: set.id,
      instance: "(none)",
      inCatalog: true,
      namedBroken: false,
      schemaRel,
      ok: false,
      issueCount: 0,
      issues: [],
      notes: ["catalog lists zero Example Instances"],
    });
  }
}

/** Uncatalogued source-instance directories that still belong to fixture source sets. */
const extraSets: Array<{ id: string; schema: string | null; dir: string }> = [
  {
    id: "sheets/icd10-snomed (uncatalogued)",
    schema: null,
    dir: join(fixtures, "sheets", "mapping"),
  },
];

for (const extra of extraSets) {
  for (const instAbs of await listJsonFiles(extra.dir)) {
    if (cataloguedInstanceAbs.has(instAbs)) continue;
    const name = instAbs.split("/").pop()!;
    if (extra.id.startsWith("sheets") && !name.includes("source")) continue;
    const result = await validatePair(instAbs, extra.schema);
    rows.push({
      setId: extra.id,
      sourceSet: extra.id,
      instance: name,
      inCatalog: false,
      namedBroken: namedBroken(name),
      schemaRel: extra.schema,
      ok: result.ok,
      issueCount: result.issues.length,
      issues: result.issues,
      notes: result.notes,
    });
  }
}

/** Compare karda JSON Schema vs Avro vs instances (schema-wrong flags). */
async function flagKardaSchema(label: string, jsonSchema: string, avsc: string, instances: string[]) {
  const jsonText = await Deno.readTextFile(jsonSchema);
  const avscObj = JSON.parse(await Deno.readTextFile(avsc)) as { fields: Array<{ name: string }> };
  const jsonObj = JSON.parse(jsonText) as { properties?: Record<string, unknown> };
  const jsonKeys = new Set(Object.keys(jsonObj.properties ?? {}));
  const avroKeys = new Set(avscObj.fields.map((f) => f.name));
  const onlyAvro = [...avroKeys].filter((k) => !jsonKeys.has(k));
  const onlyJson = [...jsonKeys].filter((k) => !avroKeys.has(k));
  if (onlyAvro.length) schemaFlags.push(`${label}: JSON Schema missing Avro fields: ${onlyAvro.join(", ")}`);
  if (onlyJson.length) schemaFlags.push(`${label}: JSON Schema has extra fields vs Avro: ${onlyJson.join(", ")}`);
  for (const inst of instances) {
    const extrasJson = await extraFieldsVsSchema(inst, jsonSchema);
    const extrasAvro = await extraFieldsVsSchema(inst, avsc);
    if (extrasJson.length) {
      schemaFlags.push(`${label}: ${inst.split("/").pop()} extra vs JSON Schema: ${extrasJson.join(", ")}`);
    }
    if (extrasAvro.length) {
      schemaFlags.push(`${label}: ${inst.split("/").pop()} extra vs Avro: ${extrasAvro.join(", ")}`);
    }
  }
}

const adminInstDir = join(fixtures, "administrerad-medicinsk-onkologisk-behandling", "source-instance");
const ordInstDir = join(fixtures, "ordinerad-medicinsk-onkologisk-behandling", "source-instance");
await flagKardaSchema(
  "karda-admin",
  join(fixtures, "administrerad-medicinsk-onkologisk-behandling", "source-schema", "AdministrationRCCV1_source_schema.json"),
  join(fixtures, "administrerad-medicinsk-onkologisk-behandling", "source-schema", "AdministrationRCCV1_source_schema.avsc"),
  await listJsonFiles(adminInstDir),
);
await flagKardaSchema(
  "karda-ordination",
  join(fixtures, "ordinerad-medicinsk-onkologisk-behandling", "source-schema", "OrdinationRCCV1_source_schema.json"),
  join(fixtures, "ordinerad-medicinsk-onkologisk-behandling", "source-schema", "OrdinationRCCV1_source_schema.avsc"),
  await listJsonFiles(ordInstDir),
);

const asJson = Deno.args.includes("--json");
if (asJson) {
  console.log(JSON.stringify({ rows, schemaFlags }, null, 2));
} else {
  console.log("| Set | Instance | Catalog | Named-broken | Schema-valid | Notes |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    const status = r.namedBroken ? (r.ok ? "unexpectedly valid" : "invalid (expected)") : (r.ok ? "valid" : "INVALID");
    const notes = [...r.notes, ...r.issues.slice(0, 3)].join("; ").replace(/\|/g, "/");
    console.log(
      `| ${r.setId} | \`${r.instance}\` | ${r.inCatalog ? "yes" : "no"} | ${r.namedBroken ? "yes" : "no"} | ${status} | ${notes || "—"} |`,
    );
  }
  console.log("\n## Schema flags\n");
  if (!schemaFlags.length) console.log("(none)");
  else for (const f of schemaFlags) console.log(`- ${f}`);
}

await Deno.mkdir("/opt/cursor/artifacts", { recursive: true });
await Deno.writeTextFile(
  "/opt/cursor/artifacts/example-instance-audit.json",
  JSON.stringify({ rows, schemaFlags }, null, 2),
);
