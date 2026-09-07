/**
 * Mapping Spec pane shows a compact projection. Download still saves
 * full Blockly workspace JSON (including x/y).
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
  name: "UI: Mapping Spec is a compact projection; Download is full Blockly JSON",
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

      const doc = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getMappingSpecDocument();
      });
      assertEquals(doc.trimStart().startsWith("{"), false, "Spec tab must not show raw Blockly JSON");
      assertEquals(doc.includes('"x":'), false);

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 10_000 }),
        downloadBtn.click(),
      ]);
      const filename = download.suggestedFilename();
      assert(filename.endsWith(".blockly.json"), filename);
      const downloadPath = await download.path();
      assert(downloadPath, "expected downloaded file path");
      const downloaded = await Deno.readTextFile(downloadPath);
      const downloadedJson = JSON.parse(downloaded) as {
        blocks?: { blocks?: Array<{ type?: string; x?: number; y?: number; id?: string }> };
      };
      const roots = downloadedJson.blocks?.blocks ?? [];
      assert(roots.length > 0, "expected Blockly root blocks in download");
      assert(typeof roots[0]?.x === "number", "download must keep block x");
      assert(typeof roots[0]?.y === "number", "download must keep block y");

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
      assertEquals(after.includes('"id": "uploaded-root"'), false);
      const snapshot = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getSnapshot();
      });
      assert(
        snapshot.blocklyBlocks.some((block) => block.id === "uploaded-root"),
        "upload must restore Blockly ids",
      );
      assertStringIncludes(after, snapshot.blocklyBlocks[0]?.type ?? "composition");

      await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        api.loadBlocklyJson("edit.blockly.json", JSON.stringify({
          blocks: {
            languageVersion: 0,
            blocks: [{
              type: "source_query",
              id: "sq-edit",
              x: 8,
              y: 8,
              fields: { EXPRESSION: "$.systolic", RETURN_TYPE: "number" },
            }],
          },
        }));
      });
      const pathInput = page.locator('.spec-widget-input[aria-label="Source path expression"]');
      await pathInput.waitFor({ timeout: 10_000 });
      await pathInput.fill("$.diastolic");
      await pathInput.blur();
      await page.waitForTimeout(200);
      const edited = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getSnapshot().blocklyBlocks.find((b) => b.id === "sq-edit")?.fields.EXPRESSION;
      });
      assertEquals(edited, "$.diastolic");
    } finally {
      await browser.close();
    }
  },
});
