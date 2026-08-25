import { returnTypeForDv } from "../core/rm_mandatory.ts";
import { isDataValueType } from "../core/rm_meta.ts";

/** Blockly Zelos connection check for a mapping return type (`string` | `number` | `boolean`). */
export function blocklyCheckForReturnType(returnType: string): string | null {
  switch (returnType) {
    case "string":
      return "String";
    case "number":
      return "Number";
    case "boolean":
      return "Boolean";
    case "node":
    case "source":
      return "Source";
    default:
      return null;
  }
}

/**
 * Connection check for ELEMENT.value — accepts the concrete DV_* shell
 * (and CODE_PHRASE where relevant), not raw expression primitives.
 */
export function blocklyCheckForDv(rmType: string): string | string[] | null {
  if (!rmType) return ["DATA_VALUE"];
  if (rmType === "DATA_VALUE" || rmType === "DV_TEXT") {
    // DV_CODED_TEXT is a DV_TEXT subtype — allow both
    return rmType === "DV_TEXT" ? ["DV_TEXT", "DV_CODED_TEXT"] : ["DATA_VALUE"];
  }
  if (isDataValueType(rmType) || rmType === "CODE_PHRASE") {
    return [rmType];
  }
  // Fallback for unknown: keep legacy primitive check for tests that still expect it
  const primitive = blocklyCheckForReturnType(returnTypeForDv(rmType));
  return primitive ? [primitive] : null;
}
