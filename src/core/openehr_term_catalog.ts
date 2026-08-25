/**
 * Browse-able openEHR terminology groups and RM code sets from ehrtslib XML.
 *
 * Groups (composition category, setting, …) come from `openehr_terminology_en.xml`.
 * External code sets (ISO_639-1, ISO_3166-1, IANA_character-sets) come from
 * `openehr_external_terminologies.xml`.
 *
 * @see vendor/ehrtslib/term/terminology_service.ts
 * @see openehr://guides/specs/rm-ehr
 */
import { XMLParser } from "fast-xml-parser";
import { isSubtypeOf } from "./rm_meta.ts";
import { openEhrTerminologyXml } from "./openehr_term_xml_embed.ts";

export const TERM_PICK_NONE = "__none__";

export interface TermPick {
  code: string;
  rubric: string;
}

export type TermValueRmType = "CODE_PHRASE" | "DV_CODED_TEXT";

export interface TermSet {
  id: string;
  terminologyId: string;
  label: string;
  valueRmType: TermValueRmType;
  codes: TermPick[];
}

/** RM parent.attribute → catalog term-set id. */
const RM_TERM_SET: Record<string, Record<string, string>> = {
  COMPOSITION: {
    language: "ISO_639-1",
    territory: "ISO_3166-1",
    category: "openehr:composition_category",
  },
  ENTRY: {
    language: "ISO_639-1",
    encoding: "IANA_character-sets",
  },
  EVENT_CONTEXT: {
    setting: "openehr:setting",
  },
  INTERVAL_EVENT: {
    math_function: "openehr:event_math_function",
  },
  ISM_TRANSITION: {
    current_state: "openehr:instruction_states",
    transition: "openehr:instruction_transitions",
  },
  PARTY_RELATED: {
    relationship: "openehr:subject_relationship",
  },
  PARTICIPATION: {
    function: "openehr:participation_function",
    mode: "openehr:participation_mode",
  },
};

const PREFERRED_SET_ORDER = [
  "openehr:composition_category",
  "ISO_639-1",
  "ISO_3166-1",
  "IANA_character-sets",
  "openehr:setting",
  "openehr:instruction_states",
  "openehr:instruction_transitions",
  "openehr:event_math_function",
];

let cachedSets: TermSet[] | null = null;

export function listTermSets(): TermSet[] {
  return [...ensureSets()].sort(compareTermSets);
}

export function termSetById(id: string): TermSet | undefined {
  return ensureSets().find((set) => set.id === id);
}

export function termSetIdForRmAttribute(
  parentRmType: string,
  attributeName: string,
): string | undefined {
  const own = RM_TERM_SET[parentRmType]?.[attributeName];
  if (own) return own;
  if (parentRmType === "ENTRY" || isSubtypeOf(parentRmType, "ENTRY")) {
    return RM_TERM_SET.ENTRY?.[attributeName];
  }
  return undefined;
}

export function termSetForRmAttribute(
  parentRmType: string,
  attributeName: string,
): TermSet | undefined {
  const id = termSetIdForRmAttribute(parentRmType, attributeName);
  return id ? termSetById(id) : undefined;
}

/**
 * Catalog set that owns a template-mandated code. Prefer a terminology_id match
 * so local at-codes are not mistaken for openEHR built-ins.
 */
export function termSetForMandatedCode(
  terminologyId: string | undefined,
  code: string | undefined,
): TermSet | undefined {
  if (!code || code === TERM_PICK_NONE) return undefined;
  const sets = ensureSets();
  const hasCode = (set: TermSet) => set.codes.some((item) => item.code === code);
  const matchesTerm = (set: TermSet) => {
    if (!terminologyId) return true;
    return (
      set.terminologyId === terminologyId ||
      set.id === terminologyId ||
      set.id === `openehr:${terminologyId}`
    );
  };
  const preferred = sets.find((set) => matchesTerm(set) && hasCode(set));
  if (preferred) return preferred;
  if (terminologyId) return undefined;
  return sets.find(hasCode);
}

/** Defaults Map keys whose values are built-in RM code sets. */
export const DEFAULTS_KEY_TERM_SET: Record<string, string> = {
  language: "ISO_639-1",
  territory: "ISO_3166-1",
};

export function termSetIdForDefaultsKey(key: string): string | undefined {
  return DEFAULTS_KEY_TERM_SET[key];
}

export function termPickDropdownOptions(setId: string): Array<[string, string]> {
  const set = termSetById(setId);
  const options: Array<[string, string]> = [["choose…", TERM_PICK_NONE]];
  if (!set) return options;
  for (const code of set.codes) {
    const label = code.rubric && code.rubric !== code.code
      ? `${code.rubric} (${code.code})`
      : code.code;
    options.push([label, code.code]);
  }
  return options;
}

export function termSetDropdownOptions(): Array<[string, string]> {
  return listTermSets().map((set) => [set.label, set.id]);
}

function ensureSets(): TermSet[] {
  if (cachedSets) return cachedSets;
  const xml = openEhrTerminologyXml();
  cachedSets = [...parseTerminologyXml(xml.en), ...parseTerminologyXml(xml.ext)];
  return cachedSets;
}

function parseTerminologyXml(xml: string): TermSet[] {
  if (!xml.trim()) return [];
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => ["codeset", "group", "code", "concept"].includes(name),
  });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const root = asRecord(doc.terminology);
  if (!root) return [];
  const out: TermSet[] = [];

  for (const codeset of arrayOf(root.codeset)) {
    const externalId = str(codeset, "@_external_id");
    const name = str(codeset, "@_name");
    const openehrId = str(codeset, "@_openehr_id");
    const id = externalId || openehrId;
    if (!id) continue;
    const codes: TermPick[] = arrayOf(codeset.code).map((item) => {
      const code = str(item, "@_value");
      return { code, rubric: str(item, "@_description") || code };
    }).filter((item) => item.code);
    out.push({
      id,
      terminologyId: externalId || "openehr",
      label: name ? `${name} (${id})` : id,
      valueRmType: "CODE_PHRASE",
      codes,
    });
  }

  for (const group of arrayOf(root.group)) {
    const openehrId = str(group, "@_openehr_id");
    const name = str(group, "@_name") || openehrId;
    if (!openehrId) continue;
    const codes: TermPick[] = arrayOf(group.concept).map((item) => {
      const code = str(item, "@_id");
      return { code, rubric: str(item, "@_rubric") || code };
    }).filter((item) => item.code);
    out.push({
      id: `openehr:${openehrId}`,
      terminologyId: "openehr",
      label: name,
      valueRmType: "DV_CODED_TEXT",
      codes,
    });
  }

  return out;
}

function compareTermSets(a: TermSet, b: TermSet): number {
  const ai = PREFERRED_SET_ORDER.indexOf(a.id);
  const bi = PREFERRED_SET_ORDER.indexOf(b.id);
  if (ai >= 0 || bi >= 0) {
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  }
  return a.label.localeCompare(b.label);
}

function arrayOf(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  return isRecord(value) ? [value] : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function str(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  return typeof value === "string" ? value : "";
}
