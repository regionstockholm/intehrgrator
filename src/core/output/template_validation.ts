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
import { XmlDeserializer } from "ehrtslib/serialization/xml/mod.ts";
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
  if (output == null) {
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
  if (typeof output === "string") {
    const trimmed = output.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        output = JSON.parse(trimmed) as unknown;
      } catch {
        return notApplicableOutputValidation();
      }
    } else if (trimmed.startsWith("<")) {
      try {
        ensureRmTypeRegistry();
        output = new XmlDeserializer().deserialize(trimmed);
      } catch {
        return notApplicableOutputValidation();
      }
    } else {
      return notApplicableOutputValidation();
    }
  }
  if (typeof output !== "object") {
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

/** Kinds used to split Simple-vitals ⚠ from a real mapping miss (#171). */
export type OpenEhrValidationKind =
  | "required-missing"
  | "unit-list"
  | "type-mismatch"
  | "code-phrase"
  | "archetype-sibling"
  | "other";

export function classifyOpenEhrValidationMessage(message: string): OpenEhrValidationKind {
  const m = message.toLowerCase();
  if (
    m.includes("required attribute missing") ||
    /\(min:\s*1\)/.test(m) ||
    (m.includes("mandatory") && m.includes("missing"))
  ) {
    return "required-missing";
  }
  if (
    m.includes("c_dv_quantity") ||
    (m.includes("unit") &&
      (m.includes("list") || m.includes("not in") || m.includes("not allowed") ||
        m.includes("constraint")))
  ) {
    return "unit-list";
  }
  if (m.includes("type mismatch") || (m.includes("cluster") && m.includes("element"))) {
    return "type-mismatch";
  }
  if (
    m.includes("code_phrase") ||
    m.includes("code phrase") ||
    m.includes("terminology") ||
    m.includes("defining_code")
  ) {
    return "code-phrase";
  }
  // ehrtslib matches sibling C_ARCHETYPE_ROOT children by RM type only, so
  // the first OBSERVATION/CLUSTER constraint is used for every sibling.
  if (m.includes("does not match template archetype")) return "archetype-sibling";
  return "other";
}
