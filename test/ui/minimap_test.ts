/**
 * Browser UI test: minimap sits under the toolbox rail and mirrors scaffolded blocks.
 *
 * Requires a built web app on UI_TEST_BASE_URL (default http://127.0.0.1:5173)
 * with `?testMode=1`. Prefer `deno task test:ui`.
 */

import { assert, assertEquals } from "@std/assert";
import { chromium, type Page } from "npm:playwright@1.51.0";
import { baseUrl, loadBpFixtures, waitForTestApi } from "./helpers.ts";

type ToolboxRailLayout = {
  toolboxLeft: number;
  toolboxBottom: number;
  toolboxWidth: number;
  toolboxHeight: number;
  contentsHeight: number;
  contentsScrollOverflow: number;
  footHeight: number;
  miniLeft: number;
  miniBottom: number;
  miniWidth: number;
  miniHeight: number;
  inToolbox: boolean;
  inFoot: boolean;
  handleBetween: boolean;
  hitInMinimap: boolean;
  blockCount: number;
};

async function readToolboxRail(page: Page): Promise<ToolboxRailLayout> {
  const layout = await page.waitForFunction(() => {
    const mount = document.getElementById("blockly-mount");
    const toolbox = mount?.querySelector(".blocklyToolboxDiv");
    const contents = toolbox?.querySelector(":scope > .blocklyToolboxContents") as HTMLElement | null;
    const foot = toolbox?.querySelector(":scope > .blockly-toolbox-foot") as HTMLElement | null;
    const handle = toolbox?.querySelector(":scope > .split-handle") as HTMLElement | null;
    const mini = mount?.querySelector(".blockly-minimap") as HTMLElement | null;
    if (!mount || !toolbox || !contents || !foot || !handle || !mini) return null;
    if (getComputedStyle(mini).display === "none") return null;
    if (!foot.contains(mini)) return null;
    const tb = toolbox.getBoundingClientRect();
    const cb = contents.getBoundingClientRect();
    const fb = foot.getBoundingClientRect();
    const hb = handle.getBoundingClientRect();
    const mb = mini.getBoundingClientRect();
    if (mb.width < 24 || mb.height < 8) return null;
    const hit = document.elementFromPoint(mb.left + mb.width / 2, mb.top + mb.height / 2);
    const blockCount = mini.querySelectorAll(".blocklyBlockCanvas [data-id]").length;
    return {
      toolboxLeft: tb.left,
      toolboxBottom: tb.bottom,
      toolboxWidth: tb.width,
      toolboxHeight: tb.height,
      contentsHeight: cb.height,
      contentsScrollOverflow: contents.scrollHeight - contents.clientHeight,
      footHeight: fb.height,
      miniLeft: mb.left,
      miniBottom: mb.bottom,
      miniWidth: mb.width,
      miniHeight: mb.height,
      inToolbox: toolbox.contains(mini),
      inFoot: foot.contains(mini),
      handleBetween: hb.top >= cb.bottom - 2 && hb.bottom <= fb.top + 2,
      hitInMinimap: Boolean(hit && mini.contains(hit)),
      blockCount,
    };
  }, undefined, { timeout: 15_000 });
  return await layout.jsonValue() as ToolboxRailLayout;
}

Deno.test({
  name: "UI: minimap docks under the toolbox and shows scaffolded blocks",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 1400, height: 900 },
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);

      const box = await readToolboxRail(page);

      assert(box.inToolbox, `minimap should be inside the toolbox: ${JSON.stringify(box)}`);
      assert(box.inFoot, `minimap should sit in the toolbox foot: ${JSON.stringify(box)}`);
      assert(box.hitInMinimap, `minimap should be the topmost layer at its centre: ${JSON.stringify(box)}`);
      assert(box.miniWidth > 40, JSON.stringify(box));
      assert(box.miniHeight > 16, JSON.stringify(box));
      assert(
        Math.abs(box.miniLeft - box.toolboxLeft) < 8,
        `minimap should share the toolbox left edge: ${JSON.stringify(box)}`,
      );
      assert(
        Math.abs(box.miniBottom - box.toolboxBottom) < 16,
        `minimap should sit at the bottom of the toolbox: ${JSON.stringify(box)}`,
      );
      assert(
        Math.abs(box.miniWidth - box.toolboxWidth) < 12,
        `minimap should not spill past the toolbox width: ${JSON.stringify(box)}`,
      );
      assert(
        box.blockCount > 1,
        `minimap should show scaffolded blocks, not only later manual edits: ${JSON.stringify(box)}`,
      );
      assertEquals(typeof box.blockCount, "number");
      assert(
        box.contentsHeight > box.footHeight,
        `drawers should be taller than search+minimap: ${JSON.stringify(box)}`,
      );
      assert(
        box.contentsScrollOverflow <= 8,
        `drawers should show categories without scrolling: ${JSON.stringify(box)}`,
      );
    } finally {
      await browser.close();
    }
  },
});

Deno.test({
  name: "UI: toolbox drawers keep most of the rail and resize against search+minimap",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 1400, height: 640 },
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);

      const before = await readToolboxRail(page);
      assert(before.handleBetween, `split handle should sit between drawers and search: ${JSON.stringify(before)}`);
      assert(
        before.contentsHeight >= before.toolboxHeight * 0.55,
        `drawers should keep about two thirds of a tight toolbox: ${JSON.stringify(before)}`,
      );
      assert(
        before.contentsHeight > before.footHeight,
        `drawers should be taller than search+minimap: ${JSON.stringify(before)}`,
      );
      assert(before.miniHeight > 16, `minimap should still peek so users know it exists: ${JSON.stringify(before)}`);

      const handle = page.locator(".blocklyToolboxDiv > .split-handle");
      const handleBox = await handle.boundingBox();
      if (!handleBox) throw new Error("toolbox split handle has no box");
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        handleBox.x + handleBox.width / 2,
        handleBox.y + handleBox.height / 2 + 20,
        { steps: 8 },
      );
      await page.mouse.up();
      await page.waitForTimeout(200);

      const after = await readToolboxRail(page);
      assert(
        after.contentsHeight > before.contentsHeight + 8,
        `dragging the handle down should grow the drawers: before=${before.contentsHeight} after=${after.contentsHeight}`,
      );
      assert(after.miniHeight > 8, `minimap should remain visible after resize: ${JSON.stringify(after)}`);
    } finally {
      await browser.close();
    }
  },
});
