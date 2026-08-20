/**
 * Browser UI test: Open canvas snapshot pops a print/save window with Blockly SVG.
 *
 * Requires a built Web Shell on UI_TEST_BASE_URL (default http://127.0.0.1:5173)
 * with `?testMode=1`. Prefer `deno task test:ui`.
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import { baseUrl, loadBpFixtures, waitForTestApi } from "./helpers.ts";

Deno.test({
  name: "UI: Open canvas snapshot shows Blockly SVG with print/save actions",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);

      const openBtn = page.locator("#btn-open-canvas");
      await openBtn.waitFor({ timeout: 10_000 });

      const popupPromise = page.waitForEvent("popup", { timeout: 10_000 });
      await openBtn.click();
      const popup = await popupPromise;
      await popup.waitForLoadState("domcontentloaded");

      const svg = popup.locator("#canvas svg.blocklySvg");
      await svg.waitFor({ timeout: 10_000 });
      const svgBox = await svg.boundingBox();
      assert(svgBox && svgBox.width > 40 && svgBox.height > 40, JSON.stringify(svgBox));

      assertEquals(await popup.locator("#btn-print").isEnabled(), true);
      assertEquals(await popup.locator("#btn-save-svg").isEnabled(), true);
      assertEquals(await popup.locator("#btn-save-png").isEnabled(), true);

      const className = await svg.getAttribute("class");
      assert(className?.includes("blocklySvg"), className);
    } finally {
      await browser.close();
    }
  },
});
