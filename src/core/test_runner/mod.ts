import type {
  MappingLoop,
  MappingModel,
  OpenEhrJsonDeserializeMode,
  OutputMode,
  SourceFormatId,
  TestResult,
} from "../../types/mod.ts";
import {
  isConversionScriptLanguage,
  unimplementedTestRunMessage,
} from "../../types/mod.ts";
import { getSourceFormatHandler } from "../source/format_handler.ts";
import { collectJsonNodes, type SourceContext } from "../source/query_runtime.ts";
import { expressionUsesRelativeSourcePath } from "../mapping_model/loops.ts";
import {
  collectAllSlotIds,
  findSkeletonTrail,
} from "../skeleton/generate_skeleton.ts";
import { generate, generateTypeScript } from "../codegen/mod.ts";
import {
  runGeneratedTypeScript,
  serializedConversionOutput,
} from "../codegen/run_typescript.ts";
import {
  getTargetFormatHandler,
  type TargetDefinition,
} from "../target/mod.ts";
import { renderHandlebars } from "../output/handlebars_dialect.ts";
import { executeGoTemplate, isGoTemplateWasmLoaded } from "../output/go_template_runtime.ts";
import { DEFAULTS_MAP_NAME, namedMapsFromBlocklyState } from "../defaults/mod.ts";
import { sheetsToBag } from "../sheets/mod.ts";
import { validateConvertedOutput } from "../output/template_validation.ts";

export interface RunTestOptions {
  target?: TargetDefinition | null;
  /** Session Output mode. TypeScript executes Generated Export. */
  outputMode?: OutputMode;
  /** Generated Conversion Script text (TypeScript / Go Template Output mode). */
  generatedCode?: string;
  handlebarsTemplate?: string;
  /** Blockly workspace JSON used to materialize the Defaults Map. */
  blocklyState?: unknown;
  /** Template Skeleton for Blockly canvas codegen (Go template / TypeScript). */
  skeleton?: import("../../types/mod.ts").SkeletonNode[];
  /** Convert-time Defaults Map overlay (wins over Blockly named `defaults`). */
  defaults?: Record<string, unknown>;
  /** Convert-time named Sheets (ADR 0005). */
  sheets?: import("../sheets/types.ts").SheetDocument[];
  /** ehrtslib JSON deserializer preset for openEHR template validation. */
  openEhrJsonDeserializeMode?: OpenEhrJsonDeserializeMode;
}

export function runTest(
  model: MappingModel,
  exampleContent: string,
  format: SourceFormatId,
  options: RunTestOptions = {},
): TestResult {
  const warnings: string[] = [];
  const mode = options.outputMode ?? "preview";
  if (isConversionScriptLanguage(mode) && mode !== "typescript" && mode !== "handlebars" && mode !== "go-template") {
    const message = unimplementedTestRunMessage(mode);
    return {
      ok: false,
      output: message,
      error: message.trim(),
      warnings,
    };
  }
  try {
    const handler = getSourceFormatHandler(format);
    const ctx = handler.createContext(exampleContent);
    const fromContext = ctx.namedMaps ?? {};
    const fromBlockly = namedMapsFromBlocklyState(options.blocklyState);
    ctx.namedMaps = { ...fromContext, ...fromBlockly };
    ctx.namedMaps[DEFAULTS_MAP_NAME] = {
      ...(fromContext[DEFAULTS_MAP_NAME] ?? {}),
      ...(fromBlockly[DEFAULTS_MAP_NAME] ?? {}),
      ...(options.defaults ?? {}),
    };
    const defaults = ctx.namedMaps[DEFAULTS_MAP_NAME] ?? {};
    ctx.sheets = { ...ctx.sheets, ...sheetsToBag(options.sheets ?? []) };

    if (mode === "typescript") {
      const code = options.generatedCode ?? generateTypeScript(model, {
        handlebarsTemplate: options.handlebarsTemplate,
        blocklyState: options.blocklyState,
        skeleton: options.target?.skeleton,
      });
      const raw = runGeneratedTypeScript(code, {
        format,
        data: ctx.data,
      }, defaults, undefined, ctx.sheets);
      const output = serializedConversionOutput(raw);
      const outputValidation = validateConvertedOutput(output, options.target, {
      deserializeMode: options.openEhrJsonDeserializeMode,
    });
      return {
        ok: warnings.length === 0,
        output,
        warnings,
        outputValidation,
      };
    }

    if (mode === "handlebars") {
      const template = options.handlebarsTemplate ?? options.target?.content ?? "";
      if (!template.trim()) {
        return {
          ok: false,
          output: "// No Handlebars template provided.\n",
          error: "No Handlebars template provided.",
          warnings,
        };
      }
      const slotValues = evaluateSlotValues(model, handler, ctx, warnings, options.target?.skeleton ?? []);
      const output = renderHandlebars(template, ctx.data, { slots: slotValues });
      const outputValidation = validateConvertedOutput(output, options.target, {
        deserializeMode: options.openEhrJsonDeserializeMode,
      });
      return {
        ok: warnings.length === 0,
        output,
        warnings,
        outputValidation,
      };
    }

    if (mode === "go-template") {
      const code = options.generatedCode?.trim()
        ? options.generatedCode
        : generate(model, "go-template", {
          blocklyState: options.blocklyState,
          skeleton: options.skeleton ?? options.target?.skeleton,
        });
      if (!code.trim() || code.split("\n").every((line) => line.startsWith("{{- /*") || !line.trim())) {
        return {
          ok: false,
          output: "// No Go template code generated. Map a Conversion start product on the Blockly canvas.\n",
          error: "No Go template code generated.",
          warnings,
        };
      }
      if (!isGoTemplateWasmLoaded()) {
        return {
          ok: false,
          output: `// Go template WASM runtime is not loaded.\n// Generated script:\n${code}`,
          error: "Go template WASM runtime is not loaded.",
          warnings,
        };
      }
      const envelope = {
        Parameters: defaults,
        Data: ctx.data,
      };
      try {
        const output = executeGoTemplate(code, envelope);
        return { ok: true, output, warnings };
      } catch (e) {
        const output = `// Go template execution error: ${e instanceof Error ? e.message : String(e)}\n` +
          `// Generated script:\n${code}`;
        return { ok: false, output, error: e instanceof Error ? e.message : String(e), warnings };
      }
    }

    const slotValues = evaluateSlotValues(
      model,
      handler,
      ctx,
      warnings,
      options.target?.skeleton ?? [],
    );

    let output: unknown;
    if (options.target?.format === "free-form") {
      const template = options.handlebarsTemplate ?? options.target?.content ?? "";
      output = renderHandlebars(template, ctx.data, { slots: slotValues });
    } else if (options.target) {
      output = getTargetFormatHandler(options.target.format).render({
        definition: options.target,
        slotValues,
      });
    } else {
      output = {
        templateId: model.templateId,
        slots: slotValues,
      };
    }

    const outputValidation = validateConvertedOutput(output, options.target, {
      deserializeMode: options.openEhrJsonDeserializeMode,
    });
    return {
      ok: warnings.length === 0,
      output,
      warnings,
      outputValidation,
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
