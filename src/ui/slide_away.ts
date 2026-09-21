/** Persist slide-away pane and Target & Previews tab choices. */

export const SOURCE_SLIDE_STORAGE = "layout-source-slid-away-v1";
export const OUTPUT_SLIDE_STORAGE = "layout-output-slid-away-v1";
export const OUTPUT_TAB_STORAGE = "layout-output-tab-v1";

export const OUTPUT_TAB_IDS = ["target-schema", "script", "test"] as const;
export type OutputTabId = typeof OUTPUT_TAB_IDS[number];

export function isOutputTabId(value: string | null | undefined): value is OutputTabId {
  return value === "target-schema" || value === "script" || value === "test";
}

export function readStoredFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeStoredFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // quota / private mode
  }
}

export function readStoredOutputTab(): OutputTabId {
  try {
    const raw = localStorage.getItem(OUTPUT_TAB_STORAGE);
    if (isOutputTabId(raw)) return raw;
  } catch {
    // private mode
  }
  return "target-schema";
}

export function writeStoredOutputTab(tab: OutputTabId): void {
  try {
    localStorage.setItem(OUTPUT_TAB_STORAGE, tab);
  } catch {
    // quota / private mode
  }
}
