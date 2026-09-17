// deno-lint-ignore-file no-import-prefix
/**
 * One-off screenshots of the #85 join_list Blockly prototype.
 * Usage: UI_TEST_BASE_URL=http://127.0.0.1:5173 deno run -A scripts/screenshot-join-list-prototype.ts
 */
import { chromium } from "npm:playwright@1.51.0";
import { ensureDir } from "@std/fs";
import { dirname, fromFileUrl, join } from "@std/path";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");
const base = Deno.env.get("UI_TEST_BASE_URL") ?? "http://127.0.0.1:5173";
const outDocs = join(root, "docs/prototypes/join-list");
const outArtifacts = "/opt/cursor/artifacts";
await ensureDir(outDocs);
try {
  await ensureDir(outArtifacts);
} catch {
  // artifacts dir may be missing outside Cloud Agent
}

const variants = ["A", "B", "C", "D", "E"] as const;
const names: Record<typeof variants[number], string> = {
  A: "compact_join_list",
  B: "named_slot_recipe",
  C: "locale_preset",
  D: "decision_table_first_last",
  E: "loop_index_length",
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (err) => console.error("pageerror", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.error("console", msg.text());
});

for (const key of variants) {
  const url = `${base}/prototype-join-list.html?variant=${key}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector(`[data-proto-ready="${key}"]`, { timeout: 15000 });
  await page.waitForTimeout(300);
  const file = `join_list_variant_${key.toLowerCase()}_${names[key]}.png`;
  const docsPath = join(outDocs, file);
  await page.screenshot({ path: docsPath, fullPage: true });
  console.log("wrote", docsPath);
  try {
    await page.screenshot({ path: join(outArtifacts, file), fullPage: true });
  } catch {
    // ignore
  }
}

await browser.close();
