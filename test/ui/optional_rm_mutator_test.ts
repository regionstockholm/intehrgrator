/**
 * Browser UI: optional RM cogwheel mutator (no encircled + popup).
 *
 * Requires a built Web Shell on UI_TEST_BASE_URL with `?testMode=1`.
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import type { IntehrgratorTestApi } from "../../src/ui_test/test_api.ts";
import {
  baseUrl,
  loadBpFixtures,
  waitForTestApi,
} from "./helpers.ts";

Deno.test({
  name: "UI: COMPOSITION cogwheel mutator adds feeder_audit without a PLUS input",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);

      const compositionId = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getSnapshot().blocklyBlocks.find((block) => block.type === "composition")
          ?.id ?? null;
      });
      assert(compositionId, "expected a COMPOSITION block after loading the BP template");

      const inputsBefore = await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.listBlockInputs(id);
      }, compositionId);
      assertEquals(inputsBefore.includes("PLUS"), false);
      assertEquals(inputsBefore.some((name) => name.startsWith("OPT_")), false);

      const iconCount = await page.locator(".blocklyIconGroup").count();
      assert(iconCount > 0, "expected Blockly mutator cogwheel icon(s) on the canvas");

      await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        api.scrollBlockIntoView(id);
        api.openMutator(id);
      }, compositionId);
      await page.waitForTimeout(250);
      const bubbleCount = await page.locator(".blocklyMutatorBackground, .blocklyBubble").count();
      assert(bubbleCount > 0, "expected the mutator bubble after opening the cogwheel");

      await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        api.setOptionalRmExtras(id, ["feeder_audit"]);
      }, compositionId);
      await page.waitForTimeout(200);

      const afterAdd = await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return {
          inputs: api.listBlockInputs(id),
          optionalRm: api.getSnapshot().model.optionalRm,
          types: api.getSnapshot().blocklyBlocks.map((block) => block.type),
        };
      }, compositionId);
      assert(
        afterAdd.inputs.includes("OPT_feeder_audit"),
        `expected OPT_feeder_audit, inputs=${afterAdd.inputs.join(",")}`,
      );
      assert(
        afterAdd.optionalRm.some((row) => row.attributeName === "feeder_audit"),
        "expected Mapping Model optionalRm to record feeder_audit",
      );
      assert(
        afterAdd.types.includes("feeder_audit"),
        "expected auto-attached feeder_audit child on the canvas",
      );

      await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        api.setOptionalRmExtras(id, []);
      }, compositionId);
      await page.waitForTimeout(200);

      const afterRemove = await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return {
          inputs: api.listBlockInputs(id),
          optionalRm: api.getSnapshot().model.optionalRm,
          types: api.getSnapshot().blocklyBlocks.map((block) => block.type),
        };
      }, compositionId);
      assertEquals(afterRemove.inputs.includes("OPT_feeder_audit"), false);
      assertEquals(
        afterRemove.optionalRm.some((row) => row.attributeName === "feeder_audit"),
        false,
      );
      assert(
        afterRemove.types.includes("feeder_audit"),
        "removed extra should orphan the child, not delete it",
      );
    } finally {
      await browser.close();
    }
  },
});
