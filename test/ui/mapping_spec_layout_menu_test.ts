/**
 * Browser UI test: Mapping Spec ▾ uses the same anchored split-button as
 * Example Sets (must not open at the page origin).
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import { baseUrl, waitForTestApi } from "./helpers.ts";

Deno.test({
  name: "UI: Mapping Spec layout menu anchors under the split button",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1400, height: 900 });
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);

      const chevron = page.locator("#tab-mapping-json-menu");
      await chevron.waitFor({ timeout: 10_000 });
      await chevron.click();

      const menu = page.locator("#menu-mapping-spec-layout");
      await menu.waitFor({ state: "visible", timeout: 5_000 });
      assertEquals(await menu.isVisible(), true);
      assertEquals(await page.locator("[data-spec-layout=list]").isVisible(), true);
      assertEquals(await page.locator("[data-spec-layout=tabs]").isVisible(), true);

      const chevronBox = await chevron.boundingBox();
      const menuBox = await menu.boundingBox();
      assert(chevronBox, "Mapping Spec chevron has a box");
      assert(menuBox, "layout menu has a box");
      assert(
        menuBox.y > 40,
        `menu y=${menuBox.y} must not sit at the page origin`,
      );
      assert(
        menuBox.x > 40,
        `menu x=${menuBox.x} must not sit at the page origin`,
      );
      assert(
        Math.abs(menuBox.y - (chevronBox.y + chevronBox.height)) < 24,
        `menu should sit just under the split button (menu.y=${menuBox.y}, chevron.bottom=${chevronBox.y + chevronBox.height})`,
      );
      const chevronRight = chevronBox.x + chevronBox.width;
      assert(
        menuBox.x < chevronRight && menuBox.x + menuBox.width > chevronBox.x,
        `menu should overlap the Mapping Spec split button (menu.x=${menuBox.x} w=${menuBox.width}, chevron.x=${chevronBox.x})`,
      );

      await page.locator("[data-spec-layout=tabs]").click();
      await menu.waitFor({ state: "hidden", timeout: 5_000 });
    } finally {
      await browser.close();
    }
  },
});
