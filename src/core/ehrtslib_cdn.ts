/**
 * ehrtslib is loaded from the jsDelivr URL pinned in deno.json (`ehrtslib/`).
 * Terminology XML is fetched from that same prefix; the web build inlines it.
 */
import { dirname, fromFileUrl, join } from "@std/path";

export function ehrtslibCdnPrefix(): string {
  const denoJsonPath = join(dirname(fromFileUrl(import.meta.url)), "..", "..", "deno.json");
  const denoJson = JSON.parse(Deno.readTextFileSync(denoJsonPath)) as {
    imports?: Record<string, string>;
  };
  const prefix = denoJson.imports?.["ehrtslib/"];
  if (typeof prefix !== "string" || !prefix.startsWith("https://")) {
    throw new Error(
      `deno.json imports["ehrtslib/"] must be the jsDelivr release prefix, got ${String(prefix)}`,
    );
  }
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

export async function fetchEhrtslibText(relativePath: string): Promise<string> {
  const url = new URL(relativePath, ehrtslibCdnPrefix());
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url.href} failed (${res.status})`);
  }
  return await res.text();
}

export async function fetchEhrtslibTerminologyXml(): Promise<{ en: string; ext: string }> {
  const [en, ext] = await Promise.all([
    fetchEhrtslibText("terminology_data/openehr_terminology_en.xml"),
    fetchEhrtslibText("terminology_data/openehr_external_terminologies.xml"),
  ]);
  return { en, ext };
}
