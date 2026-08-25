import { dirname, fromFileUrl, join } from "@std/path";
import type { Page } from "npm:playwright@1.51.0";
import type { IntehrgratorTestApi, WorkbenchTestSnapshot } from "../../src/ui_test/test_api.ts";

export const root = join(dirname(fromFileUrl(import.meta.url)), "../..");
export const baseUrl = Deno.env.get("UI_TEST_BASE_URL") ?? "http://127.0.0.1:5173";
export const systolicSuffix = "items/at0004/value/value/value";

export async function fixtureText(rel: string): Promise<string> {
  return await Deno.readTextFile(join(root, rel));
}

export async function waitForTestApi(page: Page): Promise<void> {
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

export async function loadBpFixtures(page: Page): Promise<void> {
  const opt = await fixtureText("test/fixtures/blood_pressure.opt");
  const schema = await fixtureText("test/fixtures/ui/bp_source_schema.json");
  const example = await fixtureText("test/fixtures/ui/bp_example.json");
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
}

export async function findSystolicSlotId(page: Page): Promise<string> {
  const slotId = await page.evaluate((suffix) => {
    const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
      .intehrgratorTestApi;
    return api.findSlotIdBySuffix(suffix);
  }, systolicSuffix);
  if (!slotId) throw new Error(`expected systolic slot ending with ${systolicSuffix}`);
  return slotId;
}

export async function getSnapshot(page: Page): Promise<WorkbenchTestSnapshot> {
  return await page.evaluate(() => {
    const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
      .intehrgratorTestApi;
    return api.getSnapshot();
  });
}

export async function clickBlocklyBlock(page: Page, blockId: string): Promise<void> {
  await page.evaluate((id) => {
    const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
      .intehrgratorTestApi;
    api.clickBlock(id);
  }, blockId);
}

export async function findElementBlockId(page: Page, slotId: string): Promise<string> {
  const id = await page.evaluate((slot) => {
    const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
      .intehrgratorTestApi;
    const match = api.getSnapshot().blocklyBlocks.find((b) =>
      b.slotId === slot && (b.type === "element" || b.type === "target_value")
    );
    return match?.id ?? null;
  }, slotId);
  if (!id) throw new Error(`element block not found for slot ${slotId}`);
  return id;
}

export async function waitForMappedSlot(page: Page, slotId: string): Promise<void> {
  await page.waitForFunction((id) => {
    const api = (globalThis as unknown as { intehrgratorTestApi: IntehrgratorTestApi })
      .intehrgratorTestApi;
    const snap = api.getSnapshot();
    const slot = snap.model.slots.find((s) => s.slotId === id);
    return Boolean(slot?.expression?.includes("systolic"));
  }, slotId, { timeout: 10_000 });
}

/**
 * HTML5 drag-and-drop with DataTransfer payload.
 * Playwright's locator.dragTo does not reliably populate custom MIME types.
 */
export async function html5DragDrop(
  page: Page,
  sourceSelector: string,
  targetSelector: string,
  point: "center" | "bottom-right" = "center",
): Promise<void> {
  await page.waitForSelector(sourceSelector, { timeout: 10_000 });
  await page.waitForSelector(targetSelector, { timeout: 10_000 });
  const ok = await page.evaluate(
    ({ sourceSelector, targetSelector, point }) => {
      const source = document.querySelector(sourceSelector);
      const target = document.querySelector(targetSelector);
      if (!(source instanceof Element) || !(target instanceof Element)) {
        return false;
      }

      const rect = target.getBoundingClientRect();
      const clientX = point === "bottom-right"
        ? rect.right - 24
        : rect.left + rect.width / 2;
      const clientY = point === "bottom-right"
        ? rect.bottom - 24
        : rect.top + rect.height / 2;

      const dt = new DataTransfer();
      const opts = { bubbles: true, cancelable: true, dataTransfer: dt, clientX, clientY };
      source.dispatchEvent(new DragEvent("dragstart", opts));
      target.dispatchEvent(new DragEvent("dragenter", opts));
      target.dispatchEvent(new DragEvent("dragover", opts));
      target.dispatchEvent(new DragEvent("drop", opts));
      source.dispatchEvent(new DragEvent("dragend", opts));
      return true;
    },
    { sourceSelector, targetSelector, point },
  );
  if (!ok) throw new Error(`html5DragDrop failed: ${sourceSelector} → ${targetSelector}`);
}

/**
 * Client point on a Blockly block that is also inside `#blockly-mount`.
 * Parent SVG roots are often taller than the viewport; dropping at
 * `height / 2` can miss the mount even after `scrollBlockIntoView`.
 */
export function visibleBlockDropPoint(
  rect: { x: number; y: number; width: number; height: number },
  mount: { left: number; top: number; right: number; bottom: number },
): { x: number; y: number } | null {
  const left = Math.max(rect.x, mount.left);
  const right = Math.min(rect.x + rect.width, mount.right);
  const top = Math.max(rect.y, mount.top);
  const bottom = Math.min(rect.y + rect.height, mount.bottom);
  if (right - left < 4 || bottom - top < 4) return null;
  return {
    x: left + Math.min(16, (right - left) / 2),
    y: top + Math.min(12, (bottom - top) / 2),
  };
}

/** Drop onto Blockly at a block's client coordinates (slot rail is gone). */
export async function html5DragDropToPoint(
  page: Page,
  sourceSelector: string,
  clientX: number,
  clientY: number,
): Promise<void> {
  await page.waitForSelector(sourceSelector, { timeout: 10_000 });
  const ok = await page.evaluate(
    ({ sourceSelector, clientX, clientY }) => {
      const source = document.querySelector(sourceSelector);
      const target = document.getElementById("blockly-mount");
      if (!(source instanceof Element) || !(target instanceof Element)) {
        return false;
      }
      const dt = new DataTransfer();
      const opts = { bubbles: true, cancelable: true, dataTransfer: dt, clientX, clientY };
      source.dispatchEvent(new DragEvent("dragstart", opts));
      target.dispatchEvent(new DragEvent("dragenter", opts));
      target.dispatchEvent(new DragEvent("dragover", opts));
      target.dispatchEvent(new DragEvent("drop", opts));
      source.dispatchEvent(new DragEvent("dragend", opts));
      return true;
    },
    { sourceSelector, clientX, clientY },
  );
  if (!ok) throw new Error(`html5DragDropToPoint failed: ${sourceSelector}`);
}

/** Drop a text file onto a pane (OS-file drop path used by Source Schema / Examples). */
export async function dropTextFile(
  page: Page,
  targetSelector: string,
  filename: string,
  content: string,
  mime = "application/json",
): Promise<void> {
  await page.waitForSelector(targetSelector, { timeout: 10_000 });
  await page.evaluate(
    ({ targetSelector, filename, content, mime }) => {
      const target = document.querySelector(targetSelector);
      if (!(target instanceof HTMLElement)) {
        throw new Error(`missing drop target ${targetSelector}`);
      }
      const file = new File([content], filename, { type: mime });
      const dt = new DataTransfer();
      dt.items.add(file);
      const opts = { bubbles: true, cancelable: true, dataTransfer: dt };
      target.dispatchEvent(new DragEvent("dragenter", opts));
      target.dispatchEvent(new DragEvent("dragover", opts));
      target.dispatchEvent(new DragEvent("drop", opts));
    },
    { targetSelector, filename, content, mime },
  );
}
