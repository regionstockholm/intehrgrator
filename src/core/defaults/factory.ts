export const DEFAULTS_MAP_NAME = "defaults";

export const FACTORY_TERRITORY = "SE";
export const FACTORY_ENCODING = "UTF-8";
export const FACTORY_TIME = "2026-08-01T09:13:58+02:00";
export const FACTORY_HEALTH_CARE_FACILITY = "St. Dummy Demo Hospital";
export const FACTORY_COMPOSER_NAME = "Dr. Who Demo";
/** Sentinel string for a PARTY_SELF subject in literal factory entries. */
export const FACTORY_SUBJECT = "PARTY_SELF";

export interface FactoryDefaultsEntry {
  runtimeKey: string;
  scaffoldTargets: string[];
  value: string;
}

/**
 * Bundled factory default context map entries (literal strings).
 * Convert-time bag uses **runtime keys**; scaffolding matches **scaffold targets**.
 * The canvas factory prefers `defaults_openEHR_1.map.json`; this list stays
 * the source of truth for keys/order and for headless tests.
 */
export function factoryDefaultsEntries(uiLanguage: string): FactoryDefaultsEntry[] {
  const language = uiLanguage.trim() || "en";
  return [
    { runtimeKey: "language", scaffoldTargets: ["*.language"], value: language },
    { runtimeKey: "territory", scaffoldTargets: ["COMPOSITION.territory"], value: FACTORY_TERRITORY },
    { runtimeKey: "encoding", scaffoldTargets: ["*.encoding"], value: FACTORY_ENCODING },
    { runtimeKey: "start_time", scaffoldTargets: ["*.start_time"], value: FACTORY_TIME },
    { runtimeKey: "origin", scaffoldTargets: ["*.origin"], value: FACTORY_TIME },
    { runtimeKey: "time", scaffoldTargets: ["*.time"], value: FACTORY_TIME },
    { runtimeKey: "composer", scaffoldTargets: ["COMPOSITION.composer"], value: FACTORY_COMPOSER_NAME },
    {
      runtimeKey: "facility",
      scaffoldTargets: ["EVENT_CONTEXT.health_care_facility"],
      value: FACTORY_HEALTH_CARE_FACILITY,
    },
    { runtimeKey: "subject", scaffoldTargets: ["*.subject"], value: FACTORY_SUBJECT },
  ];
}
