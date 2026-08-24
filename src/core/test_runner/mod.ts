import type {
  ExportTarget,
  MappingLoop,
  MappingModel,
  SourceFormatId,
  TestResult,
} from "../../types/mod.ts";
import { getSourceFormatHandler } from "../source/format_handler.ts";
import { collectJsonNodes, type SourceContext } from "../source/query_runtime.ts";
import { expressionUsesRelativeSourcePath } from "../mapping_model/loops.ts";
import {
  collectAllSlotIds,
  findSkeletonTrail,
} from "../skeleton/generate_skeleton.ts";
import { generateTypeScript } from "../codegen/mod.ts";
import {
  getTargetFormatHandler,
  type TargetDefinition,
} from "../target/mod.ts";
import { renderHandlebars } from "../output/handlebars_dialect.ts";
import { namedMapsFromBlocklyState } from "../defaults/mod.ts";

export interface RunTestOptions {
  target?: TargetDefinition | null;
  exportTarget?: ExportTarget;
  handlebarsTemplate?: string;
  /** Blockly workspace JSON used to materialize the Defaults Map. */
  blocklyState?: unknown;
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
    ctx.namedMaps = namedMapsFromBlocklyState(options.blocklyState);
    const slotValues = evaluateSlotValues(
      model,
      handler,
      ctx,
      warnings,
      options.target?.skeleton ?? [],
    );

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

    // `output` is the target-shaped artifact. Slot values are interpolated
    // into it by the format handler (DV_* fields, JSON properties, XML, …).
    //
    // Do not graft a `slots` map onto openEHR COMPOSITION JSON — that is not
    // an RM attribute and must not appear in Test Run / Better Form output.
    // For non-openEHR object targets, keep `output` pristine and expose the
    // evaluated slot map only on the deprecated `composition` alias.
    const composition = (() => {
      const isRenderableObject = output && typeof output === "object" && !Array.isArray(output);
      if (!isRenderableObject) return output;
      if (!options.target || options.target.format === "openehr-template") return output;
      return { ...(output as Record<string, unknown>), slots: slotValues };
    })();

    return {
      ok: warnings.length === 0,
      output,
      composition,
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

function evaluateSlotValues(
  model: MappingModel,
  handler: ReturnType<typeof getSourceFormatHandler>,
  ctx: SourceContext,
  warnings: string[],
  skeleton: TargetDefinition["skeleton"],
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  const handled = new Set<string>();
  if (skeleton.length && model.loops?.length && ctx.kind === "json") {
    for (const loop of model.loops) {
      evaluateLoopSlots(model, loop, handler, ctx, skeleton, values, handled, warnings);
    }
  }
  for (const slot of model.slots) {
    if (handled.has(slot.slotId)) continue;
    try {
      values[slot.slotId] = handler.evaluate(slot.expression, ctx, slot.returnType);
    } catch (e) {
      warnings.push(
        `${slot.slotId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return values;
}

function evaluateLoopSlots(
  model: MappingModel,
  loop: MappingLoop,
  handler: ReturnType<typeof getSourceFormatHandler>,
  ctx: SourceContext,
  skeleton: TargetDefinition["skeleton"],
  values: Record<string, unknown>,
  handled: Set<string>,
  warnings: string[],
): void {
  const trail = findSkeletonTrail(skeleton, loop.attachSlotId);
  const container = trail.at(-1);
  if (!container) return;
  const ids = new Set(collectAllSlotIds([container]));
  const nodes = collectJsonNodes(loop.path, ctx.json);
  for (const slot of model.slots) {
    if (!ids.has(slot.slotId) || !expressionUsesRelativeSourcePath(slot.expression)) {
      continue;
    }
    handled.add(slot.slotId);
    try {
      values[slot.slotId] = nodes.map((node) =>
        handler.evaluate(slot.expression, {
          ...ctx,
          json: node,
          data: node,
          vars: { ...(ctx.vars ?? {}), [loop.varName]: node },
          namedMaps: ctx.namedMaps,
        }, slot.returnType)
      );
    } catch (e) {
      warnings.push(
        `${slot.slotId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
