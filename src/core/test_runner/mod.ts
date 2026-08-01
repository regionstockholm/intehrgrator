import type { MappingModel, SourceFormatId, TestResult } from "../../types/mod.ts";
import { getSourceFormatHandler } from "../source/format_handler.ts";
import { generateTypeScript } from "../codegen/mod.ts";

export function runTest(
  model: MappingModel,
  exampleContent: string,
  format: SourceFormatId,
  _generatedTs?: string,
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

    const composition = {
      _type: "COMPOSITION",
      templateId: model.templateId,
      slots: slotValues,
      note: "Test Run preview — slot values evaluated against active example",
    };

    return { ok: warnings.length === 0, composition, warnings };
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
