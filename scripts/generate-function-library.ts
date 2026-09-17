/**
 * Write the curated Function library starters (Swedish + Oxford join).
 * Run: deno task generate:function-library
 */
import { dirname, fromFileUrl, join } from "@std/path";
import { ensureDir } from "@std/fs";
import * as enMsg from "blockly/msg/en";
import { Blockly } from "../src/blockly/blockly_core.ts";
import { initBlocklyGenerators } from "../src/blockly/mod.ts";
import {
  GRAMMATICAL_JOIN_SPECS,
  buildGrammaticalJoinBundle,
} from "../src/blockly/grammatical_join.ts";
import { functionBundleFilename, serializeFunctionBundle } from "../src/core/function_library/mod.ts";

const anyMod = enMsg as { default?: Record<string, string> } & Record<string, string>;
const table = anyMod.default && typeof anyMod.default === "object" ? anyMod.default : anyMod;
Blockly.setLocale(table);
initBlocklyGenerators();

const outDir = join(dirname(fromFileUrl(import.meta.url)), "..", "function-library");
await ensureDir(outDir);

const functions: Array<Record<string, unknown>> = [];
for (const spec of GRAMMATICAL_JOIN_SPECS) {
  const bundle = buildGrammaticalJoinBundle(spec);
  const filename = functionBundleFilename(spec.id);
  await Deno.writeTextFile(join(outDir, filename), serializeFunctionBundle(bundle));
  functions.push({
    id: spec.id,
    name: bundle.name,
    title: spec.id === "join_swedish" ? "Swedish list join" : "Oxford serial-comma join",
    description: bundle.description,
    file: filename,
    locale: bundle.locale,
    parameters: bundle.parameters,
    returns: bundle.returns,
    decisionTables: bundle.decisionTables,
  });
  console.log(`Wrote ${filename}`);
}

await Deno.writeTextFile(
  join(outDir, "catalog.json"),
  `${JSON.stringify({ version: 1, functions }, null, 2)}\n`,
);
console.log("Wrote catalog.json");
