/**
 * Chrome for joint load + Copy prompt / Call AI (#158 / #140 remainder).
 * File pickers stay on the Test API; this file clicks the dialogs and menus.
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import { baseUrl, waitForTestApi } from "./helpers.ts";

Deno.test({
  name: "UI: Copy prompt menu offers Call AI and AI credentials",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      assertEquals((await page.locator("#btn-copy-ai").innerText()).trim(), "Copy prompt");
      await page.click("#btn-copy-ai-menu");
      await page.locator("#menu-copy-ai").waitFor({ state: "visible", timeout: 5_000 });
      await page.locator('[data-ai-action="call"]').waitFor({ state: "visible" });
      await page.locator('[data-ai-action="credentials"]').waitFor({ state: "visible" });
      await page.click('[data-ai-action="credentials"]');
      await page.locator("#dialog-ai-credentials").waitFor({ state: "visible", timeout: 5_000 });
      await page.click("#ai-credentials-cancel");
    } finally {
      await browser.close();
    }
  },
});

Deno.test({
  name: "UI: target chevron lists non-destructive refresh",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await page.click("#btn-open-template-menu");
      await page.locator("#menu-open-template").waitFor({ state: "visible", timeout: 5_000 });
      const text = await page.locator("#menu-open-template").innerText();
      assert(text.includes("Refresh from file"), text);
      assert(text.includes("Refresh from URL"), text);
    } finally {
      await browser.close();
    }
  },
});
