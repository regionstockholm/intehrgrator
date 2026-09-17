/**
 * Apply an intehrgrator-suggestions envelope to a catalog Example Set, export
 * Blockly (+ optional Sheets), and run TypeScript Conversion Test.
 *
 * Usage:
 *   deno run -A --no-check scripts/apply-example-mapping.ts \
 *     --set dummy-json-vitals-mapped \
 *     --suggestions path/to/envelope.json \
 *     [--sheets path/to/sheets.json] \
 *     [--encoding flat-json] \
 *     [--out-dir test/fixtures/dummy-json-vitals]
 */
import { dirname, fromFileUrl, join, resolve } from "@std/path";
import { WorkbenchService } from "../src/workbench/service.ts";
import { callAgentTool } from "../src/agent/tools.ts";
import { sheetsFromCatalogJson } from "../src/core/sheets/mod.ts";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");

function arg(name: string): string | undefined {
  const i = Deno.args.indexOf(`--${name}`);
  if (i >= 0) return Deno.args[i + 1];
  const pref = `--${name}=`;
  const hit = Deno.args.find((a) => a.startsWith(pref));
  return hit?.slice(pref.length);
}

function required(name: string): string {
  const v = arg(name);
  if (!v) throw new Error(`missing --${name}`);
  return v;
}

const setId = required("set");
const suggestionsPath = required("suggestions");
const sheetsPath = arg("sheets");
const encoding = arg("encoding");
const outDir = arg("out-dir");
const catalogPath = arg("catalog") ?? join(root, "examples", "example-sets.json");

const service = new WorkbenchService();
await callAgentTool(service, "register_agent", {
  agentId: "example-set-mapper",
  displayName: "Example set mapper",
});

const loaded = await callAgentTool(service, "load_example_set", {
  catalogPath,
  setId,
  includeMapping: false,
}) as { snapshot: { templateId: string; revision: string; exampleCount: number } };

let revision = loaded.snapshot.revision;
if (sheetsPath) {
  const raw = JSON.parse(await Deno.readTextFile(resolve(sheetsPath))) as unknown;
  const sheets = sheetsFromCatalogJson(raw);
  const replaced = await callAgentTool(service, "replace_sheets", { sheets, revision }) as {
    revision: string;
  };
  revision = replaced.revision;
}

const envelopeText = await Deno.readTextFile(resolve(suggestionsPath));
const imported = await callAgentTool(service, "import_suggestions", {
  text: envelopeText,
  revision,
}) as { revision: string; report: { applied: number; skipped: number; errors: string[]; loopsAccepted?: number } };
revision = imported.revision;
console.log("import", JSON.stringify(imported.report, null, 2));
if ((imported.report.errors?.length ?? 0) > 0 || imported.report.applied === 0) {
  throw new Error(`import_suggestions did not apply mappings: ${JSON.stringify(imported.report)}`);
}

if (encoding) {
  const enc = await callAgentTool(service, "set_instance_encoding", {
    encoding,
    revision,
  }) as { revision: string };
  revision = enc.revision;
}

const script = await callAgentTool(service, "generate_script", { language: "typescript" }) as {
  code: string;
};
console.log("typescript script bytes", script.code.length);

const sourceTree = await callAgentTool(service, "get_source_tree", {}) as {
  examples: Array<{ id: string; filename: string }>;
};
const tsResults: Array<{ filename: string; ok: boolean; error?: string; validationValid?: boolean }> = [];
for (const ex of sourceTree.examples) {
  await callAgentTool(service, "set_active_example", { id: ex.id });
  const tested = await callAgentTool(service, "run_test", { outputMode: "typescript" }) as {
    testResult: {
      ok: boolean;
      error?: string;
      outputValidation?: { applicable?: boolean; valid?: boolean; messages?: unknown[] };
    };
  };
  tsResults.push({
    filename: ex.filename,
    ok: tested.testResult.ok,
    error: tested.testResult.error,
    validationValid: tested.testResult.outputValidation?.valid,
  });
}
console.log("typescript test", JSON.stringify(tsResults, null, 2));

if (outDir) {
  const dest = resolve(outDir);
  await Deno.mkdir(dest, { recursive: true });
  const bundle = service.exportBundle();
  const blockly = JSON.stringify(bundle.mapping.blocklyState, null, 2);
  await Deno.writeTextFile(join(dest, "mapping.blockly.json"), blockly.endsWith("\n") ? blockly : `${blockly}\n`);
  if (bundle.mapping.sheets?.length) {
    await Deno.writeTextFile(
      join(dest, "mapping.sheets.json"),
      `${JSON.stringify(bundle.mapping.sheets, null, 2)}\n`,
    );
  }
  console.log("wrote", dest);
}

Deno.exit(tsResults.every((r) => r.ok) ? 0 : 2);
