export const DEFAULTS_MAP_NAME = "defaults";

export const FACTORY_TERRITORY = "SE";
export const FACTORY_HEALTH_CARE_FACILITY = "St. Dummy Demo Hospital";

/** Simplified-format ctx keys seeded on the factory Defaults Map (no `ctx/` prefix). */
export const FACTORY_CTX_KEYS = [
  "language",
  "territory",
  "time",
  "composer_name",
  "health_care_facility",
] as const;

export interface FactoryDefaultsEntry {
  key: string;
  value: string;
}

/** Bundled factory Defaults Map entries (literal strings). */
export function factoryDefaultsEntries(uiLanguage: string): FactoryDefaultsEntry[] {
  const language = uiLanguage.trim() || "en";
  const values: Record<(typeof FACTORY_CTX_KEYS)[number], string> = {
    language,
    territory: FACTORY_TERRITORY,
    time: "",
    composer_name: "",
    health_care_facility: FACTORY_HEALTH_CARE_FACILITY,
  };
  return FACTORY_CTX_KEYS.map((key) => ({ key, value: values[key] }));
}
