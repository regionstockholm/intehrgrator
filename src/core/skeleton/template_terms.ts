import {
  asArray,
  parseLegacyTemplateXml,
  textValue,
} from "ehrtslib/enhanced/parser/legacy/xml_aom_mapper.ts";
import {
  resolveTemplateLanguage,
  termCodeCandidates,
} from "ehrtslib/enhanced/generation/term_codes.ts";

export type TermBag = Record<string, { text?: string; description?: string }>;

/** Human-readable archetype name segment for at-code disambiguation. */
export function archetypeShortName(archetypeRef: string): string {
  const match = /openEHR-EHR-[^.]+\.([^.]+)/.exec(archetypeRef);
  if (match) return match[1];
  const parts = archetypeRef.split(".");
  return parts.length >= 2 ? parts[parts.length - 2] : archetypeRef;
}

export function resolveOptLanguage(
  opt: {
    original_language?: unknown;
    ontology?: { original_language?: { code_string?: string }; term_definitions?: Record<string, unknown> };
  },
): string {
  return resolveTemplateLanguage(opt);
}

/** Extract term text from OPT/AOM term entry shapes. */
export function termTextFromEntry(val: unknown): string | undefined {
  if (typeof val === "string" && val && val !== "[object Object]") return val;
  if (val && typeof val === "object") {
    const o = val as Record<string, unknown>;
    return termTextFromEntry(o.value) ?? termTextFromEntry(o.text) ?? termTextFromEntry(o["#text"]);
  }
  return undefined;
}

export function lookupTermText(terms: TermBag, nodeId?: string): string | undefined {
  if (!nodeId) return undefined;
  for (const code of termCodeCandidates(nodeId)) {
    const text = termTextFromEntry(terms[code]?.text);
    if (text) return text;
  }
  return undefined;
}

function parseTermsOnNode(node: Record<string, unknown>): TermBag {
  const bag: TermBag = {};
  for (const td of asArray(node.term_definitions)) {
    const rec = td as Record<string, unknown>;
    const code = String(rec["@_code"] ?? rec.code ?? "");
    if (!code) continue;
    const entry: { text?: string; description?: string } = {};
    for (const it of asArray(rec.items)) {
      const item = it as Record<string, unknown>;
      const id = String(item["@_id"] ?? item.id ?? "");
      const val = textValue(item);
      if (!val) continue;
      if (id === "text") entry.text = val;
      if (id === "description") entry.description = val;
    }
    bag[code] = entry;
  }
  return bag;
}

/** Per-archetype term tables from OPT XML (avoids merged at-code collisions). */
export function buildArchetypeTermsIndex(optSource: string): Map<string, TermBag> {
  const index = new Map<string, TermBag>();
  try {
    const root = parseLegacyTemplateXml(optSource);
    const def = root.definition;
    if (def && typeof def === "object") walkXmlForArchetypeTerms(def, index);
  } catch {
    // Non-XML templates fall back to merged ontology terms only.
  }
  return index;
}

function walkXmlForArchetypeTerms(
  node: unknown,
  index: Map<string, TermBag>,
): void {
  if (!node || typeof node !== "object") return;
  const n = node as Record<string, unknown>;
  const archId = textValue(n.archetype_id);
  if (archId) {
    const terms = parseTermsOnNode(n);
    if (Object.keys(terms).length > 0) index.set(archId, terms);
  }
  for (const child of asArray(n.children)) walkXmlForArchetypeTerms(child, index);
  for (const attr of asArray(n.attributes)) {
    for (const c of asArray((attr as Record<string, unknown>).children)) {
      walkXmlForArchetypeTerms(c, index);
    }
  }
}

export function compositionArchetypeRef(optSource: string): string | undefined {
  try {
    const root = parseLegacyTemplateXml(optSource);
    const def = root.definition;
    if (def && typeof def === "object") {
      return textValue((def as Record<string, unknown>).archetype_id);
    }
  } catch {
    // ignore
  }
  return undefined;
}

export function mergedOntologyTerms(
  opt: { ontology?: { term_definitions?: Record<string, TermBag> } },
  lang: string,
): TermBag {
  const defs = opt.ontology?.term_definitions ?? {};
  return defs[lang] ?? defs.en ?? Object.values(defs)[0] ?? {};
}
