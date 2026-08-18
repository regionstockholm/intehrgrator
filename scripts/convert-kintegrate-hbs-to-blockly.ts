/**
 * One-time / repeatable conversion of Kintegrate Handlebars examples → Blockly
 * path-inventory workspaces (not a full narrative round-trip).
 *
 *   deno run -A scripts/convert-kintegrate-hbs-to-blockly.ts
 */
import { handlebarsTemplateToBlocklyState } from "../src/core/output/handlebars_to_blockly.ts";
import { dirname, fromFileUrl, join } from "@std/path";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");
const fixtureDir = join(root, "test", "fixtures", "kintegrate");

const jobs = [
  { hbs: "intro_tips.hbs", out: "intro_tips.blockly.json" },
  { hbs: "mdk_rek_demo.hbs", out: "mdk_rek_demo.blockly.json" },
  { hbs: "handlebars-script1.hbs", out: "handlebars-script1.blockly.json" },
  { hbs: "air-oxygenation.hbs", out: "air-oxygenation.blockly.json" },
];

for (const job of jobs) {
  const template = await Deno.readTextFile(join(fixtureDir, job.hbs));
  const state = handlebarsTemplateToBlocklyState(template);
  const outPath = join(fixtureDir, job.out);
  await Deno.writeTextFile(outPath, JSON.stringify(state, null, 2) + "\n");
  const count = (state.blocks as { blocks: unknown[] }).blocks.length;
  console.log(`Wrote ${outPath} (${count} blocks)`);
}
