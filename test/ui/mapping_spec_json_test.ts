/**
 * Mapping Spec pane stores full Blockly workspace JSON in CodeMirror
 * and Download saves that same JSON (including x/y).
 */

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import {
  baseUrl,
  loadBpFixtures,
  waitForTestApi,
} from "./helpers.ts";
import type { IntehrgratorTestApi } from "../../src/ui_test/test_api.ts";

Deno.test({
  name: "UI: Mapping Spec document and Download are full Blockly JSON",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);
      await page.waitForTimeout(500);

      const downloadBtn = page.locator("#btn-download-spec");
      const uploadBtn = page.locator("#btn-upload-spec");
      await downloadBtn.waitFor({ timeout: 10_000 });
      assertEquals(await downloadBtn.isVisible(), true);
      assertEquals(await uploadBtn.isVisible(), true);
      assertEquals(await downloadBtn.textContent().then((t) => t?.includes("Download")), true);
      assertEquals(await uploadBtn.textContent().then((t) => t?.includes("Upload")), true);

      const doc = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getMappingSpecDocument();
      });
      const parsed = JSON.parse(doc) as {
        blocks?: { blocks?: Array<{ type?: string; x?: number; y?: number; fields?: Record<string, unknown> }> };
      };
      const roots = parsed.blocks?.blocks ?? [];
      assert(roots.length > 0, "expected Blockly root blocks in Mapping Spec document");
      assert(typeof roots[0]?.x === "number", "document must keep block x");
      assert(typeof roots[0]?.y === "number", "document must keep block y");
      assertStringIncludes(doc, '"type":');

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 10_000 }),
        downloadBtn.click(),
      ]);
      const filename = download.suggestedFilename();
      assert(filename.endsWith(".blockly.json"), filename);
      const downloadPath = await download.path();
      assert(downloadPath, "expected downloaded file path");
      const downloaded = await Deno.readTextFile(downloadPath);
      const downloadedJson = JSON.parse(downloaded) as typeof parsed;
      assertEquals(
        downloadedJson.blocks?.blocks?.[0]?.type,
        parsed.blocks?.blocks?.[0]?.type,
      );
      assertEquals(downloadedJson.blocks?.blocks?.[0]?.x, parsed.blocks?.blocks?.[0]?.x);

      const tweaked = JSON.parse(downloaded) as {
        blocks: { languageVersion?: number; blocks: Array<Record<string, unknown>> };
      };
      tweaked.blocks.blocks[0]!.id = "uploaded-root";
      tweaked.blocks.blocks[0]!.x = 99;
      await page.evaluate((text) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        api.loadBlocklyJson("roundtrip.blockly.json", text);
      }, JSON.stringify(tweaked));
      await page.waitForTimeout(400);

      const after = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getMappingSpecDocument();
      });
      assertStringIncludes(after, '"id": "uploaded-root"');
      assertStringIncludes(after, '"x": 99');
    } finally {
      await browser.close();
    }
  },
});
