/**
 * Browser UI test: Help opens a dialog with tutorial and GitHub issue links.
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import { HELP_LINKS } from "../../src/ui/help_links.ts";
import { baseUrl, waitForTestApi } from "./helpers.ts";

Deno.test({
  name: "UI: Help dialog links to tutorial and issue templates",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.context().grantPermissions(["clipboard-write", "clipboard-read"], {
        origin: baseUrl,
      });
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);

      await page.click("#btn-help");
      await page.waitForSelector("#dialog-help[open]", { timeout: 5_000 });

      const tutorial = page.locator("#dialog-help a[data-help-link='tutorial']");
      const bug = page.locator("#dialog-help a[data-help-link='bug']");
      const feature = page.locator("#dialog-help a[data-help-link='feature']");
      assertEquals(await tutorial.getAttribute("href"), HELP_LINKS.tutorial);
      assertEquals(await bug.getAttribute("href"), HELP_LINKS.bug);
      assertEquals(await feature.getAttribute("href"), HELP_LINKS.feature);
      assertEquals(await tutorial.getAttribute("target"), "_blank");

      const requestWrap = await page.evaluate(() => {
        const link = document.querySelector<HTMLAnchorElement>(
          "#dialog-help a[data-help-link='feature']",
        );
        if (!link) return { clientHeight: 0, lineHeight: 0 };
        const style = getComputedStyle(link);
        return {
          clientHeight: link.clientHeight,
          lineHeight: Number.parseFloat(style.lineHeight),
        };
      });
      assert(
        requestWrap.clientHeight <= requestWrap.lineHeight * 1.5 + 4,
        `feature link wrapped: ${JSON.stringify(requestWrap)}`,
      );

      const version = (await page.locator("#help-version").innerText()).trim();
      const origin = (await page.locator("#help-origin").innerText()).trim();
      assert(version.startsWith("v"), version);
      assert(origin.startsWith("http"), origin);

      await page.click("#help-copy-version");
      await page.waitForFunction(() => {
        const btn = document.getElementById("help-copy-version");
        return btn?.textContent === "Copied";
      }, { timeout: 5_000 });
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      assert(copied.includes(version), copied);
      assert(copied.includes(origin), copied);

      await page.click("#help-close");
      await page.waitForFunction(() => !document.querySelector("#dialog-help[open]"), {
        timeout: 5_000,
      });
    } finally {
      await browser.close();
    }
  },
});
