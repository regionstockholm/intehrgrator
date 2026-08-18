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
