/**
 * Loads official openEHR terminology XML from ehrtslib.
 * Deno tests/read the vendor files; the web bundle inlines them (see scripts/build.ts).
 */
export function openEhrTerminologyXml(): { en: string; ext: string } {
  const dir = new URL("../../vendor/ehrtslib/terminology_data/", import.meta.url);
  return {
    en: Deno.readTextFileSync(new URL("openehr_terminology_en.xml", dir)),
    ext: Deno.readTextFileSync(new URL("openehr_external_terminologies.xml", dir)),
  };
}
