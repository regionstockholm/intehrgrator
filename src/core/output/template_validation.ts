/**
 * Conversion Test Run Output validation against an openEHR operational template.
 */

import { parseTemplateInput } from "ehrtslib/parser/mod.ts";
import {
  parseWebTemplate,
  webTemplateToOpt,
} from "ehrtslib/serialization/simplified/mod.ts";
import { JsonCanonicalDeserializer } from "ehrtslib/serialization/json/mod.ts";
import { TemplateValidator } from "ehrtslib/validation/mod.ts";
import type { OutputValidation } from "../../types/mod.ts";
import type { TargetDefinition } from "../target/mod.ts";

const validator = new TemplateValidator({
  failFast: false,
  validateUnits: false,
  validateTerminology: true,
  validateRMSpecification: true,
  validateInvariants: true,
});

export function notApplicableOutputValidation(): OutputValidation {
  return { applicable: false, valid: true, messages: [] };
}

export function validateConvertedOutput(
  output: unknown,
  target: TargetDefinition | null | undefined,
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
    const rmInstance = asRmInstance(output);
    const result = validator.validate(rmInstance, opt);
    const messages = [...result.errors, ...result.warnings].map((msg) => ({
      path: msg.path || "/",
      message: msg.message,
      severity: msg.severity,
    }));
    return {
      applicable: true,
      valid: result.valid && result.errors.length === 0,
      messages,
    };
  } catch (err) {
    return {
      applicable: true,
      valid: false,
      messages: [{
        path: "/",
        message: err instanceof Error ? err.message : String(err),
        severity: "error",
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

function asRmInstance(output: unknown): unknown {
  if (looksLikeRmInstance(output)) return output;
  return new JsonCanonicalDeserializer().deserialize(JSON.stringify(output));
}

function looksLikeRmInstance(value: unknown): boolean {
  if (value == null || typeof value !== "object") return false;
  const ctor = (value as { constructor?: { name?: string } }).constructor?.name;
  return typeof ctor === "string" && ctor !== "Object" && ctor !== "Array";
}
