/**
 * Browser UI: statement-mouth snap sits on the visual C bump (issue #105).
 */
import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import type { IntehrgratorTestApi } from "../../src/ui_test/test_api.ts";
import { baseUrl, loadBpFixtures, waitForTestApi } from "./helpers.ts";

Deno.test({
  name: "UI: mutator STACK and COMPOSITION content snap on the visual C bump",
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
      assert(
        content.offsetX > 40,
        `COMPOSITION.content snap missing: offsetX=${content.offsetX} width=${content.blockWidth}`,
      );

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
      assert(
        stack.offsetX > stack.blockWidth * 0.45,
        `optional-fields STACK snap too far left: offsetX=${stack.offsetX} width=${stack.blockWidth}`,
      );

      await page.locator(".blocklyBubble").first().waitFor({ state: "visible", timeout: 10_000 });
      await page.screenshot({
        path: "/opt/cursor/artifacts/mutator_optional_fields_stack_bump.png",
      });
    } finally {
      await browser.close();
    }
  },
});
