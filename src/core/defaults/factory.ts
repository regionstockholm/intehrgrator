export const DEFAULTS_MAP_NAME = "defaults";

export const FACTORY_TERRITORY = "SE";
export const FACTORY_HEALTH_CARE_FACILITY = "St. Dummy Demo Hospital";

/** Standard simplified-format `ctx` keys shown on the Defaults canvas block. */
export const CTX_DEFAULT_KEYS = [
  "language",
  "territory",
  "time",
  "composer_name",
  "health_care_facility",
] as const;

export type CtxDefaultKey = (typeof CTX_DEFAULT_KEYS)[number];

/** Human-readable row labels on the Defaults ctx Map block (not the map keys). */
export const CTX_DEFAULT_LABELS: Record<CtxDefaultKey, string> = {
  language: "Language",
  territory: "Territory",
  time: "Time",
  composer_name: "Composer",
  health_care_facility: "Health care facility",
};

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
    { key: "time", value: "" },
    { key: "composer_name", value: "" },
    { key: "health_care_facility", value: FACTORY_HEALTH_CARE_FACILITY },
  ];
}
