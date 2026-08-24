/**
 * Browser UI test: Example Sets dropdown loads catalogued source/target URIs.
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import { baseUrl, getSnapshot, waitForTestApi } from "./helpers.ts";

Deno.test({
  name: "UI: Example Sets dropdown loads the dummy JSON vitals set",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);

      await page.click("#btn-example-sets-menu");
      const item = page.locator('[data-example-set-id="dummy-json-vitals"]');
      await item.waitFor({ timeout: 10_000 });
      await item.click();

      await page.waitForFunction(() => {
        const api = (globalThis as unknown as {
          intehrgratorTestApi?: { getSnapshot: () => { exampleCount: number } };
        }).intehrgratorTestApi;
        return (api?.getSnapshot().exampleCount ?? 0) >= 2;
      }, { timeout: 10_000 });

      const snap = await getSnapshot(page);
      assertEquals(snap.exampleCount, 2);
      assertStringIncludes(snap.statusMessage, "Dummy vitals");
    } finally {
      await browser.close();
    }
  },
});
