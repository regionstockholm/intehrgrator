/**
 * Browser UI test: Click-to-Map in the Mapping Editor produces a sensible Test Run.
 *
 * Requires a built Web Shell on UI_TEST_BASE_URL (default http://127.0.0.1:5173)
 * with `?testMode=1`. Prefer `deno task test:ui` which builds, serves, and runs this.
 */

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
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
      const blockId = await findElementBlockId(page, slotId);
      await clickBlocklyBlock(page, blockId);

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
        afterMap.blocklyBlocks.some((b) => b.type === "source_query_number"),
        `expected source_query_number block after Click-to-Map, got: ${
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
      const output = snap.testResult?.output as Record<string, unknown> | undefined;
      assertEquals(snap.testResult?.ok, true, (snap.testResult?.warnings ?? []).join("; "));
      assert(output && !("slots" in output), `openEHR Test Run must not include a slots sidecar: ${JSON.stringify(output)}`);
      assertStringIncludes(JSON.stringify(output), "120");

      const outputText = await page.locator("#test-output .cm-content").textContent();
      assert(outputText && !outputText.includes("// Test Run output"), outputText ?? "");
      assert(outputText.includes("COMPOSITION") || outputText.includes("120"), outputText);
    } finally {
      await browser.close();
    }
  },
});
