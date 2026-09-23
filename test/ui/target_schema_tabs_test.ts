/**
 * UI: tabbed Target & Previews, slide-away panes, pull Target schema onto canvas.
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import {
  baseUrl,
  getSnapshot,
  html5DragDrop,
  loadBpFixtures,
  showOutputTab,
  waitForTestApi,
} from "./helpers.ts";

Deno.test({
  name: "UI: Target & Previews has three tabs and a Target schema tree after load",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);

      await page.locator("#tab-target-schema").waitFor({ timeout: 10_000 });
      await page.locator("#tab-generated-script").waitFor({ timeout: 5_000 });
      await page.locator("#tab-test-run").waitFor({ timeout: 5_000 });
      await showOutputTab(page, "target-schema");
      await page.locator("#btn-run-test").waitFor({ state: "hidden", timeout: 5_000 });
      await page.waitForSelector(
        '#target-schema-tree .tree-row[data-path*="at0004"] .tree-label',
        { timeout: 10_000 },
      );
      const treeText = await page.locator("#target-schema-tree").innerText();
      assert(
        treeText.includes("COMPOSITION") || treeText.toLowerCase().includes("composition"),
        treeText.slice(0, 400),
      );
      await page.locator("#btn-open-template").waitFor({ state: "visible" });
    } finally {
      await browser.close();
    }
  },
});

Deno.test({
  name: "UI: slide Source and Target & Previews away, then restore",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);

      const corners = await page.evaluate(() => {
        const place = (paneId: string, buttonId: string) => {
          const pane = document.getElementById(paneId);
          const btn = document.getElementById(buttonId);
          if (!pane || !btn) return null;
          const paneBox = pane.getBoundingClientRect();
          const btnBox = btn.getBoundingClientRect();
          return {
            fromTop: btnBox.top - paneBox.top,
            fromLeft: btnBox.left - paneBox.left,
            fromRight: paneBox.right - btnBox.right,
            paneWidth: paneBox.width,
          };
        };
        return {
          source: place("source-pane", "btn-slide-source"),
          output: place("output-pane", "btn-slide-output"),
        };
      });
      assert(corners.source && corners.output, "slide toggles should be in the edge panes");
      assert(
        corners.source.fromTop < 20 && corners.source.fromLeft < 20,
        `source toggle should sit in the upper-left corner, got ${JSON.stringify(corners.source)}`,
      );
      assert(
        corners.output.fromTop < 20 && corners.output.fromRight < 20,
        `target toggle should sit in the upper-right corner, got ${JSON.stringify(corners.output)}`,
      );
      assertEquals(await page.locator("#btn-slide-source svg").count(), 1);
      assertEquals(await page.locator("#btn-slide-output svg").count(), 1);

      await page.click("#btn-slide-source");
      await page.waitForSelector("#source-pane.pane--slid-away", { timeout: 5_000 });
      const railTop = await page.evaluate(() => {
        const pane = document.getElementById("source-pane");
        const btn = document.querySelector("#rail-source button");
        if (!pane || !btn) return null;
        const paneBox = pane.getBoundingClientRect();
        const btnBox = btn.getBoundingClientRect();
        return { paneTop: paneBox.top, btnTop: btnBox.top, paneHeight: paneBox.height };
      });
      assert(railTop, "expected source rail button metrics");
      assert(
        railTop.btnTop - railTop.paneTop < railTop.paneHeight * 0.25,
        `source rail button should sit near the top, got ${JSON.stringify(railTop)}`,
      );
      await page.click("#rail-source");
      await page.waitForFunction(() =>
        !document.getElementById("source-pane")?.classList.contains("pane--slid-away")
      , { timeout: 5_000 });

      await page.click("#btn-slide-output");
      await page.waitForSelector("#output-pane.pane--slid-away", { timeout: 5_000 });
      await page.click('#rail-output [data-output-tab="test"]');
      await page.waitForFunction(() =>
        !document.getElementById("output-pane")?.classList.contains("pane--slid-away")
      , { timeout: 5_000 });
      await page.locator("#btn-run-test").waitFor({ state: "visible", timeout: 5_000 });
    } finally {
      await browser.close();
    }
  },
});

Deno.test({
  name: "UI: drag Target schema OBSERVATION onto canvas → extra observation Blockly",
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
        return api?.getSnapshot().blocklyBlocks.some((block) => block.type === "composition") ===
          true;
      }, undefined, { timeout: 20_000 });

      await showOutputTab(page, "target-schema");
      const obsSelector = '#target-schema-tree .tree-row .tree-label';
      await page.waitForSelector(obsSelector, { timeout: 10_000 });
      const obsPath = await page.evaluate(() => {
        const rows = [...document.querySelectorAll("#target-schema-tree .tree-row")];
        const match = rows.find((row) => {
          const meta = row.querySelector(".tree-meta")?.textContent ?? "";
          const label = row.querySelector(".tree-label")?.textContent ?? "";
          return meta.includes("OBSERVATION") || label.toLowerCase().includes("blood pressure");
        });
        return (match as HTMLElement | undefined)?.dataset.path ?? null;
      });
      assert(obsPath, "expected an OBSERVATION row in the Target schema tree");

      const before = await getSnapshot(page);
      const beforeObs = before.blocklyBlocks.filter((b) => b.type === "observation").length;
      const beforeIds = new Set(before.blocklyBlocks.map((b) => b.id));

      await html5DragDrop(
        page,
        `#target-schema-tree .tree-row[data-path="${obsPath}"] .tree-label`,
        "#blockly-mount",
        "bottom-right",
      );

      await page.waitForFunction((ids) => {
        const api = (globalThis as unknown as {
          intehrgratorTestApi: {
            getSnapshot: () => { blocklyBlocks: Array<{ id: string; type: string }> };
          };
        }).intehrgratorTestApi;
        const snap = api.getSnapshot();
        const extra = snap.blocklyBlocks.filter((b) =>
          b.type === "observation" && !ids.includes(b.id)
        );
        return extra.length >= 1;
      }, [...beforeIds], { timeout: 10_000 });

      const snap = await getSnapshot(page);
      const afterObs = snap.blocklyBlocks.filter((b) => b.type === "observation").length;
      assertEquals(afterObs, beforeObs + 1);
      assert(
        snap.blocklyBlocks.some((b) => b.type === "composition"),
        "existing COMPOSITION must remain",
      );
    } finally {
      await browser.close();
    }
  },
});
