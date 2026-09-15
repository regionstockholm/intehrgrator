/**
 * Execute a Handlebars Conversion Script in-process.
 *
 * Conversion Test Run uses the same text as Generated conversion script(s):
 * the authored Handlebars Template when present, otherwise the generated
 * slot template from `generateHandlebars`. Runtime is Kintegrate-compatible
 * Handlebars (`Handlebars.compile` via `renderHandlebars`).
 */

import type { MappingModel } from "../../types/mod.ts";
import { generateHandlebars } from "./mod.ts";
import { renderHandlebars } from "../output/handlebars_dialect.ts";

export interface HandlebarsRunOptions {
  generatedCode?: string;
  handlebarsTemplate?: string;
  targetContent?: string;
}

/** Prefer pane text, then authored template, then generated slot template. */
export function resolveHandlebarsConversionTemplate(
  model: MappingModel,
  options: HandlebarsRunOptions = {},
): string {
  if (options.generatedCode?.trim()) return options.generatedCode;
  return generateHandlebars(model, {
    handlebarsTemplate: options.handlebarsTemplate ?? options.targetContent ?? "",
  });
}

/** True when the template has no executable body (blank or comments only). */
export function isEmptyHandlebarsTemplate(source: string): boolean {
  const stripped = source
    .replace(/\{\{!--[\s\S]*?--\}\}/g, "")
    .replace(/\{\{![\s\S]*?\}\}/g, "")
    .trim();
  return stripped.length === 0;
}

export function runGeneratedHandlebars(
  templateSource: string,
  sourceData: unknown,
  slots: Record<string, unknown> = {},
): string {
  return renderHandlebars(templateSource, sourceData, { slots });
}
