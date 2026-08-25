/**
 * Browser UI test: drag-and-drop mapping (source tree → Target value slot)
 * skips Listening Mode and produces a sensible Test Run.
 */

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import {
  baseUrl,
  findSystolicSlotId,
  getSnapshot,
  html5DragDropToPoint,
  loadBpFixtures,
  visibleBlockDropPoint,
  waitForMappedSlot,
  waitForTestApi,
  findElementBlockId,
} from "./helpers.ts";
import type { IntehrgratorTestApi } from "../../src/ui_test/test_api.ts";

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
      const blockId = await findElementBlockId(page, slotId);
      const geometry = await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        api.scrollBlockIntoView(id);
        const rect = api.getBlockClientRect(id);
        const mountEl = document.getElementById("blockly-mount");
        if (!rect || !mountEl) return null;
        const mount = mountEl.getBoundingClientRect();
        return {
          rect,
          mount: { left: mount.left, top: mount.top, right: mount.right, bottom: mount.bottom },
        };
      }, blockId);
      assert(geometry, "expected Blockly element block SVG");
      const drop = visibleBlockDropPoint(geometry.rect, geometry.mount);
      assert(drop, "expected Blockly element block SVG inside #blockly-mount");

      // Must not require Listening Mode for drag-and-drop.
      assertEquals((await getSnapshot(page)).listeningSlotId, null);

      await html5DragDropToPoint(
        page,
        '#example-tree .tree-row[data-path="$.systolic"] .tree-label',
        drop.x,
        drop.y,
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
