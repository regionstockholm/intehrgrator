import { filenameFromUrl, toFetchableUrl } from "../../host/fetch_url.ts";
import { parseFunctionBundle } from "./bundle.ts";
import {
  parseFunctionLibraryCatalog,
  resolveFunctionLibraryUri,
} from "./catalog.ts";
import type { FunctionBundle, FunctionLibraryCatalog } from "./types.ts";

export interface FunctionLibraryLoadOptions {
  fetch?: typeof fetch;
  githubToken?: string;
}

export async function loadFunctionLibraryCatalog(
  catalogUrl: string,
  options?: FunctionLibraryLoadOptions,
): Promise<FunctionLibraryCatalog> {
  const text = await fetchText(catalogUrl, options);
  return parseFunctionLibraryCatalog(text, catalogUrl);
}

export async function loadFunctionLibraryEntry(
  catalog: FunctionLibraryCatalog,
  id: string,
  options?: FunctionLibraryLoadOptions,
): Promise<FunctionBundle> {
  const entry = catalog.functions.find((row) => row.id === id);
  if (!entry) {
    throw new Error(
      `Unknown Function library id "${id}". Known: ${catalog.functions.map((row) => row.id).join(", ")}`,
    );
  }
  const url = resolveFunctionLibraryUri(entry.file, catalog.catalogUrl);
  const text = await fetchText(url, options);
  return parseFunctionBundle(text);
}

async function fetchText(url: string, options?: FunctionLibraryLoadOptions): Promise<string> {
  const fetchable = url.startsWith("file:") ? url : toFetchableUrl(url);
  if (fetchable.startsWith("file:")) {
    return await Deno.readTextFile(new URL(fetchable));
  }
  const fetchFn = options?.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = { Accept: "application/json, text/plain" };
  if (options?.githubToken) headers.Authorization = `Bearer ${options.githubToken}`;
  const res = await fetchFn(fetchable, { headers });
  if (!res.ok) {
    throw new Error(
      `Could not load Function library ${filenameFromUrl(fetchable)} (${res.status} ${res.statusText})`,
    );
  }
  return await res.text();
}
