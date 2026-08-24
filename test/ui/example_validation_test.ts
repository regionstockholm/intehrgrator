/**
 * Browser UI test: loading a JSON Schema then an instance that violates
 * value constraints (enum / minimum) must warn but still populate the tree.
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
  name: "UI: invalid example instance loads with schema value-constraint warnings",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const schema = await fixtureText("test/fixtures/legacy-simulated-json/bp-schema.json");
    const instance = await fixtureText(
      "test/fixtures/legacy-simulated-json/instances/bp-inst-3-invalid.json",
    );
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);

      await dropTextFile(page, "#schema-tree", "bp-sche.json", schema);
      await page.waitForSelector('#schema-tree .tree-row[data-path="$.systolic"]', {
        timeout: 5_000,
      });

      await dropTextFile(page, "#example-tree", "bp-inst-3-invalid.json", instance);
      await page.waitForSelector('#example-tree .tree-row[data-path="$.diastolic"]', {
        timeout: 5_000,
      });

      await page.waitForSelector("#example-validation:not([hidden])", { timeout: 5_000 });
      const warning = await page.locator("#example-validation").innerText();
      assert(warning.toLowerCase().includes("schema mismatch"), warning);
      assert(warning.includes("diastolic"), warning);
      assert(warning.includes("bodyPosition"), warning);

      const snap = await getSnapshot(page);
      assert(snap.exampleIssueCount >= 2, `exampleIssueCount=${snap.exampleIssueCount}`);
      assertEquals(snap.activeExampleFilename, "bp-inst-3-invalid.json");
      assert(
        snap.statusMessage.toLowerCase().includes("mismatch"),
        snap.statusMessage,
      );

      const invalidRow = page.locator('#example-tree .tree-row--invalid[data-path="$.diastolic"]');
      assertEquals(await invalidRow.count(), 1);
    } finally {
      await browser.close();
    }
  },
});
