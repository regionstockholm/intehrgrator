/**
 * Conversion Test Run Output validation against an openEHR operational template.
 */

import { parseTemplateInput } from "ehrtslib/parser/mod.ts";
import * as rm from "ehrtslib/openehr_rm.ts";
import {
  parseWebTemplate,
  webTemplateToOpt,
} from "ehrtslib/serialization/simplified/mod.ts";
import { TypeRegistry } from "ehrtslib/serialization/common/type_registry.ts";
import { JsonConfigurableDeserializer } from "ehrtslib/serialization/json/mod.ts";
import { TemplateValidator } from "ehrtslib/validation/mod.ts";
import type { OpenEhrJsonDeserializeMode, OutputValidation } from "../../types/mod.ts";
import type { TargetDefinition } from "../target/mod.ts";
import { jsonDeserializationConfigForMode } from "./json_deserialize_config.ts";
import {
  lineNumberForDeserializeError,
  lineNumberForRmPath,
} from "./json_line_lookup.ts";

let rmTypeRegistryReady = false;

/** JsonConfigurableDeserializer requires RM classes registered on TypeRegistry first. */
function ensureRmTypeRegistry(): void {
  if (rmTypeRegistryReady) return;
  TypeRegistry.registerModule(rm as Record<string, unknown>);
  rmTypeRegistryReady = true;
}

const validator = new TemplateValidator({
  failFast: false,
  validateUnits: false,
  validateTerminology: true,
  validateRMSpecification: true,
  validateInvariants: true,
});

export interface ValidateConvertedOutputOptions {
  deserializeMode?: OpenEhrJsonDeserializeMode;
}

export function notApplicableOutputValidation(): OutputValidation {
  return { applicable: false, valid: true, messages: [] };
}

export function validateConvertedOutput(
  output: unknown,
  target: TargetDefinition | null | undefined,
  options: ValidateConvertedOutputOptions = {},
): OutputValidation {
  if (!target || target.format !== "openehr-template") {
    return notApplicableOutputValidation();
  }
  if (output == null || typeof output === "string") {
    return {
      applicable: true,
      valid: false,
      messages: [{
        path: "/",
        message: "Conversion Test Run did not produce an openEHR COMPOSITION object",
        severity: "error",
      }],
    };
  }
  const jsonText = JSON.stringify(output, null, 2);
  const deserializeMode = options.deserializeMode ?? "hybrid";
  try {
    const opt = operationalTemplateFromTarget(target);
    if (!opt) {
      return {
        applicable: true,
        valid: false,
        messages: [{
          path: "/",
          message: "Could not parse the loaded target as an operational template",
          severity: "error",
        }],
      };
    }
    const rmInstance = asRmInstance(output, jsonText, deserializeMode);
    const result = validator.validate(rmInstance, opt);
    const messages = [...result.errors, ...result.warnings].map((msg) => ({
      path: msg.path || "/",
      message: msg.message,
      severity: msg.severity,
      line: lineNumberForRmPath(jsonText, msg.path || "/"),
    }));
    return {
      applicable: true,
      valid: result.valid && result.errors.length === 0,
      messages,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      applicable: true,
      valid: false,
      messages: [{
        path: "/",
        message,
        severity: "error",
        line: lineNumberForDeserializeError(jsonText, message),
      }],
    };
  }
}

function operationalTemplateFromTarget(target: TargetDefinition): unknown {
  const content = target.content?.trim() ?? "";
  if (!content) return null;
  if (content.startsWith("{")) {
    return webTemplateToOpt(parseWebTemplate(content));
  }
  return parseTemplateInput(content).operationalTemplate ?? null;
}

function asRmInstance(
  output: unknown,
  jsonText: string,
  mode: OpenEhrJsonDeserializeMode,
): unknown {
  if (looksLikeRmInstance(output)) return output;
  ensureRmTypeRegistry();
  const config = jsonDeserializationConfigForMode(mode);
  return new JsonConfigurableDeserializer(config).deserialize(jsonText);
}

function looksLikeRmInstance(value: unknown): boolean {
  if (value == null || typeof value !== "object") return false;
  const ctor = (value as { constructor?: { name?: string } }).constructor?.name;
  return typeof ctor === "string" && ctor !== "Object" && ctor !== "Array";
}
