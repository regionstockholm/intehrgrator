/**
 * Browser UI test: Click-to-Map in the Mapping Editor produces a sensible Test Run.
 *
 * Requires a built Web Shell on UI_TEST_BASE_URL (default http://127.0.0.1:5173)
 * with `?testMode=1`. Prefer `deno task test:ui` which builds, serves, and runs this.
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
} from "./helpers.ts";

Deno.test({
  name: "UI: click-to-map systolic → Test Run returns 120",
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

      // Real UI: arm Target value slot via slots rail (Listening Mode).
      const slotItem = page.locator(`.slot-item[data-slot-id="${slotId}"]`);
      await slotItem.waitFor({ timeout: 10_000 });
      await slotItem.click();

      const listening = (await getSnapshot(page)).listeningSlotId;
      assertEquals(listening, slotId);

      // Real UI: click Example Instance tree node for systolic.
      await page.click('#example-tree .tree-row[data-path="$.systolic"] .tree-label');
      await waitForMappedSlot(page, slotId);

      const afterMap = await getSnapshot(page);
      const mapped = afterMap.model.slots.find((s) => s.slotId === slotId);
      assert(mapped?.expression.includes("xpathNumber"), mapped?.expression);
      assert(mapped?.expression.includes("systolic"), mapped?.expression);
      assert(
        afterMap.blocklyBlocks.some((b) => b.type === "source_query"),
        `expected source_query block after Click-to-Map, got: ${
          afterMap.blocklyBlocks.map((b) => b.type).join(", ")
        }`,
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
