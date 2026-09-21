/**
 * Browser UI: mutator cogwheels sit on the far-right header, popups anchor
 * there, and Blockly's default top-left MutatorIcon is not the visible control.
 *
 * Requires a built Web Shell on UI_TEST_BASE_URL with `?testMode=1`.
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import type { IntehrgratorTestApi } from "../../src/ui_test/test_api.ts";
import { baseUrl, waitForTestApi } from "./helpers.ts";

const MUTATOR_TYPES = [
  "text_join",
  "lists_create_with",
  "maps_create_with",
  "default_context_map",
  "procedures_defreturn",
] as const;

Deno.test({
  name: "UI: mutator cogwheels sit far right and the popup anchors on the header cog",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);

      const ids = await page.evaluate((types) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        const created: Record<string, string> = {};
        for (const type of types) {
          const id = api.newBlock(type);
          if (id) created[type] = id;
        }
        return created;
      }, [...MUTATOR_TYPES]);

      for (const type of MUTATOR_TYPES) {
        const id = ids[type];
        assert(id, `expected a ${type} block`);
        await page.evaluate((blockId) => {
          const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
            .intehrgratorTestApi;
          api.scrollBlockIntoView(blockId);
        }, id);
        await page.waitForTimeout(80);
        const block = await page.evaluate((blockId) => {
          const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
            .intehrgratorTestApi;
          return {
            block: api.getBlockClientRect(blockId),
            cog: api.getFieldClientRect(blockId, "MUTATOR_COG"),
            glyph: api.getFieldClientRect(blockId, "RM_OUT_EMOJI"),
            fields: api.listBlockFields(blockId),
          };
        }, id);
        assert(block.block, `${type} has a rendered outline`);
        assert(block.cog, `${type} has a header cogwheel`);
        const blockRight = block.block.x + block.block.width;
        const cogCenter = block.cog.x + block.cog.width / 2;
        const fromLeft = (cogCenter - block.block.x) / block.block.width;
        assert(
          fromLeft > 0.55,
          `${type} cog should sit in the right half (ratio=${fromLeft.toFixed(3)}, ` +
            `block=${block.block.width.toFixed(1)} cogX=${block.cog.x.toFixed(1)})`,
        );
        assert(
          blockRight - (block.cog.x + block.cog.width) < 40,
          `${type} cog should hug the right edge (gap=${
            (blockRight - block.cog.x - block.cog.width).toFixed(1)
          })`,
        );
        if (block.glyph) {
          assert(
            block.glyph.x > block.cog.x,
            `${type} type glyph stays to the right of the cog ` +
              `(fields=${JSON.stringify(block.fields)} glyphX=${block.glyph.x.toFixed(1)} cogX=${block.cog.x.toFixed(1)})`,
          );
        }
      }

      const visibleMutatorIcons = await page.locator(
        ".blockly-mount .blocklyDraggable .blocklyIconGroup.blockly-icon-mutator",
      ).evaluateAll((nodes) =>
        nodes.filter((node) => getComputedStyle(node).display !== "none").length
      );
      assertEquals(visibleMutatorIcons, 0, "default top-left MutatorIcon stays hidden");

      const joinId = ids.text_join;
      await page.evaluate((blockId) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        api.scrollBlockIntoView(blockId);
        api.openMutator(blockId);
      }, joinId);
      await page.waitForTimeout(300);
      const bubble = page.locator(".blocklyMutatorBackground, .blocklyBubble").first();
      await bubble.waitFor({ state: "visible", timeout: 5_000 });
      const layout = await page.evaluate((blockId) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        const block = api.getBlockClientRect(blockId);
        const cog = api.getFieldClientRect(blockId, "MUTATOR_COG");
        const bubbleEl = document.querySelector(".blocklyMutatorBackground, .blocklyBubble");
        const bubbleBox = bubbleEl?.getBoundingClientRect();
        return { block, cog, bubble: bubbleBox ? { x: bubbleBox.left, y: bubbleBox.top, width: bubbleBox.width } : null };
      }, joinId);
      assert(layout.block && layout.cog && layout.bubble, "mutator popup is visible");
      const cogCenterX = layout.cog.x + layout.cog.width / 2;
      const bubbleCenterX = layout.bubble.x + layout.bubble.width / 2;
      const distCog = Math.abs(bubbleCenterX - cogCenterX);
      const distLeft = Math.abs(bubbleCenterX - layout.block.x);
      assert(
        distCog < distLeft,
        `popup should sit nearer the header cog than the block origin ` +
          `(cogDist=${distCog.toFixed(1)} leftDist=${distLeft.toFixed(1)})`,
      );
    } finally {
      await browser.close();
    }
  },
});
