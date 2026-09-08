/**
 * Bundled Blockly JSON for the factory Defaults Map (includes `subject` → PARTY_SELF).
 * Used when opening a blank project / scaffolding when the browser has no other
 * Defaults Map plugged into the Defaults block yet.
 */
import factoryMapJson from "./defaults-with-subject.map.json" with { type: "json" };
import { termSetIdForDefaultsKey } from "../openehr_term_catalog.ts";

/** Deep-clone the bundled factory `maps_create_with` block, patching UI language. */
export function factoryDefaultsMapBlockState(uiLanguage: string): Record<string, unknown> {
  const state = structuredClone(factoryMapJson) as Record<string, unknown>;
  patchFactoryMapLanguage(state, uiLanguage.trim() || "en");
  return state;
}

function patchFactoryMapLanguage(state: Record<string, unknown>, language: string): void {
  const fields = state.fields as Record<string, unknown> | undefined;
  const inputs = state.inputs as Record<string, unknown> | undefined;
  if (!fields || !inputs) return;
  for (const [name, key] of Object.entries(fields)) {
    if (!/^KEY\d+$/.test(name) || key !== "language") continue;
    const index = name.slice(3);
    const val = inputs[`VAL${index}`] as
      | { block?: Record<string, unknown>; shadow?: Record<string, unknown> }
      | undefined;
    if (!val) return;
    const setId = termSetIdForDefaultsKey("language");
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
