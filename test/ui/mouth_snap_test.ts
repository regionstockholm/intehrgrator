/**
 * Browser UI: every value/statement mouth snaps on the visual right tooth (issue #105).
 * Yellow highlight uses connection offsetX/Y — if those sit in the leftover left
 * column, users never see the C bump light up.
 */
import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import type { IntehrgratorTestApi } from "../../src/ui_test/test_api.ts";
import { baseUrl, loadBpFixtures, waitForTestApi } from "./helpers.ts";

const AlignRight = 1;

function assertNotchOnRightTooth(
  metrics: { offsetX: number; ownWidth: number; blockWidth: number } | null,
  label: string,
): void {
  assert(metrics, `${label} metrics missing`);
  assert(
    metrics.ownWidth > 40,
    `${label} ownWidth=${metrics.ownWidth} is too small to judge`,
  );
  assert(
    metrics.offsetX > metrics.ownWidth - 50,
    `${label} snap not on the right tooth: offsetX=${metrics.offsetX} ownWidth=${metrics.ownWidth} blockWidth=${metrics.blockWidth}`,
  );
}

function mouthPlacementError(
  row: {
    blockType: string;
    inputName: string;
    kind: string;
    offsetX: number;
    offsetY: number;
    ownWidth: number;
    ownHeight: number;
    align: number;
  },
): string | null {
  const label = `${row.blockType}.${row.inputName} (${row.kind})`;
  if (row.ownWidth < 40) return null;
  if (row.align !== AlignRight) return `${label} should be RIGHT-aligned (align=${row.align})`;
  // Statement C and packed value sockets sit on the right tooth. Leftover
  // left-column placement (issue #105) is typically offsetX < 40.
  if (row.offsetX <= row.ownWidth - 50) {
    return `${label} snap X not on the right tooth: offsetX=${row.offsetX} ownWidth=${row.ownWidth}`;
  }
  if (row.offsetY < 0) return `${label} snap Y is negative: ${row.offsetY}`;
  if (row.offsetY >= row.ownHeight + 24) {
    return `${label} snap Y is below the block outline: offsetY=${row.offsetY} ownHeight=${row.ownHeight}`;
  }
  return null;
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
      assertNotchOnRightTooth(content, "COMPOSITION.content");
      assertNotchOnRightTooth(xml?.metrics ?? null, "XML document element");
      assertEquals(stack?.align, 1, "STACK should be RIGHT-aligned");
      assertNotchOnRightTooth(stack, "optional-fields STACK");
    } finally {
      await browser.close();
    }
  },
});

Deno.test({
  name: "UI: every RM/XML/JSON mouth snap point sits on the right tooth",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);

      const mouths = await page.evaluate(() => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        return api.listMouthMetrics(["*"]);
      });

      assert(mouths.length > 40, `expected many mouths, got ${mouths.length}`);
      const statements = mouths.filter((m) => m.kind === "statement");
      const values = mouths.filter((m) => m.kind === "value");
      assert(statements.length > 0, "expected statement mouths");
      assert(values.length > 0, "expected value mouths");
      const bad = mouths.map(mouthPlacementError).filter((msg): msg is string => Boolean(msg));
      assertEquals(bad, [], bad.slice(0, 30).join("\n"));

      await Deno.mkdir("/opt/cursor/artifacts", { recursive: true });
      await Deno.writeTextFile(
        "/opt/cursor/artifacts/mouth_snap_metrics.json",
        JSON.stringify(
          {
            count: mouths.length,
            statements: statements.length,
            values: values.length,
            sample: mouths.slice(0, 80).map((m) => ({
              blockType: m.blockType,
              inputName: m.inputName,
              kind: m.kind,
              offsetX: m.offsetX,
              offsetY: m.offsetY,
              ownWidth: m.ownWidth,
              ownHeight: m.ownHeight,
            })),
          },
          null,
          2,
        ),
      );
      await page.screenshot({
        path: "/opt/cursor/artifacts/block_mouth_snap_positions.png",
        fullPage: true,
      });
    } finally {
      await browser.close();
    }
  },
});
