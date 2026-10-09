/**
 * Official openEHR terminology XML from the pinned ehrtslib release.
 * Tests fetch it; the web bundle inlines the same files (see scripts/build.ts).
 */
import { fetchEhrtslibTerminologyXml } from "./ehrtslib_cdn.ts";

const xml = await fetchEhrtslibTerminologyXml();

export function openEhrTerminologyXml(): { en: string; ext: string } {
  return xml;
}
