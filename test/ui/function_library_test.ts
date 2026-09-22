/**
 * Browser UI test: Functions dialog loads the bundled Swedish join Function.
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import type { IntehrgratorTestApi } from "../../src/ui_test/test_api.ts";
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
          block.type === "procedures_defreturn" && block.fields.NAME === "join_swedish_words"
        ) ?? false;
      }, undefined, { timeout: 15_000 });

      const snap = await getSnapshot(page);
      assert(
        snap.blocklyBlocks.some((block) =>
          block.type === "procedures_defreturn" && block.fields.NAME === "join_swedish_words"
        ),
        snap.statusMessage,
      );
      assert(
        (snap.model.functions ?? []).some((fn) => fn.name === "join_swedish_words"),
        `expected Mapping Model functions[] to include join_swedish, got ${
          JSON.stringify(snap.model.functions)
        }`,
      );
      const hatchHits = await page.getByText("escape hatch", { exact: false }).count();
      assertEquals(hatchHits, 0, "Function blocks must not show the old VMS hatch warning");

      const joinId = snap.blocklyBlocks.find((block) =>
        block.type === "procedures_defreturn" && block.fields.NAME === "join_swedish_words"
      )?.id;
      assert(joinId, "join_swedish block id");
      await page.evaluate((blockId) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        api.scrollBlockIntoView(blockId);
      }, joinId);
      const chrome = await page.evaluate((blockId) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return {
          block: api.getBlockClientRect(blockId),
          cog: api.getFieldClientRect(blockId, "MUTATOR_COG"),
        };
      }, joinId);
      assert(chrome.block && chrome.cog, "join_swedish has a header cogwheel");
      const fromLeft = (chrome.cog.x + chrome.cog.width / 2 - chrome.block.x) / chrome.block.width;
      assert(fromLeft > 0.55, `join_swedish cog should sit far right (ratio=${fromLeft.toFixed(3)})`);
    } finally {
      await browser.close();
    }
  },
});
