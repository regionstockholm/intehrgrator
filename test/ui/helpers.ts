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
): Promise<void> {
  await page.waitForSelector(sourceSelector, { timeout: 10_000 });
  await page.waitForSelector(targetSelector, { timeout: 10_000 });
  const ok = await page.evaluate(
    ({ sourceSelector, targetSelector }) => {
      const source = document.querySelector(sourceSelector);
      const target = document.querySelector(targetSelector);
      if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
        return false;
      }

      const dt = new DataTransfer();
      source.dispatchEvent(
        new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
      target.dispatchEvent(
        new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
      target.dispatchEvent(
        new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
      target.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
      source.dispatchEvent(
        new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }),
      );
      return true;
    },
    { sourceSelector, targetSelector },
  );
  if (!ok) throw new Error(`html5DragDrop failed: ${sourceSelector} → ${targetSelector}`);
}
