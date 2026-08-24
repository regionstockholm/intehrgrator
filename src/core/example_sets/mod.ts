/**
 * Example-set catalog: complete bundles of source schema + instances, target,
 * and optional Blockly mapping, loaded by URI.
 *
 * The catalog JSON is maintained by ehrtslib developers. Relative URIs in a
 * catalog resolve against that catalog's URL.
 */

import { assertHttpUrl, toFetchableUrl } from "../../host/fetch_url.ts";

/** Bundled dummy catalog shipped with the Web Shell (fallback / first instance). */
export const BUNDLED_EXAMPLE_SETS_PATH = "examples/example-sets.json";

/**
 * Canonical catalog location once ehrtslib publishes it.
 * Until that file exists, the Web Shell falls back to {@link BUNDLED_EXAMPLE_SETS_PATH}.
 */
export const EHRTSLIB_EXAMPLE_SETS_CATALOG_URL =
  "https://raw.githubusercontent.com/ErikSundvall/ehrtslib/main/examples/intehrgrator-example-sets.json";

export interface ExampleSetSource {
  schema: string;
  instances: string[];
}

export interface ExampleSet {
  id: string;
  title: string;
  description?: string;
  source: ExampleSetSource;
  target: string;
  /** Optional Blockly workspace JSON URI. */
  mapping?: string;
  /** Optional Defaults Map (`maps_create_with` Blockly JSON) URI. */
  defaults?: string;
}

export interface ExampleSetCatalog {
  version: 1;
  catalogUrl: string;
  sets: ExampleSet[];
}

export function parseExampleSetCatalog(text: string, catalogUrl: string): ExampleSetCatalog {
  const base = toFetchableUrl(catalogUrl);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Example-set catalog is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Example-set catalog must be a JSON object");
  }
  const raw = parsed as Record<string, unknown>;
  if (raw.version !== 1) {
    throw new Error(`Unsupported example-set catalog version: ${String(raw.version)}`);
  }
  if (!Array.isArray(raw.sets)) {
    throw new Error("Example-set catalog is missing a sets array");
  }

  const seen = new Set<string>();
  const sets: ExampleSet[] = [];
  for (const [index, item] of raw.sets.entries()) {
    const set = parseSet(item, base, index);
    if (seen.has(set.id)) {
      throw new Error(`Duplicate example-set id: ${set.id}`);
    }
    seen.add(set.id);
    sets.push(set);
  }

  return { version: 1, catalogUrl: base, sets };
}

function parseSet(item: unknown, catalogUrl: string, index: number): ExampleSet {
  const prefix = `sets[${index}]`;
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`${prefix} must be an object`);
  }
  const raw = item as Record<string, unknown>;
  const id = requiredString(raw.id, `${prefix}.id`);
  const title = requiredString(raw.title, `${prefix}.title`);
  const description = optionalString(raw.description, `${prefix}.description`);
  if (!raw.source || typeof raw.source !== "object" || Array.isArray(raw.source)) {
    throw new Error(`${prefix}.source must be an object`);
  }
  const sourceRaw = raw.source as Record<string, unknown>;
  const schema = resolveCatalogUri(
    requiredString(sourceRaw.schema, `${prefix}.source.schema`),
    catalogUrl,
  );
  if (!Array.isArray(sourceRaw.instances)) {
    throw new Error(`${prefix}.source.instances must be an array of URIs`);
  }
  const instances = sourceRaw.instances.map((entry, i) =>
    resolveCatalogUri(
      requiredString(entry, `${prefix}.source.instances[${i}]`),
      catalogUrl,
    )
  );
  const target = resolveCatalogUri(requiredString(raw.target, `${prefix}.target`), catalogUrl);
  const mapping = raw.mapping === undefined
    ? undefined
    : resolveCatalogUri(requiredString(raw.mapping, `${prefix}.mapping`), catalogUrl);
  const defaults = raw.defaults === undefined
    ? undefined
    : resolveCatalogUri(requiredString(raw.defaults, `${prefix}.defaults`), catalogUrl);

  return {
    id,
    title,
    ...(description ? { description } : {}),
    source: { schema, instances },
    target,
    ...(mapping ? { mapping } : {}),
    ...(defaults ? { defaults } : {}),
  };
}

export function resolveCatalogUri(ref: string, catalogUrl: string): string {
  const href = toFetchableUrl(ref, catalogUrl);
  assertHttpUrl(href);
  return href;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}
