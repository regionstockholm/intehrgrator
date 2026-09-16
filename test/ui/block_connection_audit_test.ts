/**
 * Browser UI: connection audit via intehrgratorTestApi (same checks as MCP verify_block_connections).
 */
import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import type { IntehrgratorTestApi } from "../../src/ui_test/test_api.ts";
import { baseUrl, loadBpFixtures, waitForTestApi } from "./helpers.ts";

Deno.test({
  name: "UI: connection audit passes on blood pressure scaffold and survives save/reload",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);

      const audit = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return {
          live: api.runConnectionAudit({ includeMatrix: true, includeRoundTrip: false }),
          roundTrip: api.verifyConnectionRoundTrip(),
        };
      });

      assertEquals(audit.live.ok, true, audit.live.summary);
      assertEquals(audit.roundTrip.ok, true, audit.roundTrip.summary);
      assert(audit.live.failures.length === 0);
      assert(audit.roundTrip.failures.length === 0);

      await page.screenshot({
        path: "/opt/cursor/artifacts/block_connection_audit_ui.png",
      });
    } finally {
      await browser.close();
    }
  },
});
