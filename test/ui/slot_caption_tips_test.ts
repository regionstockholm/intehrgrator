/**
 * Browser UI: slot ⁇ glyphs and overlay cardinality markers keep their own
 * hover/click tooltips (not the whole caption).
 */
import { assert, assertEquals } from "@std/assert";
import { chromium } from "npm:playwright@1.51.0";
import type { IntehrgratorTestApi } from "../../src/ui_test/test_api.ts";
import { baseUrl, waitForTestApi } from "./helpers.ts";

Deno.test({
  name: "UI: stood captions right-align to the glyph; ?? and Δ keep their own tips",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const opt = await Deno.readTextFile(
      new URL("../fixtures/simple-diagnose-and-vitals.opt", import.meta.url),
    );
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.goto(`${baseUrl}/?testMode=1`, { waitUntil: "networkidle" });
      await waitForTestApi(page);
      await page.evaluate((content) => {
        const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
          .intehrgratorTestApi;
        api.loadTemplate("simple-diagnose-and-vitals.opt", content);
      }, opt);
      await page.waitForTimeout(800);

      const layout = await page.evaluate(() => {
        const stoodText = [...document.querySelectorAll(".blockly-slot-label")]
          .find((el) => el.closest("g")?.classList.contains("blockly-slot-label--stand")) as
            | SVGTextElement
            | undefined;
        const glyph = document.querySelector(".blockly-slot-abstract-glyph") as SVGTextElement | null;
        const overlay = document.querySelector("[data-constraint-overlay-tip]");
        return {
          stoodAnchor: stoodText?.getAttribute("text-anchor") ?? null,
          stoodTransform: stoodText?.getAttribute("transform") ?? null,
          glyphHasTip: Boolean(glyph?.getAttribute("data-rm-type-tip")?.includes("Allowed:")),
          overlayTip: overlay?.getAttribute("data-constraint-overlay-tip") ?? null,
          groupHasTip: Boolean(stoodText?.closest("g")?.getAttribute("data-rm-type-tip")),
        };
      });
      assertEquals(layout.stoodAnchor, "end");
      assert(layout.stoodTransform?.includes("rotate(-90)"), "stood caption should rotate -90");
      assert(layout.stoodTransform?.includes("translate("), "stood caption needs a translate pivot");
      assert(layout.glyphHasTip, "?? glyph should carry the Allowed: type list");
      assert(
        layout.overlayTip?.includes("narrowed"),
        `overlay tip missing: ${layout.overlayTip}`,
      );
      assertEquals(layout.groupHasTip, false, "type tip must not sit on the whole caption group");

      const tips = await page.evaluate(() => {
        const glyph = document.querySelector(".blockly-slot-abstract-glyph") as (SVGTextElement & { tooltip?: string }) | null;
        glyph?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        const overlay = document.querySelector("[data-constraint-overlay-tip]") as (SVGElement & { tooltip?: string }) | null;
        overlay?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return {
          slotLabelTip: document.getElementById("blockly-slot-label-tip"),
          overlayTip: document.getElementById("blockly-slot-overlay-tip"),
          rmEmojiTip: document.querySelector(".blockly-rm-emoji-tip"),
          glyphTooltip: glyph?.tooltip ?? "",
          overlayTooltip: overlay?.tooltip ?? "",
        };
      });
      // No persistent black pinned tooltips should be created on click
      assertEquals(tips.slotLabelTip, null, "black pinned slot label tip should no longer exist");
      assertEquals(tips.overlayTip, null, "black pinned overlay tip should no longer exist");
      assertEquals(tips.rmEmojiTip, null, "no .blockly-rm-emoji-tip should exist");

      // Elements have their tooltips bound for Blockly's native tooltip
      assert(
        tips.glyphTooltip.includes("Allowed:") || tips.glyphTooltip.includes("abstract"),
        `?? tooltip missing: ${tips.glyphTooltip.slice(0, 120)}`,
      );
      assert(
        tips.overlayTooltip.includes("narrowed") || tips.overlayTooltip.includes("operational template"),
        `overlay tooltip missing: ${tips.overlayTooltip.slice(0, 120)}`,
      );
    } finally {
      await browser.close();
    }
  },
});
