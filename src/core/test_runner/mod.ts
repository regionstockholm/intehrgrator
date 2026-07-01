import type { MappingModel } from "../../types/mod.ts";
import type { TestResult } from "../../types/mod.ts";
import { evaluate, createSourceContext } from "../source/query_runtime.ts";
import { generateTypeScript } from "../codegen/mod.ts";

export function runTest(
  model: MappingModel,
  exampleContent: string,
  format: "json" | "xml",
  _generatedTs?: string,
): TestResult {
  const warnings: string[] = [];
  try {
    const ctx = createSourceContext(exampleContent, format);
    const slotValues: Record<string, unknown> = {};

    for (const slot of model.slots) {
      try {
        slotValues[slot.slotId] = evaluate(slot.expression, ctx, slot.returnType);
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
