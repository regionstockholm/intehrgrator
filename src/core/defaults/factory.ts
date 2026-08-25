export const DEFAULTS_MAP_NAME = "defaults";

export const FACTORY_TERRITORY = "SE";
export const FACTORY_ENCODING = "UTF-8";
export const FACTORY_HEALTH_CARE_FACILITY = "St. Dummy Demo Hospital";

export interface FactoryDefaultsEntry {
  key: string;
  value: string;
}

/** Bundled factory Defaults Map entries (literal strings). */
export function factoryDefaultsEntries(uiLanguage: string): FactoryDefaultsEntry[] {
  const language = uiLanguage.trim() || "en";
  return [
    { key: "language", value: language },
    { key: "territory", value: FACTORY_TERRITORY },
    { key: "encoding", value: FACTORY_ENCODING },
    { key: "time", value: "" },
    { key: "composer_name", value: "" },
    { key: "health_care_facility", value: FACTORY_HEALTH_CARE_FACILITY },
  ];
}
