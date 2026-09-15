/**
 * Browser UI: statement-mouth snap sits on the visual C bump (issue #105).
 */
import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import type { IntehrgratorTestApi } from "../../src/ui_test/test_api.ts";
import { baseUrl, loadBpFixtures, waitForTestApi } from "./helpers.ts";

function assertNotchOnRightTooth(
  metrics: { offsetX: number; ownWidth: number; blockWidth: number },
  label: string,
): void {
  assert(
    metrics.ownWidth > 40,
    `${label} ownWidth=${metrics.ownWidth} is too small to judge`,
  );
  assert(
    metrics.offsetX > metrics.ownWidth - 50,
    `${label} snap not on the right tooth: offsetX=${metrics.offsetX} ownWidth=${metrics.ownWidth} blockWidth=${metrics.blockWidth}`,
  );
}

Deno.test({
  name: "UI: mutator STACK, COMPOSITION content, and XML document element snap on the C bump",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);

      const ids = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        const blocks = api.getSnapshot().blocklyBlocks;
        return {
          composition: blocks.find((block) => block.type === "composition")?.id ?? null,
          quantity: blocks.find((block) => block.type === "dv_quantity")?.id ?? null,
        };
      });
      assert(ids.composition, "expected COMPOSITION");
      assert(ids.quantity, "expected DV_QUANTITY");

      const content = await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getStatementInputMetrics(id, "ATTR_content");
      }, ids.composition);
      assert(content, "COMPOSITION.content metrics");
      assertNotchOnRightTooth(content, "COMPOSITION.content");

      const xml = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        const docId = api.newBlock("xml_document");
        const elId = api.newBlock("xml_element");
        if (!docId || !elId) return null;
        return {
          canConnect: api.canConnectStatement(docId, "TARGET_root", elId),
          connected: api.connectStatement(docId, "TARGET_root", elId),
          metrics: api.getStatementInputMetrics(docId, "TARGET_root"),
        };
      });
      assert(xml, "xml_document + xml_element");
      assertEquals(xml.canConnect, true, "xml_element must light up on XML document element");
      assertEquals(xml.connected, true, "xml_element must attach to XML document element");
      assert(xml.metrics, "XML document TARGET_root metrics");
      assertNotchOnRightTooth(xml.metrics, "XML document element");

      await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        api.scrollBlockIntoView(id);
        api.openMutator(id);
      }, ids.quantity);
      await page.waitForTimeout(400);

      const stack = await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getMutatorStackMetrics(id);
      }, ids.quantity);
      assert(stack, "optional-fields STACK metrics");
      assertEquals(stack.align, 1, "STACK should be RIGHT-aligned");
      assertNotchOnRightTooth(stack, "optional-fields STACK");

      await page.locator(".blocklyBubble").first().waitFor({ state: "visible", timeout: 10_000 });
      await page.screenshot({
        path: "/opt/cursor/artifacts/mutator_optional_fields_stack_bump.png",
      });
    } finally {
      await browser.close();
    }
  },
});
