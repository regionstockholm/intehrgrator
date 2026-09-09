/**
 * TERM_PICK rows in Mapping Spec are editable; scaffolding puts object-valued
 * defaults into the RM attribute mouth (not CODE_PHRASE.code).
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import { baseUrl, loadBpFixtures, waitForTestApi } from "./helpers.ts";
import type { IntehrgratorTestApi } from "../../src/ui_test/test_api.ts";

Deno.test({
  name: "UI: TERM_PICK Spec rows are editable; language maps_get sits on COMPOSITION",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);
      await page.waitForTimeout(600);

      const spec = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getMappingSpecDocument();
      });
      assertEquals(spec.includes("maps_get"), true);
      assertEquals(/language\s+maps_get/.test(spec) || spec.includes('defaults["language"]'), true);

      const termPickControls = page.locator(
        '.spec-widget--term_pick input, .spec-widget--term_pick select, .searchable-pick-input',
      );
      await termPickControls.first().waitFor({ timeout: 10_000 });
      assert(await termPickControls.count() >= 2, "TERM_PICK rows should expose SET and CODE editors");

      const snap = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getSnapshot();
      });
      const languagePicks = snap.blocklyBlocks.filter((block) =>
        block.type === "term_pick" && block.fields.SET === "ISO_639-1"
      );
      assert(languagePicks.length > 0, "expected ISO_639-1 term_pick on the canvas");
      const mapsGets = snap.blocklyBlocks.filter((block) => block.type === "maps_get");
      assert(mapsGets.length > 0, "expected Default point maps_get lookups");
    } finally {
      await browser.close();
    }
  },
});
