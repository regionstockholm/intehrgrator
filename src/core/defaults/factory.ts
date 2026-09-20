export const DEFAULTS_MAP_NAME = "defaults";

export const FACTORY_TERRITORY = "SE";
export const FACTORY_ENCODING = "UTF-8";
export const FACTORY_TIME = "2026-08-01T09:13:58+02:00";
export const FACTORY_HEALTH_CARE_FACILITY = "St. Dummy Demo Hospital";
export const FACTORY_COMPOSER_NAME = "Dr. Who Demo";
/** Sentinel string for a PARTY_SELF subject in literal factory entries. */
export const FACTORY_SUBJECT = "PARTY_SELF";

export interface FactoryDefaultsEntry {
  key: string;
  value: string;
}

/**
 * Bundled factory Defaults Map entries (literal strings).
 * Keys are RM paths (`Class.attribute`, wildcards such as `*.language`).
 * The canvas factory prefers `defaults_openEHR_1.map.json`; this list stays
 * the source of truth for keys/order and for headless tests.
 */
export function factoryDefaultsEntries(uiLanguage: string): FactoryDefaultsEntry[] {
  const language = uiLanguage.trim() || "en";
  return [
    { key: "*.language", value: language },
    { key: "COMPOSITION.territory", value: FACTORY_TERRITORY },
    { key: "*.encoding", value: FACTORY_ENCODING },
    { key: "*.start_time", value: FACTORY_TIME },
    { key: "*.origin", value: FACTORY_TIME },
    { key: "*.time", value: FACTORY_TIME },
    { key: "COMPOSITION.composer", value: FACTORY_COMPOSER_NAME },
    { key: "EVENT_CONTEXT.health_care_facility", value: FACTORY_HEALTH_CARE_FACILITY },
    { key: "*.subject", value: FACTORY_SUBJECT },
  ];
}
