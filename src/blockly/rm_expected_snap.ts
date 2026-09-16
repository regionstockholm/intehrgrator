/**
 * Expected Blockly snap outcomes from openEHR RM (BMM), XML shape, and
 * Conversion-start product-stack rules — not from Blockly `setCheck`.
 * Tests compare `canConnect` against this so missing/wrong checks fail.
 */
import {
  attributesFor,
  baseRmTypeName,
  blocklyCheckForPrimitiveType,
  isDataValueType,
  isPrimitiveRmType,
  isRmValueAttribute,
  isSubtypeOf,
  resolveGenericSlotType,
} from "../core/rm_meta.ts";
import {
  XML_ATTRIBUTE_TYPE,
  XML_ATTRIBUTES_INPUT,
  XML_CDATA_TYPE,
  XML_CHILDREN_INPUT,
  XML_DOCUMENT_TYPE,
  XML_ELEMENT_TYPE,
  XML_NEST_CHECK,
  XML_ROOT_INPUT,
  XML_TEXT_INPUT,
  XML_TEXT_TYPE,
} from "../core/xml_shape.ts";
import {
  CONVERSION_START_TYPE,
  INSTANCE_ROOT_BLOCK_TYPES,
  TEXT_DOCUMENT_BLOCK_TYPE,
} from "./instance_root.ts";

export const RM_SNAP_PARENT_TYPES = [
  "COMPOSITION",
  "SECTION",
  "OBSERVATION",
  "EVALUATION",
  "INSTRUCTION",
  "ACTION",
  "ADMIN_ENTRY",
  "CLUSTER",
  "ELEMENT",
  "HISTORY",
  "EVENT",
  "POINT_EVENT",
  "INTERVAL_EVENT",
  "EVENT_CONTEXT",
  "ITEM_STRUCTURE",
  "ITEM_TREE",
  "ITEM_LIST",
  "ITEM_TABLE",
  "ITEM_SINGLE",
  "ACTIVITY",
  "PARTY_IDENTIFIED",
  "PARTY_SELF",
  "PARTY_RELATED",
  "PARTY_PROXY",
  "PARTY_REF",
  "PARTICIPATION",
  "FEEDER_AUDIT",
  "FEEDER_AUDIT_DETAILS",
  "ISM_TRANSITION",
  "LINK",
  "ARCHETYPED",
  "GENERIC_ENTRY",
] as const;

export const RM_SNAP_CHILD_TYPES = [
  ...RM_SNAP_PARENT_TYPES,
] as const;

export const PRODUCT_STACK_LOOP_TYPES = ["for_each_source", "for_each_list"] as const;

/** Expression blocks used to probe primitive RM / DV field mouths. */
export const PRIMITIVE_EXPR_BLOCKS: Array<{ type: string; check: string }> = [
  { type: "text", check: "String" },
  { type: "source_query", check: "String" },
  { type: "math_number", check: "Number" },
  { type: "source_query_number", check: "Number" },
  { type: "logic_boolean", check: "Boolean" },
  { type: "source_query_boolean", check: "Boolean" },
];

export type RmSlotShape = "value" | "statement" | "none";

export function rmSlotType(parentRmType: string, attr: string): string | undefined {
  const meta = attributesFor(parentRmType).find((a) => a.name === attr);
  if (!meta) return undefined;
  return resolveGenericSlotType(parentRmType, meta.typeName);
}

export function rmSlotShape(parentRmType: string, attr: string): RmSlotShape {
  const slotType = rmSlotType(parentRmType, attr);
  if (!slotType) return "none";
  if (
    isRmValueAttribute(parentRmType, attr) ||
    isPartyProxyFamily(slotType) ||
    slotType === "PARTY_REF" ||
    isDataValueType(slotType)
  ) {
    return "value";
  }
  if (isPrimitiveRmType(slotType)) return "value";
  return "statement";
}

