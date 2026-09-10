/**
 * Verifiable Mapping Subset (#35 / #37).
 * Remove-list types stay registered so old Example Sets load; they are not IR.
 */

export const VMS_REMOVED_BLOCK_TYPES = [
  "controls_whileUntil",
  "controls_repeat_ext",
  "controls_for",
  "controls_forEach",
  "controls_flow_statements",
  "controls_if",
  "math_random_int",
  "math_random_float",
  "text_print",
  "lists_setIndex",
  "lists_repeat",
  "sheet_set_cell",
  "sheet_set_xy",
  "sheet_set_row",
  "sheet_set_column",
  "sheet_set_header",
  "sheet_insert_row",
  "sheet_delete_row",
  "sheet_insert_column",
  "sheet_delete_column",
] as const;

export const VMS_ESCAPE_BLOCK_TYPES = [
  "text_code",
  "text_handlebars",
  "procedures_callreturn",
  "procedures_defreturn",
  "json_object",
  "xml_element",
] as const;

const REMOVED = new Set<string>(VMS_REMOVED_BLOCK_TYPES);
const ESCAPE = new Set<string>(VMS_ESCAPE_BLOCK_TYPES);

export function isVmsRemovedBlockType(type: string): boolean {
  return REMOVED.has(type);
}

export function isVmsEscapeBlockType(type: string): boolean {
  return ESCAPE.has(type);
}
