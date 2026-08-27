/**
 * Browser UI test: Mapping Editor Undo reverses a Click-to-Map action.
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import {
  baseUrl,
  findSystolicSlotId,
  getSnapshot,
  loadBpFixtures,
  waitForMappedSlot,
  waitForTestApi,
  clickBlocklyBlock,
  findElementBlockId,
} from "./helpers.ts";

Deno.test({
  name: "UI: undo reverses Click-to-Map and redo restores it",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);

      const slotId = await findSystolicSlotId(page);
      const blockId = await findElementBlockId(page, slotId);
      await clickBlocklyBlock(page, blockId);
      await page.click('#example-tree .tree-row[data-path="$.systolic"] .tree-label');
      await waitForMappedSlot(page, slotId);

      const undoEnabled = await page.evaluate(() => {
        const btn = document.getElementById("btn-undo") as HTMLButtonElement | null;
        return Boolean(btn && !btn.disabled);
      });
      assert(undoEnabled, "Undo should enable after Click-to-Map");

      await page.click("#btn-undo");
      await page.waitForFunction((id) => {
        const api = (globalThis as unknown as {
          intehrgratorTestApi: { getSnapshot(): { model: { slots: Array<{ slotId: string; expression?: string }> } } };
        }).intehrgratorTestApi;
        const slot = api.getSnapshot().model.slots.find((s) => s.slotId === id);
        return !slot?.expression?.includes("systolic");
      }, slotId, { timeout: 10_000 });

      await page.click("#btn-redo");
      await waitForMappedSlot(page, slotId);
      const afterRedo = await getSnapshot(page);
      assertEquals(
        Boolean(afterRedo.model.slots.find((s) => s.slotId === slotId)?.expression.includes("systolic")),
        true,
      );
    } finally {
      await browser.close();
    }
  },
});
