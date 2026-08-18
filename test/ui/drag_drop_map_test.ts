/**
 * Browser UI test: drag-and-drop mapping (source tree → Target value slot)
 * skips Listening Mode and produces a sensible Test Run.
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import {
  baseUrl,
  findSystolicSlotId,
  getSnapshot,
  html5DragDrop,
  loadBpFixtures,
  waitForMappedSlot,
  waitForTestApi,
} from "./helpers.ts";

Deno.test({
  name: "UI: drag-and-drop systolic onto Target value slot → Test Run returns 120",
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
      const slotSelector = `.slot-item[data-slot-id="${slotId}"]`;
      await page.waitForSelector(slotSelector, { timeout: 10_000 });

      // Must not require Listening Mode for drag-and-drop.
      assertEquals((await getSnapshot(page)).listeningSlotId, null);

      await html5DragDrop(
        page,
        '#example-tree .tree-row[data-path="$.systolic"] .tree-label',
        slotSelector,
      );
      await waitForMappedSlot(page, slotId);

      const afterMap = await getSnapshot(page);
      assertEquals(afterMap.listeningSlotId, null, "drag-and-drop should not leave Listening Mode armed");
      const mapped = afterMap.model.slots.find((s) => s.slotId === slotId);
      assert(mapped?.expression.includes("xpathNumber"), mapped?.expression);
      assert(mapped?.expression.includes("systolic"), mapped?.expression);
      assert(
        afterMap.blocklyBlocks.some((b) => b.type === "source_query_number"),
        `expected source_query_number block after drag-and-drop, got: ${
          afterMap.blocklyBlocks.map((b) => b.type).join(", ")
        }`,
      );
      assert(
        afterMap.statusMessage.toLowerCase().includes("mapped"),
        afterMap.statusMessage,
      );

      await page.click("#btn-run-test");
      await page.waitForFunction(() => {
        const api = (globalThis as unknown as {
          intehrgratorTestApi: { getSnapshot: () => { testResult: unknown } };
        }).intehrgratorTestApi;
        return api.getSnapshot().testResult != null;
      }, { timeout: 10_000 });

      const snap = await getSnapshot(page);
      const composition = snap.testResult?.composition as {
        slots?: Record<string, unknown>;
      } | undefined;
      assertEquals(composition?.slots?.[slotId], 120, JSON.stringify(snap.testResult));
      assertEquals(snap.testResult?.ok, true, (snap.testResult?.warnings ?? []).join("; "));

      const outputText = await page.locator("#test-output").innerText();
      assert(outputText.includes("120"), outputText);
    } finally {
      await browser.close();
    }
  },
});
