/**
 * Browser UI test: drag a Source Schema / Example Instance node onto the
 * Blockly canvas (not a value slot) to create a typed source block.
 */

import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import {
  baseUrl,
  getSnapshot,
  html5DragDrop,
  loadBpFixtures,
  waitForTestApi,
} from "./helpers.ts";

Deno.test({
  name: "UI: drag schema systolic onto canvas → number source block with $.systolic",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);

      await page.waitForSelector('#schema-tree .tree-row[data-path="$.systolic"] .tree-label', {
        timeout: 10_000,
      });
      const before = await getSnapshot(page);
      const beforeIds = new Set(before.blocklyBlocks.map((b) => b.id));

      await html5DragDrop(
        page,
        '#schema-tree .tree-row[data-path="$.systolic"] .tree-label',
        "#blockly-mount",
        "bottom-right",
      );

      await page.waitForFunction((ids) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: { getSnapshot: () => {
          blocklyBlocks: Array<{
            id: string;
            type: string;
            fields?: Record<string, string>;
          }>;
        } } }).intehrgratorTestApi;
        return api.getSnapshot().blocklyBlocks.some((b) =>
          !ids.includes(b.id) &&
          (b.type === "source_query_number" || b.type === "source_query") &&
          (b.fields?.EXPRESSION ?? "").includes("systolic")
        );
      }, [...beforeIds], { timeout: 10_000 });

      const snap = await getSnapshot(page);
      const created = snap.blocklyBlocks.find((b) =>
        !beforeIds.has(b.id) &&
        (b.type === "source_query_number" || b.type === "source_query") &&
        (b.fields?.EXPRESSION ?? "").includes("systolic")
      );
      assert(
        created,
        `status=${snap.statusMessage}; blocks=${
          snap.blocklyBlocks.map((b) => `${b.type}:${JSON.stringify(b.fields)}`).join(" | ")
        }`,
      );
      assertEquals(created.type, "source_query_number");
      assertEquals(created.fields.EXPRESSION, "$.systolic");
      const numChecks = Array.isArray(created.outputCheck)
        ? created.outputCheck
        : created.outputCheck
        ? [created.outputCheck]
        : [];
      assert(numChecks.includes("Number"), `outputCheck=${JSON.stringify(created.outputCheck)}`);
    } finally {
      await browser.close();
    }
  },
});

Deno.test({
  name: "UI: drag instance patientId onto canvas → string source block with $.patientId",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await loadBpFixtures(page);

      await page.waitForSelector('#example-tree .tree-row[data-path="$.patientId"] .tree-label', {
        timeout: 10_000,
      });
      const before = await getSnapshot(page);
      const beforeIds = new Set(before.blocklyBlocks.map((b) => b.id));

      await html5DragDrop(
        page,
        '#example-tree .tree-row[data-path="$.patientId"] .tree-label',
        "#blockly-mount",
        "bottom-right",
      );

      await page.waitForFunction((ids) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: { getSnapshot: () => {
          blocklyBlocks: Array<{
            id: string;
            type: string;
            fields?: Record<string, string>;
          }>;
        } } }).intehrgratorTestApi;
        return api.getSnapshot().blocklyBlocks.some((b) =>
          !ids.includes(b.id) &&
          b.type === "source_query" &&
          (b.fields?.EXPRESSION ?? "").includes("patientId")
        );
      }, [...beforeIds], { timeout: 10_000 });

      const snap = await getSnapshot(page);
      const created = snap.blocklyBlocks.find((b) =>
        !beforeIds.has(b.id) &&
        b.type === "source_query" &&
        (b.fields?.EXPRESSION ?? "").includes("patientId")
      );
      assert(
        created,
        `status=${snap.statusMessage}; blocks=${
          snap.blocklyBlocks.filter((b) => b.type.startsWith("source_")).map((b) =>
            `${b.type}:${JSON.stringify(b.fields)}`
          ).join(" | ") || "(no source blocks)"
        }`,
      );
      assertEquals(created.fields.EXPRESSION, "$.patientId");
      const strChecks = Array.isArray(created.outputCheck)
        ? created.outputCheck
        : created.outputCheck
        ? [created.outputCheck]
        : [];
      assert(strChecks.includes("String"), `outputCheck=${JSON.stringify(created.outputCheck)}`);
    } finally {
      await browser.close();
    }
  },
});
