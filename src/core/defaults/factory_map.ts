/**
 * Bundled Blockly JSON for the factory openEHR default context map
 * (`defaults_openEHR_1.map.json`: term picks + party objects).
 * Used when jointly loading an openEHR target, or when headless `load_target`
 * scaffolds without a pending map.
 */
import factoryMapJson from "./defaults_openEHR_1.map.json" with { type: "json" };
import { termSetIdForDefaultsKey } from "../openehr_term_catalog.ts";
import { DEFAULT_CONTEXT_MAP_TYPE, mapsCreateWithToContextMap } from "./context_map.ts";

/** Deep-clone the bundled factory block, patching UI language. */
export function factoryDefaultsMapBlockState(uiLanguage: string): Record<string, unknown> {
  const raw = structuredClone(factoryMapJson) as Record<string, unknown>;
  const state = raw.type === DEFAULT_CONTEXT_MAP_TYPE
    ? raw
    : mapsCreateWithToContextMap(raw) ?? raw;
  patchFactoryMapLanguage(state, uiLanguage.trim() || "en");
  return state;
}

function patchFactoryMapLanguage(state: Record<string, unknown>, language: string): void {
  const fields = state.fields as Record<string, unknown> | undefined;
  const inputs = state.inputs as Record<string, unknown> | undefined;
  if (!fields || !inputs) return;
  for (const [name, key] of Object.entries(fields)) {
    if (!/^KEY\d+$/.test(name)) continue;
    if (defaultsKeyAttribute(key) !== "language") continue;
    const index = name.slice(3);
    const val = inputs[`VAL${index}`] as
      | { block?: Record<string, unknown>; shadow?: Record<string, unknown> }
      | undefined;
    if (!val) return;
    const setId = termSetIdForDefaultsKey(String(key));
    if (val.block?.type === "term_pick" && setId) {
      const blockFields = (val.block.fields ?? {}) as Record<string, unknown>;
      blockFields.CODE = language;
      blockFields.SET = setId;
      val.block.fields = blockFields;
    }
    if (val.shadow?.type === "text") {
      const shadowFields = (val.shadow.fields ?? {}) as Record<string, unknown>;
      shadowFields.TEXT = language;
      val.shadow.fields = shadowFields;
    } else if (val.shadow?.type === "term_pick" && setId) {
      const shadowFields = (val.shadow.fields ?? {}) as Record<string, unknown>;
      shadowFields.CODE = language;
      shadowFields.SET = setId;
      val.shadow.fields = shadowFields;
    }
    return;
  }
}

function defaultsKeyAttribute(key: unknown): string {
  return String(key).split(".").filter(Boolean).at(-1) ?? "";
}
