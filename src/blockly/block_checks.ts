import { returnTypeForDv } from "../core/rm_mandatory.ts";
import { isAbstractType, isDataValueType, subtypesOf } from "../core/rm_meta.ts";

/** Flatten nested Blockly `setCheck` arrays (`[["DV_TEXT"], "Array"]` → strings). */
export function flattenBlocklyCheck(check: unknown): string[] {
  if (check == null) return [];
  if (typeof check === "string") return check ? [check] : [];
  if (Array.isArray(check)) return check.flatMap((item) => flattenBlocklyCheck(item));
  return [];
}

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
  if (rmType === "DATA_VALUE") return ["DATA_VALUE"];
  if (isDataValueType(rmType) || rmType === "CODE_PHRASE") {
    const types = new Set<string>([rmType]);
    if (rmType === "DV_TEXT" || isAbstractType(rmType)) {
      for (const sub of subtypesOf(rmType, { concreteOnly: true })) types.add(sub);
    }
    return [...types];
  }
  // Fallback for unknown RM types: treat as a mapping primitive.
  const primitive = blocklyCheckForReturnType(returnTypeForDv(rmType));
  return primitive ? [primitive] : null;
}

/**
 * Output type(s) for a DV_* block. Always include `DATA_VALUE` so shells can
 * reconnect to a generic ELEMENT.value slot during Blockly serialization
 * (init sets check to DATA_VALUE before per-slot configureElementValueSlot).
 * Subtype shells also advertise ancestors (DV_CODED_TEXT → DV_TEXT mouths).
 * Do not advertise subtypes on ancestor shells (DV_TEXT must not light up a
 * DV_CODED_TEXT-only slot).
 */
export function blocklyOutputForDv(rmType: string): string | string[] | null {
  if (!rmType) return ["DATA_VALUE"];
  if (rmType === "DATA_VALUE") return "DATA_VALUE";
  const types: string[] = [];
  if (isDataValueType(rmType) || rmType === "CODE_PHRASE") {
    types.push(rmType);
    if (rmType === "DV_CODED_TEXT") types.push("DV_TEXT");
    if (isDataValueType(rmType) && rmType !== "CODE_PHRASE") types.push("DATA_VALUE");
    return types.length === 1 ? types[0]! : types;
  }
  const primitive = blocklyCheckForReturnType(returnTypeForDv(rmType));
  return primitive;
}
