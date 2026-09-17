/**
 * UI green-path: major Mapping Editor process steps and several block categories.
 * Keep this covering load → Click-to-Map → RM / Defaults → Test Run → Generated Export
 * (docs/TESTING.md). Prefer `deno task test:ui`.
 */

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import type { IntehrgratorTestApi } from "../../src/ui_test/test_api.ts";
import {
  baseUrl,
  clickBlocklyBlock,
  clickExamplePath,
  diastolicSuffix,
  findElementBlockId,
  findSlotIdEndingWith,
  findSystolicSlotId,
  getSnapshot,
  loadBpFixtures,
  runTestAndWait,
  waitForMappedSlot,
  waitForTestApi,
} from "./helpers.ts";

Deno.test({
  name: "UI green-path: load, Click-to-Map source queries, RM extras, Test Run, Generated Export",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);

      await page.waitForFunction(() => {
        const api = (globalThis as unknown as {
          intehrgratorTestApi?: { getSnapshot: () => { blocklyBlocks: Array<{ type: string }> } };
        }).intehrgratorTestApi;
        return api?.getSnapshot().blocklyBlocks.some((block) => block.type === "composition") === true;
      }, undefined, { timeout: 20_000 });

      const loaded = await getSnapshot(page);
      assertEquals(loaded.exampleCount, 1);
      assert(
        loaded.blocklyBlocks.some((block) => block.type === "composition"),
        "expected RM COMPOSITION instance root after loading the target",
      );
      assert(
        loaded.blocklyBlocks.some((block) => block.type.startsWith("maps_create")),
        `expected Defaults Map (maps_create*) on the canvas, got: ${
          loaded.blocklyBlocks.map((block) => block.type).join(", ")
        }`,
      );
      const composition = loaded.blocklyBlocks.find((block) => block.type === "composition");
      assertEquals(composition?.fields.INSTANCE_ENCODING, "canonical-json");

      // Loops & Logic drawer: for_each_list is the lead block; place one on the canvas.
      const logicCategory = page.locator(".blocklyToolboxCategoryLogic");
      await logicCategory.waitFor({ timeout: 10_000 });
      await logicCategory.click();
      await page.locator(".blocklyFlyout").first().waitFor({ state: "visible", timeout: 8_000 });
      const loopId = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.newBlock("for_each_list");
      });
      assert(loopId, "expected to create a for_each_list block");
      assert(
        (await getSnapshot(page)).blocklyBlocks.some((block) => block.type === "for_each_list"),
        "expected for_each_list on the canvas",
      );
      await logicCategory.click();

      const systolicId = await findSystolicSlotId(page);
      await clickBlocklyBlock(page, await findElementBlockId(page, systolicId));
      assertEquals((await getSnapshot(page)).listeningSlotId, systolicId);
      await clickExamplePath(page, "$.systolic");
      await waitForMappedSlot(page, systolicId, "systolic");

      const diastolicId = await findSlotIdEndingWith(page, diastolicSuffix);
      await clickBlocklyBlock(page, await findElementBlockId(page, diastolicId));
      await clickExamplePath(page, "$.diastolic");
      await waitForMappedSlot(page, diastolicId, "diastolic");

      const afterMap = await getSnapshot(page);
      assert(
        afterMap.blocklyBlocks.some((block) => block.type === "source_query_number"),
        `expected source_query_number after Click-to-Map, got: ${
          afterMap.blocklyBlocks.map((block) => block.type).join(", ")
        }`,
      );

      const compositionId = afterMap.blocklyBlocks.find((block) => block.type === "composition")
        ?.id;
      assert(compositionId, "COMPOSITION id");
      await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        api.setOptionalRmExtras(id, ["feeder_audit"]);
      }, compositionId);
      await page.waitForFunction(() => {
        const api = (globalThis as unknown as {
          intehrgratorTestApi: { getSnapshot: () => { blocklyBlocks: Array<{ type: string }> } };
        }).intehrgratorTestApi;
        return api.getSnapshot().blocklyBlocks.some((block) => block.type === "feeder_audit");
      }, undefined, { timeout: 5_000 });

      await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        api.setBlockField(id, "INSTANCE_ENCODING", "canonical-xml");
      }, compositionId);
      const encoded = await getSnapshot(page);
      assertEquals(
        encoded.blocklyBlocks.find((block) => block.id === compositionId)?.fields.INSTANCE_ENCODING,
        "canonical-xml",
      );
      await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        api.setBlockField(id, "INSTANCE_ENCODING", "canonical-json");
      }, compositionId);

      await runTestAndWait(page);
      const tested = await getSnapshot(page);
      const output = tested.testResult?.output as Record<string, unknown> | undefined;
      assertEquals(tested.testResult?.ok, true, (tested.testResult?.warnings ?? []).join("; "));
      assert(
        output && !("slots" in output),
        `openEHR Test Run must not include a slots sidecar: ${JSON.stringify(output)}`,
      );
      const asText = JSON.stringify(output);
      assertStringIncludes(asText, "120");
      assertStringIncludes(asText, "80");

      await page.selectOption("#export-target", "typescript");
      await page.waitForFunction(() => {
        const api = (globalThis as unknown as {
          intehrgratorTestApi: { getSnapshot: () => { generatedCode: string } };
        }).intehrgratorTestApi;
        return api.getSnapshot().generatedCode.includes("$.systolic");
      }, undefined, { timeout: 10_000 });
      const ts = (await getSnapshot(page)).generatedCode;
      assertStringIncludes(ts, "xpathNumber");
      assertStringIncludes(ts, "$.diastolic");
      assertStringIncludes(ts, "new COMPOSITION({");

      await page.selectOption("#export-target", "xquery");
      await page.waitForFunction(() => {
        const api = (globalThis as unknown as {
          intehrgratorTestApi: { getSnapshot: () => { generatedCode: string } };
        }).intehrgratorTestApi;
        const code = api.getSnapshot().generatedCode;
        return code.includes("xquery") || code.includes("declare variable");
      }, undefined, { timeout: 10_000 });
      const xq = (await getSnapshot(page)).generatedCode;
      assertStringIncludes(xq, "declare variable $source");
      assertStringIncludes(xq, "systolic");
    } finally {
      await browser.close();
    }
  },
});
