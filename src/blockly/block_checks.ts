import { returnTypeForDv } from "../core/rm_mandatory.ts";

/** Blockly Zelos connection check for a mapping return type (`string` | `number` | `boolean`). */
export function blocklyCheckForReturnType(returnType: string): string | null {
  switch (returnType) {
    case "string":
      return "String";
    case "number":
      return "Number";
    case "boolean":
      return "Boolean";
    default:
      return null;
  }
}

/** Blockly Zelos connection check for a target `DV_*` / `CODE_PHRASE` rm type. */
export function blocklyCheckForDv(rmType: string): string | null {
  return blocklyCheckForReturnType(returnTypeForDv(rmType));
}
