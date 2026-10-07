/**
 * Better `.t.json` nests templates referenced by `templateId` (ChemoQ-*). Flattening
 * must resolve those via `ArchetypeRepository.getTemplate`, not only archetype ids.
 *
 * `deno task vendor` resets vendor/ehrtslib; apply this patch after each refresh.
 */
import { join } from "@std/path";

const MARKER = "INTEHR_TEMPLATE_ID_RESOLVE";

const RESOLVE_OLD = `  resolve(archetypeId: string): openehr_am.ARCHETYPE | undefined {
    return this.get(archetypeId);
  }`;

const RESOLVE_NEW = `  resolve(archetypeId: string): openehr_am.ARCHETYPE | undefined {
    // ${MARKER}: nested .t.json C_ARCHETYPE_ROOT refs use Better templateId keys.
    return this.get(archetypeId) ?? this.getTemplate(archetypeId);
  }`;

const INGEST_OLD = `    const id = template.archetype_id?.value ?? path;
    this.templates.set(id, template);
    const base = id.replace(/\\.v[\\d.]+$/, "");
    if (!this.templates.has(base)) this.templates.set(base, template);`;

const INGEST_NEW = `    const id = template.archetype_id?.value ?? path;
    for (const key of this.templateLookupKeys(template, path)) {
      this.registerTemplate(key, template);
    }`;

const HELPERS = `
  /** Better \`.t.json\` refs use \`templateId\` (e.g. ChemoQ-fatigue), not only openEHR archetype ids. */
  private templateLookupKeys(
    template: openehr_am.TEMPLATE,
    path: string,
  ): string[] {
    const keys = new Set<string>();
    const archId = template.archetype_id?.value;
    if (archId) keys.add(archId);
    const tplId = (template as { template_id?: string }).template_id?.trim();
    if (tplId) keys.add(tplId);
    const base = (path.split("/").pop() ?? path).replace(/\\.t\\.json$/i, "");
    if (base) keys.add(base);
    return [...keys];
  }

  private registerTemplate(id: string, template: openehr_am.TEMPLATE): void {
    this.templates.set(id, template);
    const base = id.replace(/\\.v[\\d.]+$/, "");
    if (!this.templates.has(base)) this.templates.set(base, template);
  }
`;

const ADL_TEMPLATE_OLD = `    if (parsed.kind === "template" && parsed.template) {
      const id = parsed.template.archetype_id?.value ?? path;
      this.templates.set(id, parsed.template);
      const base = id.replace(/\\.v[\\d.]+$/, "");
      if (!this.templates.has(base)) this.templates.set(base, parsed.template);
      return { path, kind: "template", archetypeId: id };
    }`;

const ADL_TEMPLATE_NEW = `    if (parsed.kind === "template" && parsed.template) {
      const id = parsed.template.archetype_id?.value ?? path;
      for (const key of this.templateLookupKeys(parsed.template, path)) {
        this.registerTemplate(key, parsed.template);
      }
      return { path, kind: "template", archetypeId: id };
    }`;

export async function patchEhrtslibArchetypeRepository(): Promise<void> {
  const path = join(Deno.cwd(), "vendor/ehrtslib/parser/legacy/archetype_repository.ts");
  let text = await Deno.readTextFile(path);
  if (text.includes(MARKER)) {
    console.log("ehrtslib archetype_repository templateId resolve already patched");
    return;
  }

  if (!text.includes(RESOLVE_OLD)) {
    throw new Error(
      `ehrtslib archetype_repository resolve() patch anchor missing in ${path}`,
    );
  }
  text = text.replace(RESOLVE_OLD, RESOLVE_NEW);

  if (!text.includes(INGEST_OLD)) {
    throw new Error(
      `ehrtslib archetype_repository ingestTemplateJson patch anchor missing in ${path}`,
    );
  }
  text = text.replace(INGEST_OLD, INGEST_NEW);

  if (!text.includes("private templateLookupKeys")) {
    const anchor = "  private ingestParseResult(path: string, parsed: ParseAdlResult): LoadFileResult {";
    if (!text.includes(anchor)) {
      throw new Error(`ehrtslib archetype_repository helper insert anchor missing in ${path}`);
    }
    text = text.replace(anchor, `${HELPERS}\n${anchor}`);
  }

  if (!text.includes(ADL_TEMPLATE_NEW.trim().slice(0, 40))) {
    if (!text.includes(ADL_TEMPLATE_OLD)) {
      throw new Error(
        `ehrtslib archetype_repository ADL template ingest patch anchor missing in ${path}`,
      );
    }
    text = text.replace(ADL_TEMPLATE_OLD, ADL_TEMPLATE_NEW);
  }

  await Deno.writeTextFile(path, text);
  console.log("Patched ehrtslib archetype_repository nested templateId resolve");
}

if (import.meta.main) {
  await patchEhrtslibArchetypeRepository();
}
