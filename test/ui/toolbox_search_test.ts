/**
 * Browser UI test: toolbox Search indexes custom Source / Maps blocks
 * and the search input is clickable (not covered by the category row).
 */

import { chromium } from "npm:playwright@1.51.0";
import { baseUrl, loadBpFixtures, waitForTestApi } from "./helpers.ts";

Deno.test({
  name: "UI: toolbox Search finds custom Source and Maps blocks",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);

      const search = page.locator('.blocklyToolboxDiv input[type="search"]');
      await search.waitFor({ timeout: 10_000 });
      await search.click();
      await search.pressSequentially("source", { delay: 40 });
      await page.waitForFunction(() => {
        const flyout = document.querySelector(".blocklyFlyout");
        return Boolean(flyout && /source/i.test(flyout.textContent ?? ""));
      }, { timeout: 8_000 });

      await search.fill("");
      await search.pressSequentially("maps", { delay: 40 });
      await page.waitForFunction(() => {
        const flyout = document.querySelector(".blocklyFlyout");
        return Boolean(flyout && /map/i.test(flyout.textContent ?? ""));
      }, { timeout: 8_000 });
    } finally {
      await browser.close();
    }
  },
});
