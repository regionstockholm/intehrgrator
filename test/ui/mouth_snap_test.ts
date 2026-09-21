/**
 * Browser UI: statement-mouth snap sits on the visual C bump after the caption
 * (issue #105; captions hug the C from issue #150).
 */
import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import type { IntehrgratorTestApi } from "../../src/ui_test/test_api.ts";
import { baseUrl, loadBpFixtures, waitForTestApi } from "./helpers.ts";

/** Blockly Align.RIGHT — statement captions hug the C. */
const ALIGN_RIGHT = 1;

type MouthMetrics = {
  offsetX: number;
  ownWidth: number;
  blockWidth: number;
  align?: number;
} | null;

/**
 * Statement captions hug the C (RIGHT). On a wide outline (COMPOSITION.content,
 * XML document) leftover still sits to the right of the C, so offsetX is far
 * from ownWidth. A tight mutator STACK row is just caption+C, so offsetX is
 * near ownWidth — still after the caption, not at x≈0 or the right tooth.
 */
function assertNotchOnLeftCBump(metrics: MouthMetrics, label: string): void {
  assert(metrics, `${label} metrics missing`);
  assert(
    metrics.ownWidth > 40,
    `${label} ownWidth=${metrics.ownWidth} is too small to judge`,
  );
  assertEquals(
    metrics.align,
    ALIGN_RIGHT,
    `${label} should be RIGHT-aligned so the caption hugs the C`,
  );
  assert(
    metrics.offsetX > 20,
    `${label} snap too far left (missing caption / statementEdge≈0): offsetX=${metrics.offsetX} ownWidth=${metrics.ownWidth}`,
  );
  if (metrics.ownWidth > 200) {
    assert(
      metrics.ownWidth - metrics.offsetX > 80,
      `${label} snap on the right tooth of a wide outline: offsetX=${metrics.offsetX} ownWidth=${metrics.ownWidth} blockWidth=${metrics.blockWidth}`,
    );
  }
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

      await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        api.scrollBlockIntoView(id);
        api.openMutator(id);
      }, ids.quantity);
      await page.waitForTimeout(400);
      await page.locator(".blocklyBubble").first().waitFor({ state: "visible", timeout: 10_000 });

      const stack = await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getMutatorStackMetrics(id);
      }, ids.quantity);

      assertEquals(xml?.canConnect, true, "xml_element must light up on XML document element");
      assertEquals(xml?.connected, true, "xml_element must attach to XML document element");
      assertNotchOnLeftCBump(content, "COMPOSITION.content");
      assertNotchOnLeftCBump(xml?.metrics ?? null, "XML document element");
      assertNotchOnLeftCBump(stack, "optional-fields STACK");

      await page.screenshot({
        path: "/opt/cursor/artifacts/mutator_optional_fields_stack_bump.png",
      });
    } finally {
      await browser.close();
    }
  },
});
