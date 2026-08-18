/**
 * Browser UI test: dropping a Source Schema file onto #schema-tree.
 * Invalid JSON must show an in-pane error (not a silent no-op).
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import {
  baseUrl,
  dropTextFile,
  fixtureText,
  getSnapshot,
  waitForTestApi,
} from "./helpers.ts";

Deno.test({
  name: "UI: drop truncated schema JSON onto #schema-tree shows an error",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const truncated = await fixtureText("test/fixtures/ui/bp_sche_truncated.json");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);

      await dropTextFile(page, "#schema-tree", "bp-sche.json", truncated);
      await page.waitForSelector("#schema-tree .tree-pane-error", { timeout: 5_000 });

      const snap = await getSnapshot(page);
      assert(snap.schemaError, snap.statusMessage);
      assert(snap.schemaError.includes("bp-sche.json"), snap.schemaError);
      const pane = await page.locator("#schema-tree").innerText();
      assert(pane.includes("Could not load"), pane);
      assertEquals(pane.includes("Load a schema file."), false);
      assert(
        errors.some((line) => line.includes("bp-sche.json")),
        `expected console.error for schema load, got: ${errors.join(" | ")}`,
      );
    } finally {
      await browser.close();
    }
  },
});

Deno.test({
  name: "UI: drop JSON Schema onto #schema-tree renders field tree",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const schema = await fixtureText("test/fixtures/ui/bp_source_schema.json");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);

      await dropTextFile(page, "#schema-tree", "bp-sche.json", schema);
      await page.waitForSelector('#schema-tree .tree-row[data-path="$.systolic"]', {
        timeout: 5_000,
      });

      const snap = await getSnapshot(page);
      assertEquals(snap.schemaError, null);
      const pane = await page.locator("#schema-tree").innerText();
      assert(pane.includes("systolic"), pane);
    } finally {
      await browser.close();
    }
  },
});
