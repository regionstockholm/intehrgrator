/**
 * Browser UI test: Functions dialog loads the bundled Swedish join Function.
 */

import { assert } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import { baseUrl, getSnapshot, waitForTestApi } from "./helpers.ts";

Deno.test({
  name: "UI: Functions dialog loads join_swedish from the bundled library",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);

      await page.click("#btn-functions");
      const dialog = page.locator("#dialog-functions");
      await dialog.waitFor({ state: "visible", timeout: 10_000 });
      const load = page.locator('[data-function-id="join_swedish"] button', { hasText: "Load" });
      await load.waitFor({ timeout: 15_000 });
      await load.click();

      await page.waitForFunction(() => {
        const api = (globalThis as unknown as {
          intehrgratorTestApi?: {
            getSnapshot: () => { blocklyBlocks: Array<{ type: string; fields: Record<string, string> }> };
          };
        }).intehrgratorTestApi;
        return api?.getSnapshot().blocklyBlocks.some((block) =>
          block.type === "procedures_defreturn" && block.fields.NAME === "join_swedish"
        ) ?? false;
      }, undefined, { timeout: 15_000 });

      const snap = await getSnapshot(page);
      assert(
        snap.blocklyBlocks.some((block) =>
          block.type === "procedures_defreturn" && block.fields.NAME === "join_swedish"
        ),
        snap.statusMessage,
      );
    } finally {
      await browser.close();
    }
  },
});
