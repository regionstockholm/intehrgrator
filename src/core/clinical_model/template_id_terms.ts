/**
 * Better `.t.json` nests are scoped by template id (`ChemoQ-fatigue`) while
 * ehrtslib's term index is keyed by archetype id. Several symptom templates
 * share one archetype id, so that index keeps a single terminology and slot
 * labels collide (fatigue rendered as weight or tingling).
 *
 * These helpers rebuild one term bag per template id and point each inlined
 * root at the embedded template's concept term (`at0000` / `at0000.1`).
 * Upstream suggestion: https://github.com/ErikSundvall/ehrtslib/issues/110
 */
import { termTableForArchetype } from "ehrtslib/am/util/ontology_merge.ts";
import {
  TERM_ARCHETYPE_SCOPE_KEY,
  TERM_NAME_FALLBACK_NODE_ID_KEY,
} from "ehrtslib/generation/term_scope.ts";
import type { ArchetypeRepository } from "ehrtslib/parser/legacy/archetype_repository.ts";
import type { TermBag } from "../skeleton/template_terms.ts";

export function templateIdTermBags(
  repository: ArchetypeRepository,
  files: Array<{ path: string; content: string }>,
  language: string,
): Map<string, TermBag> {
  const bags = new Map<string, TermBag>();
  for (const file of files) {
    if (!/\.t\.json$/i.test(file.path)) continue;
    const templateId = templateIdFromJson(file.content);
    if (!templateId || bags.has(templateId)) continue;
    const template = repository.getTemplate(templateId);
    if (!template) continue;
    const table = termTableForArchetype(template, repository);
    const source = table[language] ?? table.en ?? Object.values(table)[0];
    if (!source) continue;
    const bag = termBagFromTable(source);
    if (Object.keys(bag).length) bags.set(templateId, bag);
  }
  return bags;
}

/** Set a concept-term fallback on each node where a template-id scope begins. */
export function tagTemplateIdConceptNames(
  definition: unknown,
  bags: Map<string, TermBag>,
): void {
  if (!definition || bags.size === 0) return;
  walk(definition, undefined, bags);
}

function walk(
  node: unknown,
  parentScope: string | undefined,
  bags: Map<string, TermBag>,
): void {
  if (!node || typeof node !== "object") return;
  const meta = node as Record<PropertyKey, unknown>;
  const scope = meta[TERM_ARCHETYPE_SCOPE_KEY];
  const current = typeof scope === "string" ? scope : undefined;
  if (current && current !== parentScope && bags.has(current)) {
    const concept = conceptCode(bags.get(current)!);
    if (concept && !meta[TERM_NAME_FALLBACK_NODE_ID_KEY]) {
      meta[TERM_NAME_FALLBACK_NODE_ID_KEY] = concept;
    }
  }
  const next = current ?? parentScope;
  const attributes = meta.attributes;
  if (!Array.isArray(attributes)) return;
  for (const attr of attributes) {
    if (!attr || typeof attr !== "object") continue;
    const children = (attr as { children?: unknown }).children;
    if (!Array.isArray(children)) continue;
    for (const child of children) walk(child, next, bags);
  }
}

function conceptCode(bag: TermBag): string | undefined {
  if (bag["at0000.1"]?.text) return "at0000.1";
  if (bag["at0000"]?.text) return "at0000";
  return undefined;
}

function termBagFromTable(
  source: Record<string, { text?: string; description?: string }>,
): TermBag {
  const bag: TermBag = {};
  for (const [code, entry] of Object.entries(source)) {
    if (!entry?.text) continue;
    bag[code] = entry.description
      ? { text: entry.text, description: entry.description }
      : { text: entry.text };
  }
  return bag;
}

function templateIdFromJson(content: string): string | undefined {
  try {
    const parsed = JSON.parse(content) as { templateId?: unknown };
    return typeof parsed.templateId === "string" && parsed.templateId.length > 0
      ? parsed.templateId
      : undefined;
  } catch {
    return undefined;
  }
}
