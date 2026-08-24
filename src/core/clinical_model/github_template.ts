/**
 * Load a GitHub clinical-model file (.t.json / .adl / .adls / .opt / .oet) and
 * resolve dependent archetypes from the same repo branch — same path as the
 * ehrtslib demo-app AD@git loader.
 */

import {
  ClinicalModelWorkspace,
  isOptXml,
  parseGitHubClinicalModelFileUrl,
} from "ehrtslib/parser/mod.ts";
import { OptXmlSerializer } from "ehrtslib/generation/opt_xml_serializer.ts";
import { buildWebTemplate } from "ehrtslib/serialization/simplified/web_template_builder.ts";
import { generateSkeletonFromOperational } from "../skeleton/generate_skeleton.ts";
import {
  availableWebTemplateLanguages,
  buildWebTemplateTermsIndex,
  orderLanguages,
} from "../skeleton/template_terms.ts";
import type { ClinicalModelFileset, SkeletonNode } from "../../types/mod.ts";

const CLINICAL_MODEL_URL_SUFFIX = /\.(t\.json|adl|adls|opt|oet)$/i;

export const DEFAULT_GITHUB_TEMPLATE_URL =
  "https://github.com/Ehrlibs/openEHR-model-examples/blob/main/local/theme-packs/sport-event-details/templates/Accident%20report%20including%20vital%20signs.t.json";

export interface GitHubClinicalModelLoadOptions {
  fetch?: typeof fetch;
  githubToken?: string;
  maxFiles?: number;
}

export interface GitHubClinicalModelLoadResult {
  sourceUrl: string;
  rootPath: string;
  filename: string;
  templateId: string;
  /** Self-contained OPT XML for project persistence (no GitHub needed on restore). */
  optXml: string;
  /** Web Template JSON for Source Schema trees. */
  webTemplateJson: string;
  skeleton: SkeletonNode[];
  language: string;
  languages: string[];
  warnings: string[];
  fetched: number;
  /** Full fetched file-set (`.t.json` + ADL/OPT) for Project Bundle round-trip. */
  fileset: ClinicalModelFileset;
}

export function isGitHubClinicalModelUrl(input: string): boolean {
  try {
    const ref = parseGitHubClinicalModelFileUrl(input);
    return CLINICAL_MODEL_URL_SUFFIX.test(ref.path);
  } catch {
    return false;
  }
}

export async function loadGitHubClinicalModel(
  sourceUrl: string,
  options?: GitHubClinicalModelLoadOptions & { language?: string },
): Promise<GitHubClinicalModelLoadResult> {
  const workspace = new ClinicalModelWorkspace();
  const closure = await workspace.loadFromGitHubClinicalModelUrl(sourceUrl, {
    fetch: options?.fetch,
    githubToken: options?.githubToken,
    maxFiles: options?.maxFiles,
  });
  const resolved = workspace.resolveOperational();
  const opt = resolved.operationalTemplate;
  const rootFile = workspace.getFile(closure.rootPath);
  const optXml = rootFile && isOptXml(rootFile.content)
    ? rootFile.content
    : new OptXmlSerializer().serialize(opt);
  const webTemplate = buildWebTemplate(opt, { defaultLanguage: options?.language });
  const generated = generateSkeletonFromOperational(
    opt,
    optXml,
    buildWebTemplateTermsIndex(webTemplate, options?.language),
    { language: options?.language },
  );
  const templateId = generated.templateId !== "unknown"
    ? generated.templateId
    : webTemplate.templateId || basename(closure.rootPath);
  const storedName = (closure.rootPath.split("/").pop() ?? closure.rootPath);
  const wtLanguages = availableWebTemplateLanguages(webTemplate);
  const languages = orderLanguages(
    options?.language ?? generated.language,
    [...generated.languages, ...wtLanguages],
  );
  const language = options?.language && languages.includes(options.language)
    ? options.language
    : (generated.language || languages[0] || "en");

  return {
    sourceUrl,
    rootPath: closure.rootPath,
    filename: storedName,
    templateId,
    optXml,
    webTemplateJson: JSON.stringify(webTemplate),
    skeleton: generated.skeleton,
    language,
    languages,
    warnings: [...closure.warnings, ...resolved.warnings, ...generated.warnings],
    fetched: closure.fetched,
    fileset: {
      sourceUrl,
      rootPath: closure.rootPath,
      files: workspace.listFiles().map((file) => ({
        path: file.path,
        content: file.content,
      })),
    },
  };
}

function basename(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
}
