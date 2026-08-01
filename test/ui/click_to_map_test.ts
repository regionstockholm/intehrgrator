/**
 * Browser UI test: Click-to-Map in the Mapping Editor produces a sensible Test Run.
 *
 * Requires a built Web Shell on UI_TEST_BASE_URL (default http://127.0.0.1:5173)
 * with `?testMode=1`. Prefer `deno task test:ui` which builds, serves, and runs this.
 */

import { assert, assertEquals } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import { chromium, type Page } from "npm:playwright@1.51.0";
import type { IntehrgratorTestApi } from "../../src/ui_test/test_api.ts";

const root = join(dirname(fromFileUrl(import.meta.url)), "../..");
const baseUrl = Deno.env.get("UI_TEST_BASE_URL") ?? "http://127.0.0.1:5173";
const systolicSuffix = "items/at0004/value/value/value";

async function fixtureText(rel: string): Promise<string> {
  return await Deno.readTextFile(join(root, rel));
}

async function waitForTestApi(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const api = (globalThis as unknown as { intehrgratorTestApi?: IntehrgratorTestApi })
      .intehrgratorTestApi;
    return Boolean(api);
  }, { timeout: 30_000 });
  await page.evaluate(async () => {
    await (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
      .intehrgratorTestApi.ready();
  });
}

Deno.test({
  name: "UI: click-to-map systolic → Test Run returns 120",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const opt = await fixtureText("test/fixtures/blood_pressure.opt");
    const schema = await fixtureText("test/fixtures/ui/bp_source_schema.json");
    const example = await fixtureText("test/fixtures/ui/bp_example.json");

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);

      await page.evaluate(
        ({ opt, schema, example }) => {
          const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
            .intehrgratorTestApi;
          api.loadTemplate("blood_pressure.opt", opt);
          api.loadSchema("bp_source_schema.json", schema);
          api.addExample("bp_example.json", example);
        },
        { opt, schema, example },
      );

      // Let render sync Blockly Template Skeleton + trees.
      await page.waitForTimeout(300);

      const slotId = await page.evaluate((suffix) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.findSlotIdBySuffix(suffix);
      }, systolicSuffix);
      assert(slotId, `expected systolic slot ending with ${systolicSuffix}`);

      // Real UI: arm Target value slot via slots rail (Listening Mode).
      const slotItem = page.locator(`.slot-item[data-slot-id="${slotId}"]`);
      await slotItem.waitFor({ timeout: 10_000 });
      await slotItem.click();

      const listening = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getSnapshot().listeningSlotId;
      });
      assertEquals(listening, slotId);

      // Real UI: click Example Instance tree node for systolic.
      await page.click('#example-tree .tree-row[data-path="$.systolic"] .tree-label');

      // Blockly + Mapping Model should now hold the Mapping Expression.
      await page.waitForFunction((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        const snap = api.getSnapshot();
        const slot = snap.model.slots.find((s) => s.slotId === id);
        return Boolean(slot?.expression?.includes("systolic"));
      }, slotId, { timeout: 10_000 });

      const afterMap = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getSnapshot();
      });
      const mapped = afterMap.model.slots.find((s) => s.slotId === slotId);
      assert(mapped?.expression.includes("xpathNumber"), mapped?.expression);
      assert(mapped?.expression.includes("systolic"), mapped?.expression);
      assert(
        afterMap.blocklyBlocks.some((b) => b.type === "source_query"),
        `expected source_query block after Click-to-Map, got: ${
          afterMap.blocklyBlocks.map((b) => b.type).join(", ")
        }`,
      );

      // Real UI: Run Test in Output Previews.
      await page.click("#btn-run-test");
      await page.waitForFunction(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.getSnapshot().testResult != null;
      }, { timeout: 10_000 });

      const result = await page.evaluate((id) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        const snap = api.getSnapshot();
        const composition = snap.testResult?.composition as {
          slots?: Record<string, unknown>;
        } | undefined;
        return {
          ok: snap.testResult?.ok,
          value: composition?.slots?.[id],
          warnings: snap.testResult?.warnings ?? [],
        };
      }, slotId);

      assertEquals(result.value, 120, `Test Run slots: ${JSON.stringify(result)}`);
      assertEquals(result.ok, true, `warnings: ${result.warnings.join("; ")}`);

      // Output Previews pane should show the evaluated value in the editor host.
      const outputText = await page.locator("#test-output").innerText();
      assert(outputText.includes("120"), outputText);
    } finally {
      await browser.close();
    }
  },
});
