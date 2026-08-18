/**
 * Browser UI test: split load buttons open a URL dialog and remember recent URLs.
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import {
  baseUrl,
  fixtureText,
  getSnapshot,
  waitForTestApi,
} from "./helpers.ts";

Deno.test({
  name: "UI: Load Schema from URL renders tree and appears in recent URLs",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const schema = await fixtureText("test/fixtures/ui/bp_source_schema.json");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.route("https://fixtures.test/**", async (route) => {
        const url = route.request().url();
        if (url.endsWith("/bp-schema.json")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { "access-control-allow-origin": "*" },
            body: schema,
          });
          return;
        }
        await route.fulfill({
          status: 404,
          headers: { "access-control-allow-origin": "*" },
          body: "missing",
        });
      });
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);

      await page.click("#btn-load-schema-menu");
      await page.getByRole("menuitem", { name: "From URL…" }).click();
      await page.waitForSelector("#dialog-load-url[open]");
      await page.fill("#load-url-input", "https://fixtures.test/bp-schema.json");
      await page.click("#load-url-confirm");
      await page.waitForSelector('#schema-tree .tree-row[data-path="$.systolic"]', {
        timeout: 5_000,
      });

      const snap = await getSnapshot(page);
      assertEquals(snap.schemaError, null);
      const pane = await page.locator("#schema-tree").innerText();
      assert(pane.includes("systolic"), pane);

      await page.click("#btn-load-schema-menu");
      const recent = page.getByRole("menuitem", { name: "https://fixtures.test/bp-schema.json" });
      await recent.waitFor({ timeout: 3_000 });
    } finally {
      await browser.close();
    }
  },
});
