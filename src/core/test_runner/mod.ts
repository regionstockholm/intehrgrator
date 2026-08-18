import type {
  ExportTarget,
  MappingModel,
  SourceFormatId,
  TestResult,
} from "../../types/mod.ts";
import { getSourceFormatHandler } from "../source/format_handler.ts";
import { generateTypeScript } from "../codegen/mod.ts";
import {
  getTargetFormatHandler,
  type TargetDefinition,
} from "../target/mod.ts";
import { renderHandlebars } from "../output/handlebars_dialect.ts";

export interface RunTestOptions {
  target?: TargetDefinition | null;
  exportTarget?: ExportTarget;
  handlebarsTemplate?: string;
}

export function runTest(
  model: MappingModel,
  exampleContent: string,
  format: SourceFormatId,
  options: RunTestOptions = {},
): TestResult {
  const warnings: string[] = [];
  try {
    const handler = getSourceFormatHandler(format);
    const ctx = handler.createContext(exampleContent);
    const slotValues: Record<string, unknown> = {};

    for (const slot of model.slots) {
      try {
        slotValues[slot.slotId] = handler.evaluate(slot.expression, ctx, slot.returnType);
      } catch (e) {
        warnings.push(
          `${slot.slotId}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    let output: unknown;
    if (options.exportTarget === "handlebars") {
      const template = options.handlebarsTemplate ?? options.target?.content ?? "";
      output = renderHandlebars(template, ctx.data, { slots: slotValues });
    } else if (options.target) {
      output = getTargetFormatHandler(options.target.format).render({
        definition: options.target,
        slotValues,
      });
    } else {
      output = {
        _type: "COMPOSITION",
        templateId: model.templateId,
        slots: slotValues,
        note: "Legacy Test Run preview — no Target Definition supplied",
      };
    }

    return {
      ok: warnings.length === 0,
      output,
      composition: output,
      warnings,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      warnings,
    };
  }
}

export function previewGeneratedCode(model: MappingModel): string {
  return generateTypeScript(model);
}
