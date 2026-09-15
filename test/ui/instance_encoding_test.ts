/**
 * Browser UI: COMPOSITION Instance encoding dropdown and Product stack next notch.
 */
import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import { baseUrl, getSnapshot, loadBpFixtures, waitForTestApi } from "./helpers.ts";

Deno.test({
  name: "UI: COMPOSITION root has Instance encoding and a next Product stack notch",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);
      await page.waitForFunction(() => {
        const api = (globalThis as unknown as {
          intehrgratorTestApi?: { getSnapshot: () => { blocklyBlocks: Array<{ type: string }> } };
        }).intehrgratorTestApi;
        return api?.getSnapshot().blocklyBlocks.some((block) => block.type === "composition") === true;
      }, undefined, { timeout: 20_000 });

      const snap = await getSnapshot(page);
      const composition = snap.blocklyBlocks.find((block) => block.type === "composition");
      assert(composition, "expected a COMPOSITION instance root on the canvas");
      assertEquals(composition.fields.INSTANCE_ENCODING, "canonical-json");
      assertEquals(composition.hasNext, true);
      assert(
        composition.previousCheck === "INSTANCE_ROOT" ||
          (Array.isArray(composition.previousCheck) &&
            composition.previousCheck.includes("INSTANCE_ROOT")),
        String(composition.previousCheck),
      );
      assertEquals(snap.model.instanceEncodings, ["canonical-json"]);
    } finally {
      await browser.close();
    }
  },
});
