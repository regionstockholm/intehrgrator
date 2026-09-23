/**
 * UI language reload must keep a loaded project (examples, schema, target).
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import { baseUrl, getSnapshot, loadBpFixtures, waitForTestApi } from "./helpers.ts";

Deno.test({
  name: "UI: changing application language keeps loaded examples and target",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);
      await page.waitForFunction(() => {
        const api = (globalThis as { intehrgratorTestApi?: { getSnapshot: () => { blocklyBlocks: Array<{ type: string }> } } })
          .intehrgratorTestApi;
        return api?.getSnapshot().blocklyBlocks.some((block) => block.type === "composition") === true;
      }, undefined, { timeout: 20_000 });
      const before = await getSnapshot(page);
      assertEquals(before.exampleCount, 1);
      assertEquals(before.activeExampleFilename, "bp_example.json");
      assert(before.templateId.length > 0, "expected a loaded target");

      await page.selectOption("#ui-language-dropdown", "sv");
      await page.waitForURL(/[?&]hl=sv(?:&|$)/, { timeout: 15_000 });
      await waitForTestApi(page);

      const after = await getSnapshot(page);
      assertEquals(after.exampleCount, 1);
      assertEquals(after.activeExampleFilename, "bp_example.json");
      assertEquals(after.templateId, before.templateId);
      assertEquals(await page.locator("#source-pane h2").innerText(), "Källa");
      assert(
        after.blocklyBlocks.some((block) => block.type === "composition"),
        "canvas should still hold the template skeleton",
      );
    } finally {
      await browser.close();
    }
  },
});
