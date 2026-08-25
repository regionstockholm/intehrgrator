/**
 * Browser UI test: minimap sits under the toolbox rail and mirrors scaffolded blocks.
 *
 * Requires a built Web Shell on UI_TEST_BASE_URL (default http://127.0.0.1:5173)
 * with `?testMode=1`. Prefer `deno task test:ui`.
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import { baseUrl, loadBpFixtures, waitForTestApi } from "./helpers.ts";

Deno.test({
  name: "UI: minimap docks under the toolbox and shows scaffolded blocks",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);

      const layout = await page.waitForFunction(() => {
        const mount = document.getElementById("blockly-mount");
        const toolbox = mount?.querySelector(".blocklyToolboxDiv");
        const mini = mount?.querySelector(".blockly-minimap") as HTMLElement | null;
        if (!mount || !toolbox || !mini) return null;
        if (mount.classList.contains("blockly-minimap-hidden")) return null;
        if (getComputedStyle(mini).display === "none") return null;
        const tb = toolbox.getBoundingClientRect();
        const mb = mini.getBoundingClientRect();
        const blockCount = mini.querySelectorAll(".blocklyBlockCanvas [data-id]").length;
        return {
          toolboxLeft: tb.left,
          toolboxBottom: tb.bottom,
          toolboxWidth: tb.width,
          miniLeft: mb.left,
          miniBottom: mb.bottom,
          miniWidth: mb.width,
          miniHeight: mb.height,
          blockCount,
        };
      }, { timeout: 15_000 });

      const box = await layout.jsonValue() as {
        toolboxLeft: number;
        toolboxBottom: number;
        toolboxWidth: number;
        miniLeft: number;
        miniBottom: number;
        miniWidth: number;
        miniHeight: number;
        blockCount: number;
      };

      assert(box.miniWidth > 40, JSON.stringify(box));
      assert(box.miniHeight > 40, JSON.stringify(box));
      assert(
        Math.abs(box.miniLeft - box.toolboxLeft) < 8,
        `minimap should share the toolbox left edge: ${JSON.stringify(box)}`,
      );
      assert(
        Math.abs(box.miniBottom - box.toolboxBottom) < 8,
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
    } finally {
      await browser.close();
    }
  },
});
