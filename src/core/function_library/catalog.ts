import { assertHttpUrl, toFetchableUrl } from "../../host/fetch_url.ts";
import type { FunctionLibraryCatalog, FunctionLibraryEntry } from "./types.ts";

export const BUNDLED_FUNCTION_LIBRARY_PATH = "function-library/catalog.json";

export const DEFAULT_GITHUB_FUNCTION_LIBRARY_URL =
  "https://github.com/regionstockholm/intehrgrator/blob/main/function-library/catalog.json";

export function parseFunctionLibraryCatalog(
  text: string,
  catalogUrl: string,
): FunctionLibraryCatalog {
  const base = toFetchableUrl(catalogUrl);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Function library catalog is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Function library catalog must be a JSON object");
  }
  const raw = parsed as Record<string, unknown>;
  if (raw.version !== 1) {
    throw new Error(`Unsupported Function library catalog version: ${String(raw.version)}`);
  }
  if (!Array.isArray(raw.functions)) {
    throw new Error("Function library catalog is missing a functions array");
  }
  const seen = new Set<string>();
  const functions: FunctionLibraryEntry[] = [];
  for (const [index, item] of raw.functions.entries()) {
    const entry = parseEntry(item, base, index);
    if (seen.has(entry.id)) throw new Error(`Duplicate Function library id: ${entry.id}`);
    seen.add(entry.id);
    functions.push(entry);
  }
  return { version: 1, catalogUrl: base, functions };
}

export function resolveFunctionLibraryUri(ref: string, catalogUrl: string): string {
  const href = toFetchableUrl(ref, catalogUrl);
  const parsed = new URL(href);
  if (parsed.protocol === "file:") return href;
  assertHttpUrl(href);
  return href;
}

function parseEntry(item: unknown, catalogUrl: string, index: number): FunctionLibraryEntry {
  const prefix = `functions[${index}]`;
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`${prefix} must be an object`);
  }
  const raw = item as Record<string, unknown>;
  const id = requiredString(raw.id, `${prefix}.id`);
  const name = requiredString(raw.name, `${prefix}.name`);
  const title = requiredString(raw.title, `${prefix}.title`);
  const description = requiredString(raw.description, `${prefix}.description`);
  const file = resolveFunctionLibraryUri(
    requiredString(raw.file, `${prefix}.file`),
    catalogUrl,
  );
  return {
    id,
    name,
    title,
    description,
    file,
    locale: optionalString(raw.locale),
    parameters: optionalStringArray(raw.parameters, `${prefix}.parameters`),
    hasReturn: typeof raw.hasReturn === "boolean" ? raw.hasReturn : undefined,
    returns: optionalString(raw.returns),
    decisionTables: optionalStringArray(raw.decisionTables, `${prefix}.decisionTables`),
  };
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${path} must be an array of strings`);
  return value.map((item, i) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(`${path}[${i}] must be a non-empty string`);
    }
    return item.trim();
  });
}
