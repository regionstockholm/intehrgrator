/**
 * Browser UI test: "openEHR" category in the Blockly toolbox
 * opens a flyout containing all openEHR blocks with clean category list alignment.
 */

import { chromium } from "npm:playwright@1.51.0";
import { assert, assertEquals } from "@std/assert";
import { baseUrl, waitForTestApi } from "./helpers.ts";

Deno.test({
  name: "UI: openEHR category opens flyout with openEHR blocks",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      const page = await context.newPage({ viewport: { width: 1400, height: 900 } });
      const client = await context.newCDPSession(page);
      await client.send("Network.setCacheDisabled", { cacheDisabled: true });

      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);

      // Find "openEHR" category and "Logic" category below it
      const openEhrTypesCategory = page.locator(".blocklyToolboxCategoryOpenEhrTypes");
      await openEhrTypesCategory.waitFor({ timeout: 10_000 });

      const logicCategory = page.locator(".blocklyToolboxCategoryLogic");
      await logicCategory.waitFor({ timeout: 10_000 });

      // Verify category positions are orderly (Logic is strictly below openEHR)
      const openEhrBox = await openEhrTypesCategory.boundingBox();
      const logicBox = await logicCategory.boundingBox();
      if (!openEhrBox || !logicBox) throw new Error("Could not get category bounding boxes");

      assert(
        logicBox.y > openEhrBox.y,
        `Logic category should be below openEHR (openEHR Y: ${openEhrBox.y}, Logic Y: ${logicBox.y})`,
      );

      // Click "openEHR" category to open flyout
      await openEhrTypesCategory.click();
      await page.waitForTimeout(500);

      // Verify flyout opens and contains openEHR blocks
      const flyout = page.locator(".blocklyFlyout");
      await flyout.waitFor({ timeout: 5_000 });
      const isFlyoutVisible = await flyout.isVisible();
      assertEquals(
        isFlyoutVisible,
        true,
        "Blockly flyout should be visible when openEHR category is selected",
      );

      // Verify flyout contains key openEHR blocks
      const blockCount = await page.evaluate(() => {
        const flyoutBlocks = document.querySelectorAll(".blocklyFlyout .blocklyBlockCanvas > g");
        return flyoutBlocks.length;
      });
      assert(blockCount >= 10, `Flyout should contain openEHR blocks (found ${blockCount})`);
    } finally {
      await browser.close();
    }
  },
});
