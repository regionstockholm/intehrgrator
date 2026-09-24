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
      page.on("dialog", (dialog) => dialog.accept());

      await page.click("#btn-example-sets");
      const item = page.locator('[data-example-set-id="dummy-json-vitals"]');
      await item.waitFor({ timeout: 10_000 });
      assertEquals(
        (await item.innerText()).trim(),
        "Dummy vitals (JSON Schema → JSON Schema) — unmapped",
      );
      const mappedItem = page.locator('[data-example-set-id="dummy-json-vitals-mapped"]');
      await mappedItem.waitFor({ timeout: 10_000 });
      assertEquals(
        (await mappedItem.innerText()).trim(),
        "Dummy vitals (JSON Schema → JSON Schema) — mapped",
      );
      await item.click();

      await page.waitForFunction(() => {
        const api = (globalThis as unknown as {
          intehrgratorTestApi?: {
            getSnapshot: () => {
              exampleCount: number;
              taskProgress: unknown;
              statusMessage: string;
            };
          };
        }).intehrgratorTestApi;
        const snap = api?.getSnapshot();
        // Dummy JSON vitals has three instances. Do not settle at >= 2: the
        // overlay still shows "Load example 3" while the third fetch is in
        // flight (PR CI runners often snapshot that window).
        return Boolean(
          snap &&
            snap.exampleCount >= 3 &&
            snap.taskProgress == null &&
            snap.statusMessage.startsWith("Loaded example set"),
        );
      }, undefined, { timeout: 20_000 });

      const snap = await getSnapshot(page);
      assertEquals(snap.exampleCount, 3, snap.statusMessage);
      assertStringIncludes(
        snap.statusMessage,
        "Dummy vitals (JSON Schema → JSON Schema) — unmapped",
      );
    } finally {
      await browser.close();
    }
  },
});

Deno.test({
  name: "UI: Example Sets dropdown loads the dummy JSON vitals mapped set",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      page.on("dialog", (dialog) => dialog.accept());

      await page.click("#btn-example-sets");
      const item = page.locator('[data-example-set-id="dummy-json-vitals-mapped"]');
      await item.waitFor({ timeout: 10_000 });
      assertEquals(
        (await item.innerText()).trim(),
        "Dummy vitals (JSON Schema → JSON Schema) — mapped",
      );
      await item.click();

      await page.waitForFunction(() => {
        const api = (globalThis as unknown as {
          intehrgratorTestApi?: {
            getSnapshot: () => {
              exampleCount: number;
              taskProgress: unknown;
              statusMessage: string;
            };
          };
        }).intehrgratorTestApi;
        const snap = api?.getSnapshot();
        return Boolean(
          snap &&
            snap.exampleCount >= 3 &&
            snap.taskProgress == null &&
            snap.statusMessage.startsWith("Loaded example set"),
        );
      }, undefined, { timeout: 20_000 });

      const snap = await getSnapshot(page);
      assertEquals(snap.exampleCount, 3, snap.statusMessage);
      assertStringIncludes(
        snap.statusMessage,
        "Dummy vitals (JSON Schema → JSON Schema) — mapped",
      );
    } finally {
      await browser.close();
    }
  },
});