function isPartyProxyFamily(rmType: string): boolean {
  return rmType === "PARTY_PROXY" || isSubtypeOf(rmType, "PARTY_PROXY");
}

/**
 * Whether an RM child class is allowed in a parent attribute according to BMM.
 * Does not consider Blockly connection shape (value vs statement).
 */
export function rmChildFitsSlot(
  parentRmType: string,
  attr: string,
  childRmType: string,
): boolean {
  const slotType = rmSlotType(parentRmType, attr);
  if (!slotType) return false;
  const child = (childRmType || "").toUpperCase();
  const slot = slotType.toUpperCase();
  if (child === slot) return true;
  if (isSubtypeOf(child, slot)) return true;
  return false;
}

export function rmStructuralAttributes(parentRmType: string): string[] {
  return attributesFor(parentRmType)
    .filter((a) => {
      const base = resolveGenericSlotType(parentRmType, a.typeName);
      return !isPrimitiveRmType(base);
    })
    .map((a) => a.name);
}

export function rmPrimitiveAttributes(parentRmType: string): Array<{ name: string; check: string }> {
  const out: Array<{ name: string; check: string }> = [];
  for (const attr of attributesFor(parentRmType)) {
    const base = baseRmTypeName(attr.typeName);
    if (!isPrimitiveRmType(base)) continue;
    const check = primitiveBlocklyCheck(base);
    if (check) out.push({ name: attr.name, check });
  }
  return out;
}

export function primitiveBlocklyCheck(typeName: string): string | null {
  return blocklyCheckForPrimitiveType(typeName);
}

/** Blockly types that may chain under Conversion start (ADR 0008 / 0010). */
export function conversionStartAllowedChildTypes(): string[] {
  return [...INSTANCE_ROOT_BLOCK_TYPES, ...PRODUCT_STACK_LOOP_TYPES];
}

export function conversionStartRejectedProbeTypes(): string[] {
  return [
    "observation",
    "cluster",
    "section",
    "element",
    XML_ATTRIBUTE_TYPE,
    "dv_quantity",
    "json_boolean",
  ];
}

export type ExpectedXmlSnap = {
  parentType: string;
  inputName: string;
  childType: string;
  expect: boolean;
};

/**
 * XML snap table from `xml_shape.ts` (nest / attribute / document-root checks),
 * not from live Blockly `getCheck()`.
 */
export function xmlExpectedSnapPairs(): ExpectedXmlSnap[] {
  const probes = [
    XML_ELEMENT_TYPE,
    XML_ATTRIBUTE_TYPE,
    XML_TEXT_TYPE,
    XML_CDATA_TYPE,
    XML_DOCUMENT_TYPE,
    "composition",
    "cluster",
    "controls_if",
    "for_each_source",
    "for_each_list",
    "text",
    "math_number",
    "source_query",
  ];
  const out: ExpectedXmlSnap[] = [];
  const xmlNest = new Set<string>(XML_NEST_CHECK);
  const stringValue = new Set([XML_TEXT_TYPE, XML_CDATA_TYPE, "text", "source_query"]);

  for (const childType of probes) {
    out.push({
      parentType: XML_DOCUMENT_TYPE,
      inputName: XML_ROOT_INPUT,
      childType,
      expect: childType === XML_ELEMENT_TYPE,
    });
    out.push({
      parentType: XML_ELEMENT_TYPE,
      inputName: XML_CHILDREN_INPUT,
      childType,
      expect: xmlNest.has(childType),
    });
    out.push({
      parentType: XML_ELEMENT_TYPE,
      inputName: XML_ATTRIBUTES_INPUT,
      childType,
      expect: childType === XML_ATTRIBUTE_TYPE,
    });
    out.push({
      parentType: XML_ELEMENT_TYPE,
      inputName: XML_TEXT_INPUT,
      childType,
      expect: stringValue.has(childType),
    });
  }
  return out;
}

export { CONVERSION_START_TYPE, TEXT_DOCUMENT_BLOCK_TYPE };
